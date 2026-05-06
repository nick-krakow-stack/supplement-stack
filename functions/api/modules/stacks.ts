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
import { loadCatalogProductSafetyWarnings, loadUserProductSafetyWarnings } from './knowledge'

const stacks = new Hono<AppContext>()

type StackProductType = 'catalog' | 'user_product'

type StackProductInput = {
  id: number
  product_type: StackProductType
  quantity: number
  intake_interval_days: number
  dosage_text: string | null
  timing: string | null
}

type StackProductValidation = {
  items?: StackProductInput[]
  error?: string
}

type StackLinkReportProduct = {
  id: number
  name: string
  shop_link: string | null
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
  is_affiliate: number | null
  quantity: number
  intake_interval_days: number
  serving_size: number | null
  serving_unit: string | null
  servings_per_container: number | null
  container_count: number | null
  timing: string | null
  dosage_text: string | null
}

type StackMailIngredient = {
  stack_item_id: number
  ingredient_id: number
  ingredient_name: string
  parent_ingredient_id: number | null
  quantity: number | null
  unit: string | null
  basis_quantity: number | null
  basis_unit: string | null
  search_relevant: number
}

type StackItemResponseIngredient = Pick<StackMailIngredient, 'ingredient_id' | 'quantity' | 'unit' | 'basis_quantity' | 'basis_unit' | 'search_relevant'>

type StackMailPreparedItem = StackMailItem & {
  dailyAmountLabel: string
  dailyIngredientLabels: string[]
  intakeIntervalLabel: string
  daysSupply: number | null
  monthlyCost: number | null
  warningLabels: string[]
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

function parseGermanNumber(value: string): number | null {
  const trimmed = value.trim()
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(trimmed)
      ? trimmed.replace(/\./g, '')
      : trimmed
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseDoseFromText(text?: string | null): { value: number; unit: string } | null {
  if (!text) return null
  const match = /(\d+(?:[.,]\d{1,3})?(?:\.\d{3})*)\s*(IE|IU|µg|μg|ug|mcg|mg|g|Kapseln?|Tabletten?|Tropfen|Softgels?|Portionen?)/i.exec(text)
  if (!match) return null
  const value = parseGermanNumber(match[1])
  return value ? { value, unit: match[2] } : null
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

function normalizeFamilyMemberId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function formatIntakeInterval(days: number): string {
  return days <= 1 ? 'täglich' : `alle ${days} Tage`
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
      .map((ingredient) => {
        const amountPerServing = ingredientAmountPerProductServing(ingredient, item) ?? ingredient.quantity ?? 0
        return `${ingredient.ingredient_name}: ${formatDailyUnit(amountPerServing * usage.servingsPerIntake, ingredient.unit)}/Einnahmetag`
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

function buildStackEmailHtml(stack: StackRow, items: StackMailPreparedItem[], totalOnce: number, totalMonthly: number): string {
  const rows = items.map((item) => {
    const productImage = item.image_url
      ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;background:#f8fafc;">`
      : `<div style="width:56px;height:56px;border-radius:10px;border:1px solid #e5e7eb;background:#f8fafc;text-align:center;line-height:56px;color:#94a3b8;font-size:18px;font-weight:800;">SS</div>`
    const buyButton = item.shop_link
      ? `<a href="${escapeHtml(item.shop_link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:9px 12px;white-space:nowrap;">Jetzt kaufen</a>`
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
        </td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">${ingredientText}</td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(item.dailyAmountLabel)}</strong>
          ${item.dosage_text ? `<br><span style="color:#64748b;">Ziel: ${escapeHtml(item.dosage_text)}</span>` : ''}
          <br><span style="color:#64748b;">Intervall: ${escapeHtml(item.intakeIntervalLabel)}</span>
          ${item.daysSupply ? `<br><span style="color:#64748b;">reicht ca. ${item.daysSupply} Tage</span>` : ''}
        </td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.timing ?? '-')}</td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;">${warnings}</td>
        <td style="padding:14px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">
          <strong>${formatEuro(item.product_price)}</strong>
          <br><span style="color:#64748b;">${item.monthlyCost != null ? `${formatEuro(item.monthlyCost)}/Monat` : '-'}</span>
          <br><br>${buyButton}
        </td>
      </tr>
    `
  }).join('')

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;line-height:1.5;">
      <h1 style="font-size:22px;margin:0 0 8px;">${escapeHtml(stack.name)}</h1>
      <p style="margin:0 0 18px;color:#64748b;">Dein Supplement-Stack aus Supplement Stack.</p>
      <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <strong>Einmaliger Kaufpreis:</strong> ${formatEuro(totalOnce)}
        <br><strong>Geschätzte Monatskosten:</strong> ${formatEuro(totalMonthly)}
      </div>
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
    const dosageText = typeof item.dosage_text === 'string' && item.dosage_text.trim() !== ''
      ? item.dosage_text.trim()
      : null
    const timing = typeof item.timing === 'string' && item.timing.trim() !== ''
      ? item.timing.trim()
      : null

    if (!Number.isInteger(id) || id <= 0) {
      return { error: 'product_ids must reference valid products' }
    }
    if (productType === null) {
      return { error: 'product_type must be catalog or user_product' }
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: 'quantity must be greater than 0' }
    }
    if (intakeIntervalDays === null) {
      return { error: 'intake_interval_days must be an integer greater than or equal to 1' }
    }
    const productKey = `${productType}:${id}`
    if (seenProducts.has(productKey)) {
      return { error: 'product_ids must not contain duplicate products' }
    }
    seenProducts.add(productKey)

    items.push({ id, product_type: productType, quantity, intake_interval_days: intakeIntervalDays, dosage_text: dosageText, timing })
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
        AND status IN ('pending', 'approved')
    `).bind(...userProductIds, userId).first<{ count: number }>()
    if ((row?.count ?? 0) !== userProductIds.length) return false
  }

  return true
}

async function familyMemberBelongsToUser(db: D1Database, userId: number, familyMemberId: number | null): Promise<boolean> {
  if (familyMemberId === null) return true
  const row = await db.prepare(
    'SELECT id FROM family_profiles WHERE id = ? AND user_id = ?'
  ).bind(familyMemberId, userId).first<{ id: number }>()
  return Boolean(row)
}

async function loadStackItems(
  db: D1Database,
  stackId: number | string,
  ownerUserId: number,
): Promise<StackItemRow[]> {
  const { results } = await db.prepare(`
    SELECT *
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
        p.is_affiliate,
        p.discontinued_at,
        p.serving_size,
        p.serving_unit,
        p.servings_per_container,
        p.container_count,
        COALESCE(si.timing, idp_form.timing, idp_base.timing, p.timing) AS timing,
        COALESCE(si.dosage_text, p.dosage_text) AS dosage_text,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS ingredient_effect_summary,
        COALESCE(idp_form.timing, idp_base.timing) AS ingredient_timing,
        COALESCE(idp_form.timing_note, idp_base.timing_note) AS ingredient_timing_note,
        COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS ingredient_intake_hint,
        p.warning_title,
        p.warning_message,
        p.warning_type,
        p.alternative_note,
        si.quantity,
        si.intake_interval_days
      FROM stack_items si
      JOIN products p ON p.id = si.catalog_product_id
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
       AND idp_form.sub_ingredient_id IS NULL
      LEFT JOIN ingredient_display_profiles idp_base
        ON idp_base.ingredient_id = pi_main.ingredient_id
       AND idp_base.form_id IS NULL
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
        COALESCE(si.dosage_text, up.dosage_text) AS dosage_text,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS ingredient_effect_summary,
        COALESCE(idp_form.timing, idp_base.timing) AS ingredient_timing,
        COALESCE(idp_form.timing_note, idp_base.timing_note) AS ingredient_timing_note,
        COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS ingredient_intake_hint,
        up.warning_title,
        up.warning_message,
        up.warning_type,
        up.alternative_note,
        si.quantity,
        si.intake_interval_days
      FROM stack_items si
      JOIN user_products up ON up.id = si.user_product_id AND up.user_id = ?
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
       AND idp_form.sub_ingredient_id IS NULL
      LEFT JOIN ingredient_display_profiles idp_base
        ON idp_base.ingredient_id = upi_main.ingredient_id
       AND idp_base.form_id IS NULL
       AND idp_base.sub_ingredient_id IS NULL
      WHERE si.stack_id = ?
        AND si.user_product_id IS NOT NULL
    )
    ORDER BY stack_item_id ASC
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
  `).bind(stackId, ownerUserId, stackId).all<StackMailIngredient>()
  return results
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
): Promise<Array<StackItemRow & { ingredients: StackItemResponseIngredient[] }>> {
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
    const typedItem = item as StackItemRow & { stack_item_id: number; product_type?: StackProductType }
    const stackItemId = typedItem.stack_item_id
    const warnings = typedItem.product_type === 'user_product'
      ? userWarnings.get(item.id) ?? []
      : catalogWarnings.get(item.id) ?? []
    return {
      ...item,
      warnings,
      ingredients: (ingredientsByItem.get(stackItemId) ?? []).map((ingredient) => ({
        ingredient_id: ingredient.ingredient_id,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        basis_quantity: ingredient.basis_quantity,
        basis_unit: ingredient.basis_unit,
        search_relevant: ingredient.search_relevant,
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

// GET /api/stacks
stacks.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT
      s.*,
      fp.first_name AS family_member_first_name,
      COUNT(si.id) as items_count
    FROM stacks s
    LEFT JOIN stack_items si ON si.stack_id = s.id
    LEFT JOIN family_profiles fp ON fp.id = s.family_member_id AND fp.user_id = s.user_id
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
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
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (!data.name) return c.json({ error: 'Stack-Name ist erforderlich' }, 400)
  const hasFamilyMemberInput = data.family_member_id !== undefined || data.familyMemberId !== undefined
  const familyMemberId = hasFamilyMemberInput
    ? normalizeFamilyMemberId(data.family_member_id ?? data.familyMemberId)
    : null
  if (familyMemberId === undefined) return c.json({ error: 'family_member_id must be null or a valid family profile id' }, 400)
  if (!(await familyMemberBelongsToUser(c.env.DB, user.userId, familyMemberId))) {
    return c.json({ error: 'Family profile not found' }, 404)
  }
  const rawItems = Array.isArray(data.product_ids) ? data.product_ids : data.products
  const normalized = normalizeStackProductItems(rawItems)
  if (normalized.error || !normalized.items) {
    return c.json({ error: normalized.error ?? 'Invalid product_ids' }, 400)
  }
  if (!(await validateStackProductReferences(c.env.DB, user.userId, normalized.items))) {
    return c.json({ error: 'Stacks can only use public catalog products or your own pending/approved products' }, 400)
  }

  const stackResult = await c.env.DB.prepare(
    'INSERT INTO stacks (user_id, name, family_member_id) VALUES (?, ?, ?)'
  ).bind(user.userId, data.name, familyMemberId).run()
  const stackId = stackResult.meta.last_row_id

  for (const item of normalized.items) {
    await c.env.DB.prepare(
      'INSERT INTO stack_items (stack_id, catalog_product_id, user_product_id, quantity, intake_interval_days, dosage_text, timing) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      stackId,
      item.product_type === 'catalog' ? item.id : null,
      item.product_type === 'user_product' ? item.id : null,
      item.quantity,
      item.intake_interval_days,
      item.dosage_text,
      item.timing,
    ).run()
  }
  return c.json({ id: stackId, name: data.name, family_member_id: familyMemberId })
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
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const productId = Number(data.product_id ?? data.productId)
  const productType = normalizeStackProductType(data.product_type ?? data.productType)
  const stackIdRaw = data.stack_id ?? data.stackId
  const stackId = stackIdRaw === undefined || stackIdRaw === null || stackIdRaw === '' ? null : Number(stackIdRaw)
  const reasonRaw = typeof data.reason === 'string' ? data.reason.trim() : 'missing_link'
  const reason = reasonRaw === 'invalid_link' ? 'invalid_link' : 'missing_link'

  if (!Number.isInteger(productId) || productId <= 0 || !productType) {
    return c.json({ error: 'product_id and product_type are required' }, 400)
  }
  if (stackId !== null && (!Number.isInteger(stackId) || stackId <= 0)) {
    return c.json({ error: 'stack_id must be a valid stack id' }, 400)
  }
  if (stackId !== null) {
    const stack = await c.env.DB.prepare(
      'SELECT id FROM stacks WHERE id = ? AND user_id = ?'
    ).bind(stackId, user.userId).first<{ id: number }>()
    if (!stack) return c.json({ error: 'Stack not found' }, 404)
  }

  const product = productType === 'user_product'
    ? await c.env.DB.prepare(`
        SELECT id, name, shop_link
        FROM user_products
        WHERE id = ? AND user_id = ? AND status IN ('pending', 'approved')
      `).bind(productId, user.userId).first<StackLinkReportProduct>()
    : await c.env.DB.prepare(`
        SELECT id, name, shop_link
        FROM products
        WHERE id = ?
          AND moderation_status = 'approved'
          AND visibility = 'public'
      `).bind(productId).first<StackLinkReportProduct>()

  if (!product) return c.json({ error: 'Product not found' }, 404)

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

// GET /api/stacks/:id
stacks.get('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const stack = await c.env.DB.prepare(`
    SELECT s.*, fp.first_name AS family_member_first_name
    FROM stacks s
    LEFT JOIN family_profiles fp ON fp.id = s.family_member_id AND fp.user_id = s.user_id
    WHERE s.id = ?
  `).bind(c.req.param('id')).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  const items = await loadStackItemsWithIngredients(c.env.DB, stack.id, stack.user_id)
  const total = items.reduce((sum, i) => sum + i.product_price, 0)
  return c.json({ stack, items, total })
})

// POST /api/stacks/:id/email
stacks.post('/:id/email', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `stack-email:${user.userId}`, 5, 3600)
  if (!allowed) return c.json({ error: 'Bitte warte kurz, bevor du weitere Stack-Mails versendest.' }, 429)

  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  const items = await loadStackItems(c.env.DB, stack.id, stack.user_id) as unknown as StackMailItem[]
  const ingredients = await loadStackMailIngredients(c.env.DB, stack.id, stack.user_id)
  const ingredientsByItem = groupIngredientsByStackItem(ingredients)
  const warningsByItem = await loadStackMailWarnings(c.env.DB, ingredientsByItem)
  const preparedItems = prepareMailItems(items, ingredientsByItem, warningsByItem)
  const totalOnce = preparedItems.reduce((sum, item) => sum + item.product_price, 0)
  const totalMonthly = preparedItems.reduce((sum, item) => sum + (item.monthlyCost ?? 0), 0)
  const result = await sendMail(c.env, {
    to: user.email,
    subject: `Dein Supplement Stack: ${stack.name}`,
    html: buildStackEmailHtml(stack, preparedItems, totalOnce, totalMonthly),
  })

  if (!result.ok) return c.json({ error: 'E-Mail konnte nicht gesendet werden.', debug: result.error }, 500)
  return c.json({ ok: true })
})

// DELETE /api/stacks/:id
stacks.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  await c.env.DB.prepare('DELETE FROM stacks WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// PUT /api/stacks/:id
stacks.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const name = typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : null
  if (data.name !== undefined && name === null) {
    return c.json({ error: 'Stack-Name darf nicht leer sein' }, 400)
  }
  const hasFamilyMemberUpdate = data.family_member_id !== undefined || data.familyMemberId !== undefined
  const familyMemberId = hasFamilyMemberUpdate
    ? normalizeFamilyMemberId(data.family_member_id ?? data.familyMemberId)
    : undefined
  if (hasFamilyMemberUpdate && familyMemberId === undefined) {
    return c.json({ error: 'family_member_id must be null or a valid family profile id' }, 400)
  }
  if (familyMemberId !== undefined && !(await familyMemberBelongsToUser(c.env.DB, stack.user_id, familyMemberId))) {
    return c.json({ error: 'Family profile not found' }, 404)
  }

  let normalizedItems: StackProductInput[] | null = null
  if (data.product_ids !== undefined) {
    const normalized = normalizeStackProductItems(data.product_ids)
    if (normalized.error || !normalized.items) {
      return c.json({ error: normalized.error ?? 'Invalid product_ids' }, 400)
    }
    if (!(await validateStackProductReferences(c.env.DB, stack.user_id, normalized.items))) {
      return c.json({ error: 'Stacks can only use public catalog products or your own pending/approved products' }, 400)
    }
    normalizedItems = normalized.items
  }

  const statements: D1PreparedStatement[] = []
  if (name !== null) {
    statements.push(c.env.DB.prepare('UPDATE stacks SET name = ? WHERE id = ?').bind(name, id))
  }
  if (familyMemberId !== undefined) {
    statements.push(c.env.DB.prepare('UPDATE stacks SET family_member_id = ? WHERE id = ?').bind(familyMemberId, id))
  }
  if (normalizedItems !== null) {
    statements.push(c.env.DB.prepare('DELETE FROM stack_items WHERE stack_id = ?').bind(id))
    statements.push(...normalizedItems.map((item) =>
      c.env.DB.prepare(
        'INSERT INTO stack_items (stack_id, catalog_product_id, user_product_id, quantity, intake_interval_days, dosage_text, timing) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id,
        item.product_type === 'catalog' ? item.id : null,
        item.product_type === 'user_product' ? item.id : null,
        item.quantity,
        item.intake_interval_days,
        item.dosage_text,
        item.timing,
      )
    ))
  }
  if (statements.length > 0) {
    await c.env.DB.batch(statements)
  }
  const updated = await c.env.DB.prepare(`
    SELECT s.*, fp.first_name AS family_member_first_name
    FROM stacks s
    LEFT JOIN family_profiles fp ON fp.id = s.family_member_id AND fp.user_id = s.user_id
    WHERE s.id = ?
  `).bind(id).first()
  const items = await loadStackItemsWithIngredients(c.env.DB, id, stack.user_id)
  return c.json({ stack: updated, items })
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
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
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
