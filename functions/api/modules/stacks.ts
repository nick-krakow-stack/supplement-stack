// ---------------------------------------------------------------------------
// Stacks module
// Routes (mounted at /api/stacks):
//   GET /       — list user stacks (auth)
//   POST /      — create stack (auth)
//   GET /:id    — single stack + items (auth)
//   DELETE /:id — delete stack (auth, own or admin)
//   PUT /:id    — update stack + items (auth, own or admin)
// Route (mounted at /api/stack-warnings):
//   GET /:id    — interaction warnings for a stack (public)
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext, StackRow, StackItemRow, InteractionRow } from '../lib/types'
import { checkRateLimit, ensureAuth } from '../lib/helpers'
import { sendMail } from '../lib/mail'
import { calculateProductUsage, ingredientAmountPerProductServing } from '../lib/stack-calculations'
import { loadIngredientPartsByParentRows, type IngredientPartRead } from '../lib/ingredient-parts'
import { loadCatalogProductSafetyWarnings, loadUserProductSafetyWarnings } from './knowledge'
import {
  getProductShopTarget,
  resolveBindingForNewItem,
} from '../lib/creator-sharing-service'

const stacks = new Hono<AppContext>()

type StackProductType = 'catalog' | 'user_product'

type StackProductInput = {
  id: number
  product_type: StackProductType
  quantity: number
  intake_interval_days: number
  dosage_text?: string | null
  timing: string | null
  sort_order?: number
}

type StackProductValidation = {
  items?: StackProductInput[]
  error?: string
}

type StackItemDosageInsert = {
  sql: string
  bindings: Array<string | number | null>
}

function stackItemDosageInsert(item: StackProductInput, ownerUserId: number): StackItemDosageInsert {
  if (item.dosage_text !== undefined) {
    return { sql: '?', bindings: [item.dosage_text] }
  }
  if (item.product_type === 'catalog') {
    return { sql: '(SELECT dosage_text FROM products WHERE id = ?)', bindings: [item.id] }
  }
  return {
    sql: '(SELECT dosage_text FROM user_products WHERE id = ? AND user_id = ?)',
    bindings: [item.id, ownerUserId],
  }
}

type StackLinkReportProduct = {
  id: number
  name: string
  shop_link: string | null
}

type StackLayoutInput = {
  stack_item_id: number
  sort_order: number
  expected_version: number
}

type StackMailItem = {
  stack_item_id: number
  id: number
  product_type: StackProductType
  name: string
  brand: string | null
  product_price: number
  image_url: string | null
  shop_link: string | null
  click_url: string | null
  is_affiliate: number | null
  quantity: number
  intake_interval_days: number
  serving_size: number | null
  serving_unit: string | null
  servings_per_container: number | null
  container_count: number | null
  timing: string | null
  timing_label: string | null
  ingredient_timing_label: string | null
  dosage_text: string | null
  creator_statement_snapshot: string | null
  creator_snapshot_at: string | null
}

type StackMailIngredient = {
  stack_item_id: number
  parent_row_id: number
  product_type: StackProductType
  ingredient_id: number
  ingredient_name: string
  parent_ingredient_id: number | null
  quantity: number | null
  unit: string | null
  basis_quantity: number | null
  basis_unit: string | null
  search_relevant: number
  parts: IngredientPartRead[]
}

type StackItemResponseIngredient = Pick<StackMailIngredient, 'ingredient_id' | 'ingredient_name' | 'quantity' | 'unit' | 'basis_quantity' | 'basis_unit' | 'search_relevant' | 'parts'>

type StackIngredientTotalAmount = {
  quantity: number
  unit: string
}

type StackIngredientPartTotal = {
  part_id: number
  part_name: string
  totals: StackIngredientTotalAmount[]
}

type StackIngredientTotal = {
  ingredient_id: number
  ingredient_name: string
  totals: StackIngredientTotalAmount[]
  parts: StackIngredientPartTotal[]
}

type StackIngredientAggregationItem = Pick<StackMailItem,
  | 'quantity'
  | 'intake_interval_days'
  | 'dosage_text'
  | 'serving_size'
  | 'serving_unit'
  | 'servings_per_container'
  | 'container_count'
  | 'product_price'
> & {
  ingredients: StackItemResponseIngredient[]
}

type StackItemWithIngredients = StackItemRow & StackIngredientAggregationItem

type StackMailPreparedItem = StackMailItem & {
  dailyAmountLabel: string
  dailyIngredientLabels: string[]
  intakeIntervalLabel: string
  daysSupply: number | null
  monthlyCost: number | null
  warningLabels: string[]
}

function emailDomain(email: string): string | null {
  const domain = email.split('@')[1]?.trim().toLowerCase()
  return domain || null
}

async function recordStackEmailEvent(
  db: D1Database,
  userId: number,
  stackId: number | null,
  eventType: 'single_stack' | 'routine',
  stackCount: number,
  recipientEmail: string,
) {
  try {
    await db.prepare(`
      INSERT INTO stack_email_events (
        user_id,
        stack_id,
        event_type,
        stack_count,
        recipient_domain
      )
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, stackId, eventType, stackCount, emailDomain(recipientEmail)).run()
  } catch {
    // Dashboard tracking table may not be migrated yet; mail sending must still work.
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function normalizeComparableUnit(unit?: string | null): string {
  const normalized = (unit ?? '').trim().toLowerCase().replace(/μ/g, 'µ').replace(/\./g, '')
  if (['iu', 'ie'].includes(normalized)) return 'iu'
  if (['µg', 'ug', 'mcg'].includes(normalized)) return 'µg'
  if (['kapsel', 'kapseln'].includes(normalized)) return 'kapsel'
  if (['tablette', 'tabletten'].includes(normalized)) return 'tablette'
  if (normalized === 'tropfen') return 'tropfen'
  if (['softgel', 'softgels'].includes(normalized)) return 'softgel'
  if (['portion', 'portionen'].includes(normalized)) return 'portion'
  return normalized
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value)
}

function displayUnit(unit?: string | null): string {
  return (unit ?? '').replace(/\bIU\b/gi, 'IE')
}

function unitLabel(unit?: string | null, amount?: number): string {
  const normalized = displayUnit(unit).trim()
  const singular = amount == null || Math.abs(amount - 1) < 0.001
  switch (normalized.toLowerCase()) {
    case 'kapsel':
    case 'kapseln':
      return singular ? 'Kapsel' : 'Kapseln'
    case 'tablette':
    case 'tabletten':
      return singular ? 'Tablette' : 'Tabletten'
    case 'softgel':
    case 'softgels':
      return singular ? 'Softgel' : 'Softgels'
    case 'portion':
    case 'portionen':
      return singular ? 'Portion' : 'Portionen'
    default:
      return normalized
  }
}

function formatDailyUnit(value: number, unit?: string | null): string {
  const shown = Math.abs(value - Math.round(value)) < 0.001 ? Math.round(value) : value
  return `${formatNumber(shown)} ${unitLabel(unit, shown)}`
}

function normalizeIntakeIntervalDays(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return 1
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

function amountForStackAggregation(
  value: number,
  unit?: string | null,
): { key: string; quantity: number; unit: string } | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const normalized = normalizeComparableUnit(unit)
  if (!normalized) return null
  if (normalized === 'g') return { key: 'mass:mg', quantity: value * 1000, unit: 'mg' }
  if (normalized === 'mg') return { key: 'mass:mg', quantity: value, unit: 'mg' }
  if (normalized === 'µg') return { key: 'mass:mg', quantity: value / 1000, unit: 'mg' }
  if (normalized === 'iu') return { key: 'iu', quantity: value, unit: 'IE' }
  return { key: `exact:${normalized}`, quantity: value, unit: normalized }
}

function addStackAggregationAmount(
  target: Map<string, StackIngredientTotalAmount>,
  value: number,
  unit?: string | null,
): void {
  const amount = amountForStackAggregation(value, unit)
  if (!amount) return
  const current = target.get(amount.key)
  target.set(amount.key, {
    quantity: (current?.quantity ?? 0) + amount.quantity,
    unit: amount.unit,
  })
}

function finalizeStackAggregationAmounts(
  target: Map<string, StackIngredientTotalAmount>,
): StackIngredientTotalAmount[] {
  return [...target.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'de'))
    .map(([, amount]) => ({
      quantity: Number(amount.quantity.toFixed(12)),
      unit: amount.unit,
    }))
}

function aggregateStackIngredientTotals(items: StackIngredientAggregationItem[]): StackIngredientTotal[] {
  const totals = new Map<number, {
    ingredient_name: string
    totals: Map<string, StackIngredientTotalAmount>
    parts: Map<number, { part_name: string; totals: Map<string, StackIngredientTotalAmount> }>
  }>()

  for (const item of items) {
    const usage = calculateProductUsage({ ...item, ingredients: item.ingredients }, item.product_price)
    const dailyServingFactor = usage.effectiveDailyUsage
    if (!Number.isFinite(dailyServingFactor) || dailyServingFactor <= 0) continue

    for (const ingredient of item.ingredients) {
      if (ingredient.search_relevant !== 1) continue
      const aggregate = totals.get(ingredient.ingredient_id) ?? {
        ingredient_name: ingredient.ingredient_name,
        totals: new Map<string, StackIngredientTotalAmount>(),
        parts: new Map<number, { part_name: string; totals: Map<string, StackIngredientTotalAmount> }>(),
      }
      const amountPerServing = ingredientAmountPerProductServing(ingredient, item)
      if (amountPerServing !== null) {
        addStackAggregationAmount(aggregate.totals, amountPerServing * dailyServingFactor, ingredient.unit)
      }

      for (const part of ingredient.parts) {
        if (part.search_relevant !== 1) continue
        const effectivePart = {
          ...part,
          basis_quantity: part.basis_quantity ?? ingredient.basis_quantity,
          basis_unit: part.basis_unit ?? ingredient.basis_unit,
        }
        const partAmountPerServing = ingredientAmountPerProductServing(effectivePart, item)
        if (partAmountPerServing === null) continue
        const partAggregate = aggregate.parts.get(part.part_id) ?? {
          part_name: part.part_name,
          totals: new Map<string, StackIngredientTotalAmount>(),
        }
        addStackAggregationAmount(partAggregate.totals, partAmountPerServing * dailyServingFactor, part.unit)
        aggregate.parts.set(part.part_id, partAggregate)
      }
      totals.set(ingredient.ingredient_id, aggregate)
    }
  }

  return [...totals.entries()]
    .sort(([, left], [, right]) => left.ingredient_name.localeCompare(right.ingredient_name, 'de'))
    .map(([ingredientId, ingredient]) => ({
      ingredient_id: ingredientId,
      ingredient_name: ingredient.ingredient_name,
      totals: finalizeStackAggregationAmounts(ingredient.totals),
      parts: [...ingredient.parts.entries()]
        .sort(([, left], [, right]) => left.part_name.localeCompare(right.part_name, 'de'))
        .map(([partId, part]) => ({
          part_id: partId,
          part_name: part.part_name,
          totals: finalizeStackAggregationAmounts(part.totals),
        })),
    }))
    .filter((ingredient) => ingredient.totals.length > 0 || ingredient.parts.length > 0)
}

function normalizeOptionalSortOrder(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return undefined
  return parsed
}

function formatIntakeInterval(days: number): string {
  return days <= 1 ? 'täglich' : `alle ${days} Tage`
}

function normalizedTimingSqlExpression(sourceExpression: string): string {
  return `LOWER(REPLACE(REPLACE(TRIM(COALESCE(${sourceExpression}, '')), ' ', '_'), '-', '_'))`
}

function canonicalIntakeTimingSqlExpression(sourceExpression: string): string {
  const normalized = normalizedTimingSqlExpression(sourceExpression)
  return `CASE
    WHEN ${normalized} = '' THEN NULL
    WHEN ${normalized} IN ('anytime', 'flexible', 'jederzeit') THEN 'anytime'
    WHEN ${normalized} LIKE '%morning_evening%' OR ${normalized} LIKE '%morgens_%_abends%' THEN 'morning_evening'
    WHEN ${normalized} LIKE '%before_breakfast%' OR ${normalized} LIKE '%vor_dem_fr%' OR ${normalized} LIKE '%zum_fr%' THEN 'before_breakfast'
    WHEN ${normalized} LIKE '%after_breakfast%' OR ${normalized} LIKE '%nach_dem_fr%' THEN 'after_breakfast'
    WHEN ${normalized} LIKE '%with_meal%' OR ${normalized} LIKE '%mahlzeit%' OR ${normalized} LIKE '%essen%' THEN 'with_meal'
    WHEN ${normalized} LIKE '%morning%' OR ${normalized} LIKE '%morgen%' THEN 'morning'
    WHEN ${normalized} LIKE '%evening%' OR ${normalized} LIKE '%abend%' OR ${normalized} LIKE '%nacht%' THEN 'evening'
    WHEN ${normalized} LIKE '%noon%' OR ${normalized} LIKE '%mittag%' THEN 'noon'
    ELSE ${normalized}
  END`
}

const STACK_TIMING_EMAIL_LABELS: Record<string, string> = {
  anytime: 'Jederzeit',
  flexible: 'Jederzeit',
  jederzeit: 'Jederzeit',
  before_breakfast: 'Vor dem Frühstück',
  after_breakfast: 'Nach dem Frühstück',
  with_meal: 'Zum Essen',
  morning: 'Morgens',
  evening: 'Abends',
  noon: 'Mittags',
  morning_evening: 'Morgens & Abends',
}

function normalizeTimingDisplayKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

function isEnumLikeTimingValue(value: string): boolean {
  const trimmed = value.trim()
  return /^[A-Z0-9_-]+$/.test(trimmed) || /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(trimmed)
}

function formatStackTimingForEmail(item: Pick<StackMailItem, 'timing_label' | 'timing'>): string {
  const managedLabel = item.timing_label?.trim()
  if (managedLabel) return managedLabel

  const rawTiming = item.timing?.trim()
  if (!rawTiming) return '-'

  const mappedLabel = STACK_TIMING_EMAIL_LABELS[normalizeTimingDisplayKey(rawTiming)]
  if (mappedLabel) return mappedLabel

  if (isEnumLikeTimingValue(rawTiming)) return 'Jederzeit'

  return rawTiming
}

function prepareMailItems(
  items: StackMailItem[],
  ingredientsByItem: Map<number, StackMailIngredient[]>,
  warningsByItem: Map<number, string[]>,
): StackMailPreparedItem[] {
  return items.map((item) => {
    const ingredients = ingredientsByItem.get(item.stack_item_id) ?? []
    const usage = calculateProductUsage({ ...item, ingredients }, item.product_price)
    const dailyUnitValue = usage.intakeAmountPerDay
    const dailyAmountLabel = item.serving_unit
      ? `${formatDailyUnit(dailyUnitValue, item.serving_unit)}/Einnahmetag`
      : `${formatDailyUnit(usage.servingsPerIntake, 'Portionen')}/Einnahmetag`
    const dailyIngredientLabels = ingredients
      .filter((ingredient) => ingredient.search_relevant === 1 && ingredient.quantity != null && ingredient.quantity > 0)
      .flatMap((ingredient) => {
        const amountPerServing = ingredientAmountPerProductServing(ingredient, item) ?? ingredient.quantity ?? 0
        const labels = [
          `${ingredient.ingredient_name}: ${formatDailyUnit(amountPerServing * usage.effectiveDailyUsage, ingredient.unit)}/Tag`,
        ]
        for (const part of ingredient.parts) {
          if (part.search_relevant !== 1 || part.quantity === null || part.quantity <= 0) continue
          const effectivePart = {
            ...part,
            basis_quantity: part.basis_quantity ?? ingredient.basis_quantity,
            basis_unit: part.basis_unit ?? ingredient.basis_unit,
          }
          const partAmountPerServing = ingredientAmountPerProductServing(effectivePart, item) ?? part.quantity
          labels.push(`davon ${part.part_name}: ${formatDailyUnit(partAmountPerServing * usage.effectiveDailyUsage, part.unit)}/Tag`)
        }
        return labels
      })

    return {
      ...item,
      dailyAmountLabel,
      dailyIngredientLabels,
      intakeIntervalLabel: formatIntakeInterval(Math.max(1, item.intake_interval_days || 1)),
      daysSupply: usage.daysSupply,
      monthlyCost: usage.monthlyCost,
      warningLabels: warningsByItem.get(item.stack_item_id) ?? [],
    }
  })
}

function formatStackTotalAmounts(amounts: StackIngredientTotalAmount[]): string {
  return amounts.length > 0
    ? amounts.map((amount) => formatDailyUnit(amount.quantity, amount.unit)).join(' + ')
    : 'Menge nicht angegeben'
}

function stackMailPurchaseUrl(item: StackMailPreparedItem, requestOrigin: string): string | null {
  if (item.product_type === 'catalog') {
    if (!item.click_url) return null
    try {
      return new URL(item.click_url, `${requestOrigin}/`).toString()
    } catch {
      return null
    }
  }
  return item.shop_link
}

function formatCreatorSnapshotDate(value: string): string | null {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const timestamp = Date.parse(normalized)
  if (!Number.isFinite(timestamp)) return null
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(timestamp))
}

function buildStackEmailHtml(
  stack: StackRow,
  items: StackMailPreparedItem[],
  totalOnce: number,
  totalMonthly: number,
  ingredientTotals: StackIngredientTotal[],
  requestOrigin: string,
): string {
  const rows = items.map((item) => {
    const productImage = item.image_url
      ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;background:#f8fafc;">`
      : `<div style="width:56px;height:56px;border-radius:10px;border:1px solid #e5e7eb;background:#f8fafc;text-align:center;line-height:56px;color:#94a3b8;font-size:18px;font-weight:800;">SS</div>`
    const purchaseUrl = stackMailPurchaseUrl(item, requestOrigin)
    const buyButton = purchaseUrl
      ? `<a href="${escapeHtml(purchaseUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:9px 12px;white-space:nowrap;">Jetzt kaufen</a>`
      : '<span style="display:inline-block;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 10px;font-weight:700;">Kauf-Link fehlt - bitte Produkt melden</span>'
    const ingredientText = item.dailyIngredientLabels.length > 0
      ? item.dailyIngredientLabels.map(escapeHtml).join('<br>')
      : '-'
    const warnings = item.warningLabels.length > 0
      ? item.warningLabels.map((warning) => `<div style="margin-top:4px;color:#9a3412;">${escapeHtml(warning)}</div>`).join('')
      : '<span style="color:#64748b;">Keine bekannten Hinweise im Stack</span>'
    return `
      <tr>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">${productImage}</td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">
          <strong style="font-size:15px;">${escapeHtml(item.name)}</strong>
          ${item.brand ? `<br><span style="color:#64748b;">${escapeHtml(item.brand)}</span>` : ''}
          ${item.creator_statement_snapshot ? `<br><span style="display:inline-block;margin-top:6px;color:#475569;"><strong>Persönliche Creator-Notiz:</strong> ${escapeHtml(item.creator_statement_snapshot)}</span>` : ''}
        </td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">${ingredientText}</td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(item.dailyAmountLabel)}</strong>
          ${item.dosage_text ? `<br><span style="color:#64748b;">Ziel: ${escapeHtml(item.dosage_text)}</span>` : ''}
          <br><span style="color:#64748b;">Intervall: ${escapeHtml(item.intakeIntervalLabel)}</span>
          ${item.daysSupply ? `<br><span style="color:#64748b;">reicht ca. ${item.daysSupply} Tage</span>` : ''}
        </td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatStackTimingForEmail(item))}</td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">${warnings}</td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">
          <strong>${formatEuro(item.product_price)}</strong>
          <br><span style="color:#64748b;">${item.monthlyCost != null ? `${formatEuro(item.monthlyCost)}/Monat` : '-'}</span>
          <br><br>${buyButton}
        </td>
      </tr>
    `
  }).join('')

  const ingredientSummary = ingredientTotals.length > 0
    ? `<div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <strong>Wirkstoffe pro Tag</strong>
        ${ingredientTotals.map((ingredient) => `
          <div style="margin-top:8px;">
            <strong>${escapeHtml(ingredient.ingredient_name)}:</strong> ${escapeHtml(formatStackTotalAmounts(ingredient.totals))}
            ${ingredient.parts.map((part) => `<br><span style="padding-left:14px;color:#475569;">davon ${escapeHtml(part.part_name)}: ${escapeHtml(formatStackTotalAmounts(part.totals))}</span>`).join('')}
          </div>
        `).join('')}
      </div>`
    : ''

  const creatorSnapshotDates = Array.from(new Set(
    items
      .map((item) => item.creator_snapshot_at ? formatCreatorSnapshotDate(item.creator_snapshot_at) : null)
      .filter((value): value is string => value !== null),
  ))
  const creatorContext = stack.origin_party_name
    ? `<div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;">
        <strong>Creator:</strong> ${escapeHtml(stack.origin_party_name)}
        ${creatorSnapshotDates.length > 0 ? `<br><strong>Stand der Creator-Empfehlung:</strong> ${creatorSnapshotDates.map(escapeHtml).join(', ')}` : ''}
      </div>`
    : ''
  const stackNote = stack.description?.trim()
    ? `<div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <strong>Deine Notiz zum Stack:</strong> ${escapeHtml(stack.description.trim())}
      </div>`
    : ''

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;line-height:1.5;">
      <h1 style="font-size:22px;margin:0 0 8px;">${escapeHtml(stack.name)}</h1>
      <p style="margin:0 0 18px;color:#64748b;">Dein Supplement-Stack aus Supplement Stack.</p>
      ${creatorContext}
      ${stackNote}
      <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <strong>Einmaliger Kaufpreis:</strong> ${formatEuro(totalOnce)}
        <br><strong>Geschätzte Monatskosten:</strong> ${formatEuro(totalMonthly)}
      </div>
      ${ingredientSummary}
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th align="left" style="padding:10px 8px;">Foto</th>
            <th align="left" style="padding:10px 8px;">Produkt</th>
            <th align="left" style="padding:10px 8px;">Wirkstoff</th>
            <th align="left" style="padding:10px 8px;">Tagesdosis</th>
            <th align="left" style="padding:10px 8px;">Timing</th>
            <th align="left" style="padding:10px 8px;">Wechselwirkung</th>
            <th align="right" style="padding:10px 8px;">Kosten</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7" style="padding:12px 8px;color:#64748b;">Dieser Stack ist leer.</td></tr>'}</tbody>
      </table>
      <p style="margin:20px 0 0;color:#64748b;font-size:12px;">
        Diese E-Mail dient deiner persönlichen Übersicht und ersetzt keine medizinische Beratung.
      </p>
    </div>
  `
}

function normalizeStackProductType(value: unknown): StackProductType | null {
  if (value === undefined || value === null || value === '' || value === 'catalog') return 'catalog'
  if (value === 'user_product') return 'user_product'
  return null
}

function normalizeStackProductItems(value: unknown): StackProductValidation {
  const rawItems: Array<Record<string, unknown>> = Array.isArray(value)
    ? value.map((item) => (
        typeof item === 'number' ? { id: item } : item && typeof item === 'object' ? item as Record<string, unknown> : {}
      ))
    : []

  const items: StackProductInput[] = []
  const seenProducts = new Set<string>()
  for (const item of rawItems) {
    const id = Number(item.id)
    const productType = normalizeStackProductType(item.product_type ?? item.product_source ?? item.source)
    const quantity = item.quantity === undefined || item.quantity === null || item.quantity === ''
      ? 1
      : Number(item.quantity)
    const intakeIntervalDays = normalizeIntakeIntervalDays(item.intake_interval_days ?? item.intakeIntervalDays)
    const hasDosageText = Object.prototype.hasOwnProperty.call(item, 'dosage_text')
    if (hasDosageText && item.dosage_text !== null && typeof item.dosage_text !== 'string') {
      return { error: 'Die Angabe zur Einnahmemenge ist ungültig.' }
    }
    const dosageText = !hasDosageText
      ? undefined
      : typeof item.dosage_text === 'string' && item.dosage_text.trim() !== ''
        ? item.dosage_text.trim()
        : null
    const timing = typeof item.timing === 'string' && item.timing.trim() !== ''
      ? item.timing.trim()
      : null
    const sortOrder = normalizeOptionalSortOrder(item.sort_order ?? item.sortOrder)

    if (!Number.isInteger(id) || id <= 0) {
      return { error: 'Mindestens ein ausgewähltes Produkt ist ungültig.' }
    }
    if (productType === null) {
      return { error: 'Die Produktart ist ungültig.' }
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: 'Die Menge muss größer als 0 sein.' }
    }
    if (intakeIntervalDays === null) {
      return { error: 'Der Einnahmeabstand muss mindestens einen Tag betragen.' }
    }
    if ((item.sort_order !== undefined || item.sortOrder !== undefined) && sortOrder === undefined) {
      return { error: 'Die Reihenfolge ist ungültig.' }
    }
    const productKey = `${productType}:${id}`
    if (seenProducts.has(productKey)) {
      return { error: 'Dasselbe Produkt kann nicht doppelt übermittelt werden.' }
    }
    seenProducts.add(productKey)

    items.push({
      id,
      product_type: productType,
      quantity,
      intake_interval_days: intakeIntervalDays,
      dosage_text: dosageText,
      timing,
      sort_order: sortOrder,
    })
  }

  return { items }
}

async function validateStackProductReferences(
  db: D1Database,
  userId: number,
  items: StackProductInput[],
): Promise<boolean> {
  const catalogIds = [...new Set(items.filter((item) => item.product_type === 'catalog').map((item) => item.id))]
  if (catalogIds.length > 0) {
    const placeholders = catalogIds.map(() => '?').join(',')
    const row = await db.prepare(`
    SELECT COUNT(*) as count
    FROM products
    WHERE id IN (${placeholders})
      AND moderation_status = 'approved'
      AND visibility = 'public'
  `).bind(...catalogIds).first<{ count: number }>()
    if ((row?.count ?? 0) !== catalogIds.length) return false
  }

  const userProductIds = [...new Set(items.filter((item) => item.product_type === 'user_product').map((item) => item.id))]
  if (userProductIds.length > 0) {
    const placeholders = userProductIds.map(() => '?').join(',')
    const row = await db.prepare(`
      SELECT COUNT(*) as count
      FROM user_products
      WHERE id IN (${placeholders})
        AND user_id = ?
        AND status IN ('pending', 'approved', 'blocked')
    `).bind(...userProductIds, userId).first<{ count: number }>()
    if ((row?.count ?? 0) !== userProductIds.length) return false
  }

  return true
}

async function stackItemBindingStatement(
  db: D1Database,
  stackItemId: number,
  catalogProductId: number,
  contextPartyId: number | null,
  claim?: { stackId: number | string; userId: number; version: number; token: string },
): Promise<D1PreparedStatement | null> {
  const target = await getProductShopTarget(db, catalogProductId)
  if (!target) return null
  const binding = await resolveBindingForNewItem(db, target, contextPartyId)
  if (!binding) return null
  const claimSql = claim
    ? `WHERE EXISTS (
        SELECT 1 FROM stacks
        WHERE id = ? AND user_id = ? AND version = ?
          AND write_claim_token = ? AND deleted_at IS NULL
      )`
    : ''
  const bindings: Array<string | number | null> = [
    stackItemId,
    target.id,
    binding.resolution_kind,
    binding.affiliate_version_id,
    binding.resolved_party_id,
  ]
  if (claim) bindings.push(claim.stackId, claim.userId, claim.version, claim.token)
  return db.prepare(`
    INSERT INTO stack_item_link_bindings (
      stack_item_id, shop_link_id, resolution_kind,
      affiliate_version_id, resolved_party_id, bound_at
    )
    SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
    ${claimSql}
  `).bind(...bindings)
}

async function candidateIds(
  db: D1Database,
  table: 'stacks' | 'stack_items',
  count: number,
): Promise<number[]> {
  if (!Number.isInteger(count) || count < 0) throw new Error('Invalid id candidate count')
  if (count === 0) return []
  const row = await db.prepare(`
    SELECT MAX(
      COALESCE((SELECT seq FROM sqlite_sequence WHERE name = ?), 0),
      COALESCE((SELECT MAX(id) FROM ${table}), 0)
    ) + 1 AS first_id
  `).bind(table).first<{ first_id: number }>()
  const first = Number(row?.first_id)
  const last = first + count - 1
  if (!Number.isSafeInteger(first) || first <= 0 || !Number.isSafeInteger(last)) {
    throw new Error(`Could not generate ids for ${table}`)
  }
  return Array.from({ length: count }, (_, index) => first + index)
}

async function loadStackItems(
  db: D1Database,
  stackId: number | string,
  ownerUserId: number,
): Promise<StackItemRow[]> {
  const { results } = await db.prepare(`
    SELECT
      base.*,
      timing_item.label AS timing_label,
      ingredient_timing_item.label AS ingredient_timing_label
    FROM (
      SELECT
        si.id AS stack_item_id,
        p.id,
        'catalog' AS product_type,
        p.name,
        p.brand,
        p.price,
        p.price as product_price,
        p.image_url,
        p.shop_link,
        CASE WHEN binding.resolution_kind IS NOT NULL AND binding.resolution_kind <> 'bare' THEN 1 ELSE p.is_affiliate END AS is_affiliate,
        p.discontinued_at,
        p.serving_size,
        p.serving_unit,
        p.servings_per_container,
        p.container_count,
        COALESCE(si.timing, idp_form.timing, idp_base.timing, p.timing) AS timing,
        si.dosage_text AS dosage_text,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS ingredient_effect_summary,
        COALESCE(idp_form.timing, idp_base.timing) AS ingredient_timing,
        COALESCE(idp_form.timing_note, idp_base.timing_note) AS ingredient_timing_note,
        COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS ingredient_intake_hint,
        p.warning_title,
        p.warning_message,
        p.warning_type,
        p.alternative_note,
        si.source_share_link_id,
        si.creator_statement_snapshot,
        COALESCE(
          json_extract(source_share.snapshot_json, '$.published_at'),
          datetime(source_share.created_at, 'unixepoch'),
          binding.bound_at
        ) AS creator_snapshot_at,
        si.amount_source,
        si.version,
        CASE
          WHEN binding.stack_item_id IS NOT NULL
            THEN '/api/products/' || p.id || '/out?stack_item_id=' || si.id || '&context=creator_stack'
          ELSE '/api/products/' || p.id || '/out?context=stack'
        END AS click_url,
        CASE WHEN si.source_share_link_id IS NOT NULL OR binding.resolved_party_id IS NOT NULL THEN 1 ELSE 0 END AS has_attribution,
        si.sort_order,
        si.quantity,
        si.intake_interval_days
      FROM stack_items si
      JOIN products p ON p.id = si.catalog_product_id
      LEFT JOIN stack_item_link_bindings binding ON binding.stack_item_id = si.id
      LEFT JOIN share_links source_share ON source_share.id = si.source_share_link_id
      LEFT JOIN product_ingredients pi_main ON pi_main.id = (
        SELECT pi2.id
        FROM product_ingredients pi2
        WHERE pi2.product_id = p.id
        ORDER BY pi2.is_main DESC, pi2.search_relevant DESC, pi2.id ASC
        LIMIT 1
      )
      LEFT JOIN ingredient_display_profiles idp_form
        ON idp_form.ingredient_id = pi_main.ingredient_id
       AND idp_form.form_id = pi_main.form_id
       AND idp_form.part_id IS NULL
       AND idp_form.sub_ingredient_id IS NULL
      LEFT JOIN ingredient_display_profiles idp_base
        ON idp_base.ingredient_id = pi_main.ingredient_id
       AND idp_base.form_id IS NULL
       AND idp_base.part_id IS NULL
       AND idp_base.sub_ingredient_id IS NULL
      WHERE si.stack_id = ?
        AND si.catalog_product_id IS NOT NULL

      UNION ALL

      SELECT
        si.id AS stack_item_id,
        up.id,
        'user_product' AS product_type,
        up.name,
        up.brand,
        up.price,
        up.price as product_price,
        up.image_url,
        up.shop_link,
        up.is_affiliate,
        NULL AS discontinued_at,
        up.serving_size,
        up.serving_unit,
        up.servings_per_container,
        up.container_count,
        COALESCE(si.timing, idp_form.timing, idp_base.timing, up.timing) AS timing,
        si.dosage_text AS dosage_text,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS ingredient_effect_summary,
        COALESCE(idp_form.timing, idp_base.timing) AS ingredient_timing,
        COALESCE(idp_form.timing_note, idp_base.timing_note) AS ingredient_timing_note,
        COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS ingredient_intake_hint,
        up.warning_title,
        up.warning_message,
        up.warning_type,
        up.alternative_note,
        si.source_share_link_id,
        si.creator_statement_snapshot,
        COALESCE(
          json_extract(source_share.snapshot_json, '$.published_at'),
          datetime(source_share.created_at, 'unixepoch')
        ) AS creator_snapshot_at,
        si.amount_source,
        si.version,
        NULL AS click_url,
        0 AS has_attribution,
        si.sort_order,
        si.quantity,
        si.intake_interval_days
      FROM stack_items si
      JOIN user_products up ON up.id = si.user_product_id AND up.user_id = ?
      LEFT JOIN share_links source_share ON source_share.id = si.source_share_link_id
      LEFT JOIN user_product_ingredients upi_main ON upi_main.id = (
        SELECT upi2.id
        FROM user_product_ingredients upi2
        WHERE upi2.user_product_id = up.id
        ORDER BY upi2.is_main DESC, upi2.search_relevant DESC, upi2.id ASC
        LIMIT 1
      )
      LEFT JOIN ingredient_display_profiles idp_form
        ON idp_form.ingredient_id = upi_main.ingredient_id
       AND idp_form.form_id = upi_main.form_id
       AND idp_form.part_id IS NULL
       AND idp_form.sub_ingredient_id IS NULL
      LEFT JOIN ingredient_display_profiles idp_base
        ON idp_base.ingredient_id = upi_main.ingredient_id
       AND idp_base.form_id IS NULL
       AND idp_base.part_id IS NULL
       AND idp_base.sub_ingredient_id IS NULL
      WHERE si.stack_id = ?
        AND si.user_product_id IS NOT NULL
    ) base
    LEFT JOIN managed_list_items timing_item
      ON timing_item.list_key = 'intake_timing'
     AND timing_item.active = 1
     AND timing_item.value = ${canonicalIntakeTimingSqlExpression('base.timing')}
    LEFT JOIN managed_list_items ingredient_timing_item
      ON ingredient_timing_item.list_key = 'intake_timing'
     AND ingredient_timing_item.active = 1
     AND ingredient_timing_item.value = ${canonicalIntakeTimingSqlExpression('base.ingredient_timing')}
    ORDER BY base.sort_order ASC, base.stack_item_id ASC
  `).bind(stackId, ownerUserId, stackId).all<StackItemRow>()
  return results
}

async function loadStackMailIngredients(
  db: D1Database,
  stackId: number | string,
  ownerUserId: number,
): Promise<StackMailIngredient[]> {
  const { results } = await db.prepare(`
    SELECT *
    FROM (
      SELECT
        si.id AS stack_item_id,
        pi.id AS parent_row_id,
        'catalog' AS product_type,
        pi.ingredient_id,
        i.name AS ingredient_name,
        pi.parent_ingredient_id,
        pi.quantity,
        pi.unit,
        pi.basis_quantity,
        pi.basis_unit,
        pi.search_relevant
      FROM stack_items si
      JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id
      JOIN ingredients i ON i.id = pi.ingredient_id
      WHERE si.stack_id = ?
        AND si.catalog_product_id IS NOT NULL

      UNION ALL

      SELECT
        si.id AS stack_item_id,
        upi.id AS parent_row_id,
        'user_product' AS product_type,
        upi.ingredient_id,
        i.name AS ingredient_name,
        upi.parent_ingredient_id,
        upi.quantity,
        upi.unit,
        upi.basis_quantity,
        upi.basis_unit,
        upi.search_relevant
      FROM stack_items si
      JOIN user_products up ON up.id = si.user_product_id AND up.user_id = ?
      JOIN user_product_ingredients upi ON upi.user_product_id = up.id
      JOIN ingredients i ON i.id = upi.ingredient_id
      WHERE si.stack_id = ?
        AND si.user_product_id IS NOT NULL
    )
    ORDER BY stack_item_id ASC, search_relevant DESC, ingredient_name ASC
  `).bind(stackId, ownerUserId, stackId).all<Omit<StackMailIngredient, 'parts'>>()
  const catalogRows = results.filter((row) => row.product_type === 'catalog')
  const userRows = results.filter((row) => row.product_type === 'user_product')
  const [catalogParts, userParts] = await Promise.all([
    loadIngredientPartsByParentRows(
      db,
      'product_ingredient_parts',
      'product_ingredient_id',
      catalogRows.map((row) => row.parent_row_id),
      { publicOnly: true },
    ),
    loadIngredientPartsByParentRows(
      db,
      'user_product_ingredient_parts',
      'user_product_ingredient_id',
      userRows.map((row) => row.parent_row_id),
      { publicOnly: false },
    ),
  ])
  return results.map((row) => ({
    ...row,
    parts: (row.product_type === 'catalog' ? catalogParts : userParts).get(row.parent_row_id) ?? [],
  }))
}

function groupIngredientsByStackItem(ingredients: StackMailIngredient[]): Map<number, StackMailIngredient[]> {
  const grouped = new Map<number, StackMailIngredient[]>()
  for (const ingredient of ingredients) {
    const rows = grouped.get(ingredient.stack_item_id) ?? []
    rows.push(ingredient)
    grouped.set(ingredient.stack_item_id, rows)
  }
  return grouped
}

async function loadStackItemsWithIngredients(
  db: D1Database,
  stackId: number | string,
  ownerUserId: number,
): Promise<StackItemWithIngredients[]> {
  const items = await loadStackItems(db, stackId, ownerUserId)
  const ingredients = await loadStackMailIngredients(db, stackId, ownerUserId)
  const ingredientsByItem = groupIngredientsByStackItem(ingredients)
  const catalogProductIds = items
    .filter((item) => (item as StackItemRow & { product_type?: StackProductType }).product_type !== 'user_product')
    .map((item) => item.id)
  const userProductIds = items
    .filter((item) => (item as StackItemRow & { product_type?: StackProductType }).product_type === 'user_product')
    .map((item) => item.id)
  const [catalogWarnings, userWarnings] = await Promise.all([
    loadCatalogProductSafetyWarnings(db, catalogProductIds),
    loadUserProductSafetyWarnings(db, userProductIds),
  ])

  return items.map((item) => {
    const typedItem = item as StackItemRow
      & Omit<StackIngredientAggregationItem, 'ingredients'>
      & { stack_item_id: number; product_type?: StackProductType }
    const stackItemId = typedItem.stack_item_id
    const warnings = typedItem.product_type === 'user_product'
      ? userWarnings.get(item.id) ?? []
      : catalogWarnings.get(item.id) ?? []
    return {
      ...typedItem,
      warnings,
      ingredients: (ingredientsByItem.get(stackItemId) ?? []).map((ingredient) => ({
        ingredient_id: ingredient.ingredient_id,
        ingredient_name: ingredient.ingredient_name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        basis_quantity: ingredient.basis_quantity,
        basis_unit: ingredient.basis_unit,
        search_relevant: ingredient.search_relevant,
        parts: ingredient.parts,
      })),
    }
  })
}

function effectiveIngredientIdsByItem(
  ingredientsByItem: Map<number, StackMailIngredient[]>,
): Map<number, Set<number>> {
  const effective = new Map<number, Set<number>>()
  for (const [stackItemId, rows] of ingredientsByItem.entries()) {
    const parentIdsWithChildRows = new Set(
      rows
        .map((row) => row.parent_ingredient_id)
        .filter((parentId): parentId is number => parentId !== null),
    )
    const ids = new Set<number>()
    for (const row of rows) {
      if (row.search_relevant !== 1) continue
      if (row.parent_ingredient_id !== null) {
        ids.add(row.ingredient_id)
      } else if (!parentIdsWithChildRows.has(row.ingredient_id)) {
        ids.add(row.ingredient_id)
      }
    }
    effective.set(stackItemId, ids)
  }
  return effective
}

async function loadStackMailWarnings(
  db: D1Database,
  ingredientsByItem: Map<number, StackMailIngredient[]>,
): Promise<Map<number, string[]>> {
  const effectiveByItem = effectiveIngredientIdsByItem(ingredientsByItem)
  const allIds = [...new Set([...effectiveByItem.values()].flatMap((ids) => [...ids]))]
  const warningsByItem = new Map<number, string[]>()
  if (allIds.length < 2) return warningsByItem

  const placeholders = allIds.map(() => '?').join(',')
  const { results: warnings } = await db.prepare(`
    SELECT
      ia.name AS ingredient_a_name,
      ib.name AS ingredient_b_name,
      ingredient_id,
      partner_ingredient_id,
      comment
    FROM interactions
    JOIN ingredients ia ON ia.id = interactions.ingredient_id
    JOIN ingredients ib ON ib.id = interactions.partner_ingredient_id
    WHERE is_active = 1
      AND partner_type = 'ingredient'
      AND partner_ingredient_id IS NOT NULL
      AND ingredient_id IN (${placeholders})
      AND partner_ingredient_id IN (${placeholders})
      AND ingredient_id <> partner_ingredient_id
    ORDER BY interactions.id
  `).bind(...allIds, ...allIds).all<{
    ingredient_a_name: string
    ingredient_b_name: string
    ingredient_id: number
    partner_ingredient_id: number
    comment: string | null
  }>()

  for (const warning of warnings) {
    const label = `${warning.ingredient_a_name} + ${warning.ingredient_b_name}: ${warning.comment ?? 'Hinweis beachten.'}`
    for (const [stackItemId, ids] of effectiveByItem.entries()) {
      if (ids.has(warning.ingredient_id) || ids.has(warning.partner_ingredient_id)) {
        const rows = warningsByItem.get(stackItemId) ?? []
        if (!rows.includes(label)) rows.push(label)
        warningsByItem.set(stackItemId, rows)
      }
    }
  }

  return warningsByItem
}

async function purgeExpiredStackTrash(db: D1Database, userId: number): Promise<void> {
  await db.prepare(`
    DELETE FROM stacks
    WHERE user_id = ?
      AND deleted_at IS NOT NULL
      AND delete_purge_after IS NOT NULL
      AND delete_purge_after <= CURRENT_TIMESTAMP
  `).bind(userId).run()
}

// GET /api/stacks
stacks.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  await purgeExpiredStackTrash(c.env.DB, user.userId)
  const { results } = await c.env.DB.prepare(`
    SELECT
      s.*,
      origin.name AS origin_party_name,
      origin.type AS origin_party_type,
      COUNT(si.id) as items_count
    FROM stacks s
    LEFT JOIN stack_items si ON si.stack_id = s.id
    LEFT JOIN parties origin ON origin.id = s.origin_party_id
    WHERE s.user_id = ?
      AND s.deleted_at IS NULL
    GROUP BY s.id
    ORDER BY
      CASE WHEN s.last_opened_at IS NULL THEN 1 ELSE 0 END,
      s.last_opened_at DESC,
      s.created_at DESC
  `).bind(user.userId).all()
  return c.json({ stacks: results })
})

// GET /api/stacks/trash
stacks.get('/trash', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  await purgeExpiredStackTrash(c.env.DB, user.userId)
  const { results } = await c.env.DB.prepare(`
    SELECT s.*, COUNT(si.id) AS items_count
    FROM stacks s
    LEFT JOIN stack_items si ON si.stack_id = s.id
    WHERE s.user_id = ?
      AND s.deleted_at IS NOT NULL
      AND s.delete_purge_after > CURRENT_TIMESTAMP
    GROUP BY s.id
    ORDER BY s.delete_purge_after ASC, s.id DESC
  `).bind(user.userId).all()
  return c.json({ stacks: results })
})

// POST /api/stacks
stacks.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Die gesendeten Angaben sind ungültig. Bitte versuche es erneut.' }, 400)
  }
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name || name.length > 120) return c.json({ error: 'Stack-Name muss zwischen 1 und 120 Zeichen lang sein.' }, 400)
  const description = typeof data.description === 'string' ? data.description.trim() : ''
  if (description.length > 1000) return c.json({ error: 'Die Beschreibung darf höchstens 1000 Zeichen lang sein.' }, 400)
  const rawItems = Array.isArray(data.product_ids) ? data.product_ids : data.products
  const normalized = normalizeStackProductItems(rawItems)
  if (normalized.error || !normalized.items) {
    return c.json({ error: normalized.error ?? 'Die Produktauswahl ist ungültig.' }, 400)
  }
  if (!(await validateStackProductReferences(c.env.DB, user.userId, normalized.items))) {
    return c.json({ error: 'Mindestens ein Produkt ist nicht mehr verfügbar oder gehört nicht zu deinem Konto.' }, 400)
  }

  const [stackId] = await candidateIds(c.env.DB, 'stacks', 1)
  const itemIds = await candidateIds(c.env.DB, 'stack_items', normalized.items.length)
  const itemStatements: D1PreparedStatement[] = [c.env.DB.prepare(`
    INSERT INTO stacks (id, user_id, name, description, version)
    VALUES (?, ?, ?, ?, 1)
  `).bind(stackId, user.userId, name, description || null)]
  for (const [index, item] of normalized.items.entries()) {
    const stackItemId = itemIds[index]
    const dosageInsert = stackItemDosageInsert(item, user.userId)
    itemStatements.push(c.env.DB.prepare(`
      INSERT INTO stack_items (
        id, stack_id, catalog_product_id, user_product_id, quantity,
        intake_interval_days, dosage_text, timing, sort_order,
        amount_source, version
      ) VALUES (?, ?, ?, ?, ?, ?, ${dosageInsert.sql}, ?, ?, 'user', 1)
    `).bind(
      stackItemId,
      stackId,
      item.product_type === 'catalog' ? item.id : null,
      item.product_type === 'user_product' ? item.id : null,
      item.quantity,
      item.intake_interval_days,
      ...dosageInsert.bindings,
      item.timing,
      index,
    ))
    if (item.product_type === 'catalog') {
      const binding = await stackItemBindingStatement(c.env.DB, stackItemId, item.id, null)
      if (binding) itemStatements.push(binding)
    }
  }
  try {
    await c.env.DB.batch(itemStatements)
  } catch {
    return c.json({ error: 'Der Stack konnte nicht vollständig angelegt werden. Bitte versuche es erneut.' }, 409)
  }
  return c.json({ id: stackId, name, description: description || null, version: 1 })
})

// POST /api/stacks/link-report
stacks.post('/link-report', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `product-link-report:${user.userId}`, 10, 3600)
  if (!allowed) return c.json({ error: 'Bitte warte kurz, bevor du weitere Links meldest.' }, 429)

  let data: Record<string, unknown>
  try {
    const parsed = await c.req.json()
    data = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return c.json({ error: 'Die gesendeten Angaben sind ungültig. Bitte versuche es erneut.' }, 400)
  }

  const productId = Number(data.product_id ?? data.productId)
  const productType = normalizeStackProductType(data.product_type ?? data.productType)
  const stackIdRaw = data.stack_id ?? data.stackId
  const stackId = stackIdRaw === undefined || stackIdRaw === null || stackIdRaw === '' ? null : Number(stackIdRaw)
  const reasonRaw = typeof data.reason === 'string' ? data.reason.trim() : 'missing_link'
  const reason = reasonRaw === 'invalid_link' ? 'invalid_link' : 'missing_link'

  if (!Number.isInteger(productId) || productId <= 0 || !productType) {
    return c.json({ error: 'Das zu meldende Produkt konnte nicht eindeutig erkannt werden.' }, 400)
  }
  if (stackId !== null && (!Number.isInteger(stackId) || stackId <= 0)) {
    return c.json({ error: 'Der ausgewählte Stack ist ungültig.' }, 400)
  }
  if (stackId !== null) {
    const stack = await c.env.DB.prepare(
      'SELECT id FROM stacks WHERE id = ? AND user_id = ? AND deleted_at IS NULL'
    ).bind(stackId, user.userId).first<{ id: number }>()
    if (!stack) return c.json({ error: 'Der Stack wurde nicht gefunden.' }, 404)
  }

  const product = productType === 'user_product'
    ? await c.env.DB.prepare(`
        SELECT id, name, shop_link
        FROM user_products
        WHERE id = ? AND user_id = ? AND status IN ('pending', 'approved', 'blocked')
      `).bind(productId, user.userId).first<StackLinkReportProduct>()
    : await c.env.DB.prepare(`
        SELECT id, name, shop_link
        FROM products
        WHERE id = ?
          AND moderation_status = 'approved'
          AND visibility = 'public'
      `).bind(productId).first<StackLinkReportProduct>()

  if (!product) return c.json({ error: 'Das Produkt wurde nicht gefunden.' }, 404)

  await c.env.DB.prepare(`
    INSERT INTO product_link_reports (
      user_id, stack_id, product_type, product_id, product_name, shop_link_snapshot, reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.userId,
    stackId,
    productType,
    product.id,
    product.name,
    product.shop_link,
    reason,
  ).run()

  return c.json({ ok: true })
})

// PUT /api/stacks/:id/items/layout
stacks.put('/:id/items/layout', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const stackId = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ? AND deleted_at IS NULL').bind(stackId).first<StackRow>()
  if (!stack) return c.json({ error: 'Der Stack wurde nicht gefunden.' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Du kannst diesen Stack nicht bearbeiten.' }, 403)

  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Die gesendeten Angaben sind ungültig. Bitte versuche es erneut.' }, 400)
  }

  if (!Array.isArray(data.items)) {
    return c.json({ error: 'Die neue Reihenfolge ist unvollständig.' }, 400)
  }

  const layoutItems: StackLayoutInput[] = []
  const seenStackItemIds = new Set<number>()
  for (const rawItem of data.items) {
    if (!rawItem || typeof rawItem !== 'object') {
      return c.json({ error: 'Mindestens ein Eintrag der Reihenfolge ist ungültig.' }, 400)
    }
    const item = rawItem as Record<string, unknown>
    const stackItemId = Number(item.stack_item_id ?? item.stackItemId)
    const sortOrder = normalizeOptionalSortOrder(item.sort_order ?? item.sortOrder)
    const expectedVersion = Number(item.expected_version ?? item.expectedVersion)

    if (!Number.isInteger(stackItemId) || stackItemId <= 0) {
      return c.json({ error: 'Mindestens ein Produkt im Stack konnte nicht eindeutig erkannt werden.' }, 400)
    }
    if (sortOrder === undefined) {
      return c.json({ error: 'Mindestens eine Position in der Reihenfolge ist ungültig.' }, 400)
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return c.json({ error: 'Die gespeicherte Produktversion ist ungültig. Bitte lade den Stack neu.' }, 400)
    }
    if (seenStackItemIds.has(stackItemId)) {
      return c.json({ error: 'Ein Produkt ist in der neuen Reihenfolge doppelt enthalten.' }, 400)
    }
    seenStackItemIds.add(stackItemId)
    layoutItems.push({
      stack_item_id: stackItemId,
      sort_order: sortOrder,
      expected_version: expectedVersion,
    })
  }

  const { results: stackItems } = await c.env.DB.prepare(`
    SELECT id, version
    FROM stack_items
    WHERE stack_id = ?
    ORDER BY id ASC
  `).bind(stack.id).all<{ id: number; version: number }>()

  if (stackItems.length !== layoutItems.length) {
    return c.json({ error: 'Die Reihenfolge muss jedes Produkt genau einmal enthalten.' }, 400)
  }

  const stackItemIdSet = new Set(stackItems.map((item) => item.id))
  for (const item of layoutItems) {
    if (!stackItemIdSet.has(item.stack_item_id)) {
      return c.json({ error: 'Mindestens ein Produkt gehört nicht zu diesem Stack.' }, 400)
    }
  }
  const versionsById = new Map(stackItems.map((item) => [item.id, item.version]))
  if (layoutItems.some((item) => versionsById.get(item.stack_item_id) !== item.expected_version)) {
    return c.json({ error: 'Die Reihenfolge wurde zwischenzeitlich geändert. Bitte lade den Stack neu.' }, 409)
  }

  if (layoutItems.length > 0) {
    const sortCases = layoutItems.map(() => 'WHEN ? THEN ?').join(' ')
    const versionPairs = layoutItems.map(() => '(id = ? AND version = ?)').join(' OR ')
    const itemIds = layoutItems.map(() => '?').join(', ')
    const sortBindings = layoutItems.flatMap((item) => [item.stack_item_id, item.sort_order])
    const versionBindings = layoutItems.flatMap((item) => [item.stack_item_id, item.expected_version])
    const result = await c.env.DB.prepare(`
      UPDATE stack_items
      SET sort_order = CASE id ${sortCases} ELSE sort_order END,
          version = version + 1
      WHERE stack_id = ?
        AND (SELECT COUNT(*) FROM stack_items WHERE stack_id = ?) = ?
        AND (SELECT COUNT(*) FROM stack_items WHERE stack_id = ? AND (${versionPairs})) = ?
        AND id IN (${itemIds})
    `).bind(
      ...sortBindings,
      stack.id,
      stack.id,
      layoutItems.length,
      stack.id,
      ...versionBindings,
      layoutItems.length,
      ...layoutItems.map((item) => item.stack_item_id),
    ).run()
    if ((result.meta.changes ?? 0) !== layoutItems.length) {
      return c.json({ error: 'Die Reihenfolge wurde zwischenzeitlich geändert. Bitte lade den Stack neu.' }, 409)
    }
  }

  const items = await loadStackItemsWithIngredients(c.env.DB, stack.id, stack.user_id)
  const ingredientTotals = aggregateStackIngredientTotals(items)
  return c.json({ items, ingredient_totals: ingredientTotals })
})

// GET /api/stacks/:id
stacks.get('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const stack = await c.env.DB.prepare(`
    SELECT s.*, origin.name AS origin_party_name, origin.type AS origin_party_type
    FROM stacks s
    LEFT JOIN parties origin ON origin.id = s.origin_party_id
    WHERE s.id = ?
      AND s.deleted_at IS NULL
  `).bind(c.req.param('id')).first<StackRow>()
  if (!stack) return c.json({ error: 'Der Stack wurde nicht gefunden.' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Du kannst diesen Stack nicht öffnen.' }, 403)
  const items = await loadStackItemsWithIngredients(c.env.DB, stack.id, stack.user_id)
  const total = items.reduce((sum, i) => sum + i.product_price, 0)
  const ingredientTotals = aggregateStackIngredientTotals(items)
  return c.json({ stack, items, total, ingredient_totals: ingredientTotals })
})

// POST /api/stacks/:id/email
stacks.post('/:id/email', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `stack-email:${user.userId}`, 5, 3600)
  if (!allowed) return c.json({ error: 'Bitte warte kurz, bevor du weitere Stack-Mails versendest.' }, 429)

  const id = c.req.param('id')
  const stack = await c.env.DB.prepare(`
    SELECT s.*, origin.name AS origin_party_name
    FROM stacks s
    LEFT JOIN parties origin ON origin.id = s.origin_party_id
    WHERE s.id = ? AND s.deleted_at IS NULL
  `).bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Der Stack wurde nicht gefunden.' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Du kannst diesen Stack nicht öffnen.' }, 403)

  const items = await loadStackItems(c.env.DB, stack.id, stack.user_id) as unknown as StackMailItem[]
  const ingredients = await loadStackMailIngredients(c.env.DB, stack.id, stack.user_id)
  const ingredientsByItem = groupIngredientsByStackItem(ingredients)
  const warningsByItem = await loadStackMailWarnings(c.env.DB, ingredientsByItem)
  const preparedItems = prepareMailItems(items, ingredientsByItem, warningsByItem)
  const itemIngredients = items.map((item) => ({
    ...item,
    ingredients: ingredientsByItem.get(item.stack_item_id) ?? [],
  }))
  const ingredientTotals = aggregateStackIngredientTotals(itemIngredients)
  const totalOnce = preparedItems.reduce((sum, item) => sum + item.product_price, 0)
  const totalMonthly = preparedItems.reduce((sum, item) => sum + (item.monthlyCost ?? 0), 0)
  const result = await sendMail(c.env, {
    to: user.email,
    subject: `Dein Supplement Stack: ${stack.name}`,
    html: buildStackEmailHtml(
      stack,
      preparedItems,
      totalOnce,
      totalMonthly,
      ingredientTotals,
      new URL(c.req.url).origin,
    ),
  })

  if (!result.ok) {
    console.error('[stacks] stack mail failed:', result.error)
    return c.json({ error: 'E-Mail konnte nicht gesendet werden.' }, 500)
  }
  await recordStackEmailEvent(c.env.DB, user.userId, stack.id, 'single_stack', 1, user.email)
  return c.json({ ok: true })
})

// POST /api/stacks/:id/restore
stacks.post('/:id/restore', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare(`
    SELECT * FROM stacks
    WHERE id = ? AND deleted_at IS NOT NULL
  `).bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Stack wurde im Papierkorb nicht gefunden.' }, 404)
  if (stack.user_id !== user.userId) {
    return c.json({ error: 'Du kannst diesen Stack nicht wiederherstellen.' }, 403)
  }

  if (!stack.delete_purge_after || Date.parse(`${stack.delete_purge_after.replace(' ', 'T')}Z`) <= Date.now()) {
    const purged = await c.env.DB.prepare(`
      DELETE FROM stacks
      WHERE id = ? AND user_id = ? AND version = ?
        AND deleted_at = ? AND delete_purge_after = ?
        AND delete_purge_after <= CURRENT_TIMESTAMP
    `).bind(
      id,
      user.userId,
      stack.version,
      stack.deleted_at,
      stack.delete_purge_after,
    ).run()
    if ((purged.meta.changes ?? 0) !== 1) {
      const remaining = await c.env.DB.prepare(`
        SELECT id FROM stacks WHERE id = ? AND user_id = ?
      `).bind(id, user.userId).first<{ id: number }>()
      if (remaining) {
        return c.json({ error: 'Der Papierkorb wurde zwischenzeitlich geändert. Bitte lade ihn neu.' }, 409)
      }
    }
    return c.json({ error: 'Die Wiederherstellungsfrist ist abgelaufen.' }, 410)
  }

  const restored = await c.env.DB.prepare(`
    UPDATE stacks
    SET deleted_at = NULL,
        delete_purge_after = NULL,
        version = version + 1
    WHERE id = ?
      AND user_id = ?
      AND version = ?
      AND deleted_at = ?
      AND delete_purge_after = ?
  `).bind(
    id,
    user.userId,
    stack.version,
    stack.deleted_at,
    stack.delete_purge_after,
  ).run()
  if ((restored.meta.changes ?? 0) !== 1) {
    return c.json({ error: 'Der Stack wurde zwischenzeitlich geändert. Bitte lade den Papierkorb neu.' }, 409)
  }
  return c.json({ ok: true, restored: true })
})

// DELETE /api/stacks/:id — move to the seven-day trash, never purge directly.
stacks.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Der Stack wurde nicht gefunden.' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Du kannst diesen Stack nicht bearbeiten.' }, 403)
  if (stack.deleted_at) {
    return c.json({ ok: true, trashed: true, purge_after: stack.delete_purge_after })
  }
  const trashed = await c.env.DB.prepare(`
    UPDATE stacks
    SET deleted_at = CURRENT_TIMESTAMP,
        delete_purge_after = datetime(CURRENT_TIMESTAMP, '+7 days'),
        version = version + 1
    WHERE id = ?
      AND user_id = ?
      AND version = ?
      AND deleted_at IS NULL
  `).bind(id, user.userId, stack.version).run()
  if ((trashed.meta.changes ?? 0) !== 1) {
    return c.json({ error: 'Der Stack wurde zwischenzeitlich geändert. Bitte lade die Seite neu.' }, 409)
  }
  const current = await c.env.DB.prepare(`
    SELECT delete_purge_after FROM stacks WHERE id = ? AND user_id = ?
  `).bind(id, user.userId).first<{ delete_purge_after: string }>()
  return c.json({ ok: true, trashed: true, purge_after: current?.delete_purge_after ?? null })
})

// PUT /api/stacks/:id
stacks.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ? AND deleted_at IS NULL').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Der Stack wurde nicht gefunden.' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Du kannst diesen Stack nicht öffnen.' }, 403)
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Die gesendeten Angaben sind ungültig. Bitte versuche es erneut.' }, 400)
  }

  const name = typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : null
  if (data.name !== undefined && (name === null || name.length > 120)) {
    return c.json({ error: 'Stack-Name muss zwischen 1 und 120 Zeichen lang sein.' }, 400)
  }
  const hasDescription = data.description !== undefined
  const description = typeof data.description === 'string' ? data.description.trim() : ''
  if (hasDescription && description.length > 1000) {
    return c.json({ error: 'Die Beschreibung darf höchstens 1000 Zeichen lang sein.' }, 400)
  }
  const expectedStackVersion = data.expected_stack_version === undefined
    ? null
    : Number(data.expected_stack_version)
  if (expectedStackVersion !== null && (!Number.isInteger(expectedStackVersion) || expectedStackVersion < 1)) {
    return c.json({ error: 'Die gespeicherte Stack-Version ist ungültig. Bitte lade den Stack neu.' }, 400)
  }
  if (expectedStackVersion !== null && expectedStackVersion !== stack.version) {
    return c.json({ error: 'Der Stack wurde zwischenzeitlich geändert. Bitte lade ihn neu.' }, 409)
  }

  let normalizedItems: StackProductInput[] | null = null
  const existingLayoutByProductKey = new Map<string, {
    stack_item_id: number
    sort_order: number
    version: number
    has_binding: number
    quantity: number
    intake_interval_days: number
    dosage_text: string | null
    timing: string | null
    amount_source: string | null
  }>()
  let existingItemRows: Array<{
    stack_item_id: number
    sort_order: number
    version: number
    has_binding: number
    quantity: number
    intake_interval_days: number
    dosage_text: string | null
    timing: string | null
    amount_source: string | null
    product_type: StackProductType
    product_id: number
  }> = []
  let nextFallbackSortOrder = 0
  if (data.product_ids !== undefined) {
    const normalized = normalizeStackProductItems(data.product_ids)
    if (normalized.error || !normalized.items) {
      return c.json({ error: normalized.error ?? 'Die Produktauswahl ist ungültig.' }, 400)
    }
    if (!(await validateStackProductReferences(c.env.DB, stack.user_id, normalized.items))) {
      return c.json({ error: 'Mindestens ein Produkt ist nicht mehr verfügbar oder gehört nicht zu deinem Konto.' }, 400)
    }
    const { results: existingLayoutRows } = await c.env.DB.prepare(`
      SELECT
        stack_items.id AS stack_item_id,
        stack_items.sort_order,
        stack_items.version,
        stack_items.quantity,
        stack_items.intake_interval_days,
        stack_items.dosage_text,
        stack_items.timing,
        stack_items.amount_source,
        CASE WHEN binding.stack_item_id IS NULL THEN 0 ELSE 1 END AS has_binding,
        CASE
          WHEN stack_items.catalog_product_id IS NOT NULL THEN 'catalog'
          ELSE 'user_product'
        END AS product_type,
        COALESCE(stack_items.catalog_product_id, stack_items.user_product_id) AS product_id
      FROM stack_items
      LEFT JOIN stack_item_link_bindings binding ON binding.stack_item_id = stack_items.id
      WHERE stack_items.stack_id = ?
      ORDER BY stack_items.sort_order ASC, stack_items.id ASC
    `).bind(id).all<typeof existingItemRows[number]>()
    existingItemRows = existingLayoutRows
    if (data.expected_items !== undefined) {
      if (!Array.isArray(data.expected_items) || data.expected_items.length !== existingItemRows.length) {
        return c.json({ error: 'Der Stack wurde zwischenzeitlich geändert. Bitte lade ihn neu.' }, 409)
      }
      const expectedVersions = new Map<number, number>()
      for (const rawExpected of data.expected_items) {
        if (!rawExpected || typeof rawExpected !== 'object') {
          return c.json({ error: 'Die gespeicherten Produktangaben sind ungültig. Bitte lade den Stack neu.' }, 400)
        }
        const expected = rawExpected as Record<string, unknown>
        const stackItemId = Number(expected.stack_item_id ?? expected.stackItemId)
        const version = Number(expected.expected_version ?? expected.expectedVersion)
        if (!Number.isInteger(stackItemId) || stackItemId <= 0 || !Number.isInteger(version) || version < 1 || expectedVersions.has(stackItemId)) {
          return c.json({ error: 'Die gespeicherten Produktversionen sind ungültig. Bitte lade den Stack neu.' }, 400)
        }
        expectedVersions.set(stackItemId, version)
      }
      if (existingItemRows.some((item) => expectedVersions.get(item.stack_item_id) !== item.version)) {
        return c.json({ error: 'Der Stack wurde zwischenzeitlich geändert. Bitte lade ihn neu.' }, 409)
      }
    }
    for (const existing of existingLayoutRows) {
      const productKey = `${existing.product_type}:${existing.product_id}`
      if (!existingLayoutByProductKey.has(productKey)) {
        existingLayoutByProductKey.set(productKey, {
          stack_item_id: existing.stack_item_id,
          sort_order: existing.sort_order,
          version: existing.version,
          has_binding: existing.has_binding,
          quantity: existing.quantity,
          intake_interval_days: existing.intake_interval_days,
          dosage_text: existing.dosage_text,
          timing: existing.timing,
          amount_source: existing.amount_source,
        })
      }
    }
    nextFallbackSortOrder = existingLayoutRows.reduce(
      (maxSortOrder, existing) => Math.max(maxSortOrder, existing.sort_order),
      -1,
    ) + 1
    normalizedItems = normalized.items
  }

  const mutationRequested = name !== null || hasDescription || normalizedItems !== null
  const statements: D1PreparedStatement[] = []
  const claimedVersion = stack.version + 1
  const claimToken = crypto.randomUUID()
  const claim = { stackId: id, userId: stack.user_id, version: claimedVersion, token: claimToken }
  if (mutationRequested) {
    let itemGuardSql = ''
    const itemGuardBindings: Array<string | number> = []
    if (normalizedItems !== null) {
      if (existingItemRows.length === 0) {
        itemGuardSql = 'AND NOT EXISTS (SELECT 1 FROM stack_items WHERE stack_id = stacks.id)'
      } else {
        const itemVersions = existingItemRows.map(() => '(id = ? AND version = ?)').join(' OR ')
        itemGuardSql = `
          AND (SELECT COUNT(*) FROM stack_items WHERE stack_id = stacks.id) = ?
          AND (
            SELECT COUNT(*) FROM stack_items
            WHERE stack_id = stacks.id AND (${itemVersions})
          ) = ?
        `
        itemGuardBindings.push(
          existingItemRows.length,
          ...existingItemRows.flatMap((item) => [item.stack_item_id, item.version]),
          existingItemRows.length,
        )
      }
    }
    statements.push(c.env.DB.prepare(`
      UPDATE stacks
      SET name = ?, description = ?, version = version + 1, write_claim_token = ?
      WHERE id = ? AND user_id = ? AND version = ? AND deleted_at IS NULL
      ${itemGuardSql}
    `).bind(
      name ?? stack.name,
      hasDescription ? (description || null) : (stack.description ?? null),
      claimToken,
      id,
      stack.user_id,
      stack.version,
      ...itemGuardBindings,
    ))
  }
  if (normalizedItems !== null) {
    const retainedIds = new Set<number>()
    const newItems = normalizedItems.filter((item) => !existingLayoutByProductKey.has(`${item.product_type}:${item.id}`))
    const newItemIds = await candidateIds(c.env.DB, 'stack_items', newItems.length)
    let newItemIndex = 0
    for (const item of normalizedItems) {
      const productKey = `${item.product_type}:${item.id}`
      const existingLayout = existingLayoutByProductKey.get(productKey)
      const sortOrder = item.sort_order ?? existingLayout?.sort_order ?? nextFallbackSortOrder++
      if (existingLayout) {
        retainedIds.add(existingLayout.stack_item_id)
        const dosageText = item.dosage_text === undefined
          ? existingLayout.dosage_text
          : item.dosage_text
        const amountChanged = existingLayout.quantity !== item.quantity
          || existingLayout.intake_interval_days !== item.intake_interval_days
          || existingLayout.dosage_text !== dosageText
          || existingLayout.timing !== item.timing
        statements.push(c.env.DB.prepare(`
          UPDATE stack_items
          SET quantity = ?, intake_interval_days = ?, dosage_text = ?, timing = ?,
              sort_order = ?, amount_source = ?, version = version + 1
          WHERE id = ? AND stack_id = ? AND version = ?
            AND EXISTS (
              SELECT 1 FROM stacks
              WHERE id = ? AND user_id = ? AND version = ?
                AND write_claim_token = ? AND deleted_at IS NULL
            )
        `).bind(
          item.quantity,
          item.intake_interval_days,
          dosageText,
          item.timing,
          sortOrder,
          amountChanged ? 'user' : existingLayout.amount_source,
          existingLayout.stack_item_id,
          id,
          existingLayout.version,
          id,
          stack.user_id,
          claimedVersion,
          claimToken,
        ))
        if (item.product_type === 'catalog' && existingLayout.has_binding === 0) {
          const binding = await stackItemBindingStatement(
            c.env.DB,
            existingLayout.stack_item_id,
            item.id,
            stack.origin_party_id ?? null,
            claim,
          )
          if (binding) statements.push(binding)
        }
        continue
      }

      const stackItemId = newItemIds[newItemIndex++]
      const dosageInsert = stackItemDosageInsert(item, stack.user_id)
      statements.push(c.env.DB.prepare(`
        INSERT INTO stack_items (
          id, stack_id, catalog_product_id, user_product_id, quantity,
          intake_interval_days, dosage_text, timing, sort_order,
          amount_source, version
        )
        SELECT ?, ?, ?, ?, ?, ?, ${dosageInsert.sql}, ?, ?, 'user', 1
        WHERE EXISTS (
          SELECT 1 FROM stacks
          WHERE id = ? AND user_id = ? AND version = ?
            AND write_claim_token = ? AND deleted_at IS NULL
        )
      `).bind(
        stackItemId,
        id,
        item.product_type === 'catalog' ? item.id : null,
        item.product_type === 'user_product' ? item.id : null,
        item.quantity,
        item.intake_interval_days,
        ...dosageInsert.bindings,
        item.timing,
        sortOrder,
        id,
        stack.user_id,
        claimedVersion,
        claimToken,
      ))
      if (item.product_type === 'catalog') {
        const binding = await stackItemBindingStatement(
          c.env.DB,
          stackItemId,
          item.id,
          stack.origin_party_id ?? null,
          claim,
        )
        if (binding) statements.push(binding)
      }
    }
    for (const existing of existingItemRows) {
      if (!retainedIds.has(existing.stack_item_id)) {
        statements.push(c.env.DB.prepare(`
          DELETE FROM stack_items
          WHERE id = ? AND stack_id = ? AND version = ?
            AND EXISTS (
              SELECT 1 FROM stacks
              WHERE id = ? AND user_id = ? AND version = ?
                AND write_claim_token = ? AND deleted_at IS NULL
            )
        `).bind(
          existing.stack_item_id,
          id,
          existing.version,
          id,
          stack.user_id,
          claimedVersion,
          claimToken,
        ))
      }
    }
  }
  if (statements.length > 0) {
    let results: D1Result[]
    try {
      results = await c.env.DB.batch(statements)
    } catch {
      return c.json({ error: 'Der Stack wurde zwischenzeitlich geändert. Bitte lade ihn neu.' }, 409)
    }
    if ((results[0]?.meta.changes ?? 0) !== 1) {
      return c.json({ error: 'Der Stack wurde zwischenzeitlich geändert. Bitte lade ihn neu.' }, 409)
    }
  }
  const updated = await c.env.DB.prepare(`
    SELECT s.*, origin.name AS origin_party_name, origin.type AS origin_party_type
    FROM stacks s
    LEFT JOIN parties origin ON origin.id = s.origin_party_id
    WHERE s.id = ? AND s.deleted_at IS NULL
  `).bind(id).first()
  const items = await loadStackItemsWithIngredients(c.env.DB, id, stack.user_id)
  const ingredientTotals = aggregateStackIngredientTotals(items)
  return c.json({ stack: updated, items, ingredient_totals: ingredientTotals })
})

export default stacks

// ---------------------------------------------------------------------------
// Stack warnings sub-app (mounted at /api/stack-warnings)
// ---------------------------------------------------------------------------

export const stackWarningsApp = new Hono<AppContext>()

// GET /api/stack-warnings/:id
stackWarningsApp.get('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ? AND deleted_at IS NULL').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Der Stack wurde nicht gefunden.' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Du kannst diesen Stack nicht öffnen.' }, 403)
  const { results: items } = await c.env.DB.prepare(
    `SELECT *
     FROM (
       SELECT
         si.id AS stack_item_id,
         si.catalog_product_id AS product_id,
         'catalog' AS product_type,
         pi.ingredient_id,
         pi.parent_ingredient_id
       FROM stack_items si
       JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id
       WHERE si.stack_id = ?
         AND si.catalog_product_id IS NOT NULL
         AND pi.search_relevant = 1

       UNION ALL

       SELECT
         si.id AS stack_item_id,
         si.user_product_id AS product_id,
         'user_product' AS product_type,
         upi.ingredient_id,
         upi.parent_ingredient_id
       FROM stack_items si
       JOIN user_products up ON up.id = si.user_product_id AND up.user_id = ?
       JOIN user_product_ingredients upi ON upi.user_product_id = up.id
       WHERE si.stack_id = ?
         AND si.user_product_id IS NOT NULL
         AND upi.search_relevant = 1
     )
     ORDER BY stack_item_id ASC`
  ).bind(id, stack.user_id, id).all<{
    stack_item_id: number
    product_id: number
    product_type: StackProductType
    ingredient_id: number
    parent_ingredient_id: number | null
  }>()

  const rowsByProduct = new Map<string, typeof items>()
  for (const item of items) {
    const key = `${item.product_type}:${item.product_id}`
    const rows = rowsByProduct.get(key) ?? []
    rows.push(item)
    rowsByProduct.set(key, rows)
  }

  const effectiveIngredientIds = new Set<number>()
  for (const rows of rowsByProduct.values()) {
    const parentIdsWithChildRows = new Set(
      rows
        .map((row) => row.parent_ingredient_id)
        .filter((parentId): parentId is number => parentId !== null),
    )

    for (const row of rows) {
      if (row.parent_ingredient_id !== null) {
        effectiveIngredientIds.add(row.ingredient_id)
        continue
      }
      if (!parentIdsWithChildRows.has(row.ingredient_id)) {
        effectiveIngredientIds.add(row.ingredient_id)
      }
    }
  }

  const ingredientIds = [...effectiveIngredientIds]
  if (ingredientIds.length < 2) return c.json({ warnings: [] })

  const placeholders = ingredientIds.map(() => '?').join(',')
  const { results: warnings } = await c.env.DB.prepare(`
    SELECT
      id,
      ingredient_id AS ingredient_a_id,
      partner_ingredient_id AS ingredient_b_id,
      type,
      comment
    FROM interactions
    WHERE is_active = 1
      AND partner_type = 'ingredient'
      AND partner_ingredient_id IS NOT NULL
      AND ingredient_id IN (${placeholders})
      AND partner_ingredient_id IN (${placeholders})
      AND ingredient_id <> partner_ingredient_id
    ORDER BY id
  `).bind(...ingredientIds, ...ingredientIds).all<InteractionRow>()
  return c.json({ warnings })
})
