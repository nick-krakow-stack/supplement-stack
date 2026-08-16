import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  FileText,
  Info,
  LayoutGrid,
  List,
  Mail,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiPath } from '../api/base';
import {
  getPublicIntakeTimings,
  getTrashedStacks,
  reportProductLink,
  restoreStack,
  updateStackItemsLayout,
  type PublicIntakeTimingOption,
  type TrashedStack,
} from '../api/stacks';
import { creatorSharingEnabled, markStackOpened } from '../api/creatorSharing';
import type { ProductSafetyWarning, User } from '../types';
import type { DosageGuideline, Ingredient, ShopDomain } from '../types/local';
import {
  aggregateStackIngredientTotals,
  calculateProductUsage,
  intakeIntervalDays as calculateIntakeIntervalDays,
} from '../lib/stackCalculations';
import EditStackModal from './EditStackModal';
import ProductCard from './ProductCard';
import SearchBar from './SearchBar';
import StacksHeader, { type StacksHeaderVariant } from './StacksHeader';
import ModalWrapper from './modals/ModalWrapper';

export interface DemoProduct {
  id: number;
  product_type?: 'catalog' | 'user_product';
  stack_item_id?: number;
  version?: number;
  name: string;
  product_name?: string | null;
  price: number;
  product_price?: number;
  brand?: string;
  product_brand?: string | null;
  shop_link?: string;
  click_url?: string;
  image_url?: string;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
  quantity?: number;
  basis_quantity?: number | null;
  basis_unit?: string | null;
  intake_interval_days?: number;
  unit?: string;
  form?: string;
  timing?: string;
  timing_label?: string | null;
  ingredient_timing?: string | null;
  ingredient_timing_label?: string | null;
  ingredient_timing_note?: string | null;
  ingredient_intake_hint?: string | null;
  dosage_text?: string | null;
  sort_order?: number;
  ingredient_effect_summary?: string | null;
  effect_summary?: string;
  warning_title?: string;
  warning_message?: string;
  warning_type?: string;
  alternative_note?: string;
  warnings?: ProductSafetyWarning[];
  status?: 'pending' | 'approved' | 'rejected' | 'blocked';
  user_product_status?: 'pending' | 'approved' | 'rejected' | 'blocked';
  published_product_id?: number | null;
  creator_statement_snapshot?: string | null;
  creator_snapshot_at?: string | null;
  origin_party_name?: string | null;
  has_attribution?: number;
  ingredients?: Array<{
    ingredient_id: number;
    ingredient_name?: string;
    form_id?: number | null;
    quantity?: number | null;
    unit?: string | null;
    basis_quantity?: number | null;
    basis_unit?: string | null;
    search_relevant?: number | boolean;
    parts?: Array<{
      part_id: number;
      part_name?: string;
      quantity?: number | null;
      unit?: string | null;
      basis_quantity?: number | null;
      basis_unit?: string | null;
      search_relevant?: number | boolean;
    }>;
  }>;
}

export interface DemoStack {
  id: string;
  name: string;
  description?: string;
  products: DemoProduct[];
  origin_party_id?: number | null;
  origin_party_name?: string | null;
  version?: number;
}

interface DemoState {
  stacks: DemoStack[];
  activeStackId: string;
}

export interface StackWorkspaceProps {
  mode?: 'demo' | 'authenticated';
  standaloneHeader?: boolean;
  view?: 'workspace' | 'routine';
}

type IngredientFormOption = {
  id: number;
  name: string;
  comment?: string | null;
};

type ProductViewMode = 'grid' | 'list';
type ProductSortMode = 'manual' | 'az' | 'timing';
type RoutineKey = 'morning' | 'noon' | 'evening' | 'flexible';

const HEADER_VARIANT: StacksHeaderVariant = 'warm';
const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' };
const DEMO_STACK_HANDOFF_KEY = 'ss_demo_stack_handoff_v1';
const LEGACY_DESCRIPTION_KEY = 'ss_stack_descriptions';
const ADD_PRODUCT_DRAFT_KEY = 'ss_add_product_draft_v2';
const STACK_VIEW_KEY = 'supplement-stack-product-view';
const STACK_SORT_KEY = 'supplement-stack-product-sort';

const DEMO_SIGN_IN_TEXT =
  'Diese Funktion kannst du kostenlos nutzen, sobald du angemeldet bist. Dein aktueller Demo-Stack wird dabei für dich vorgemerkt.';

const ROUTINE_META: Record<RoutineKey, { label: string; hint: string }> = {
  morning: { label: 'Morgens', hint: 'Produkte mit einer Einnahme am Morgen' },
  noon: { label: 'Mittags', hint: 'Produkte mit einer Einnahme am Mittag' },
  evening: { label: 'Abends', hint: 'Produkte mit einer Einnahme am Abend' },
  flexible: { label: 'Flexibel', hint: 'Zum Essen oder ohne feste Tageszeit' },
};

function credentialedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { credentials: 'include', ...init });
}

function newStackId(): string {
  return `stack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultState(): DemoState {
  const id = newStackId();
  return {
    stacks: [{ id, name: 'Basis Gesundheit', description: '', products: [] }],
    activeStackId: id,
  };
}

function productStackKey(product: Pick<DemoProduct, 'id' | 'product_type'>): string {
  return `${product.product_type ?? 'catalog'}:${product.id}`;
}

function applySequentialSortOrder(products: DemoProduct[]): DemoProduct[] {
  return products.map((product, index) => ({ ...product, sort_order: index }));
}

function mapStackDetail(
  stack: Record<string, unknown>,
  detail?: Record<string, unknown>,
): DemoStack {
  const detailStack = detail?.stack && typeof detail.stack === 'object'
    ? detail.stack as Record<string, unknown>
    : stack;
  const productsRaw = Array.isArray(detail?.items)
    ? detail.items
    : Array.isArray(detail?.products)
      ? detail.products
      : [];
  const products = applySequentialSortOrder(
    (productsRaw as DemoProduct[]).slice().sort((left, right) => {
      const leftOrder = Number.isFinite(left.sort_order) ? Number(left.sort_order) : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(right.sort_order) ? Number(right.sort_order) : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || productName(left).localeCompare(productName(right), 'de');
    }),
  );
  return {
    id: String(detailStack.id ?? stack.id),
    name: String(detailStack.name ?? stack.name ?? 'Mein Stack'),
    description: typeof detailStack.description === 'string' ? detailStack.description : '',
    products,
    origin_party_id: typeof detailStack.origin_party_id === 'number' ? detailStack.origin_party_id : null,
    origin_party_name: typeof detailStack.origin_party_name === 'string' ? detailStack.origin_party_name : null,
    version: typeof detailStack.version === 'number' ? detailStack.version : undefined,
  };
}

function loadLegacyDescriptions(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(LEGACY_DESCRIPTION_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function removeLegacyDescription(stackId: string): void {
  try {
    const descriptions = loadLegacyDescriptions();
    delete descriptions[stackId];
    if (Object.keys(descriptions).length === 0) window.localStorage.removeItem(LEGACY_DESCRIPTION_KEY);
    else window.localStorage.setItem(LEGACY_DESCRIPTION_KEY, JSON.stringify(descriptions));
  } catch {
    // A blocked local store must not create a second server truth.
  }
}

function persistDemoHandoff(state: DemoState): void {
  try {
    window.localStorage.setItem(DEMO_STACK_HANDOFF_KEY, JSON.stringify({
      version: 2,
      created_at: new Date().toISOString(),
      active_stack_id: state.activeStackId,
      stacks: state.stacks,
    }));
  } catch {
    // Registration remains available even if browser storage is blocked.
  }
}

function normalizeUnitToGerman(unit?: string): string {
  return (unit ?? '').replace(/\bIU\b/gi, 'IE');
}

interface ManualDose {
  value: number;
  unit: string;
}

function primaryDose(guideline?: DosageGuideline): ManualDose | null {
  if (!guideline) return null;
  const value = guideline.dose_max ?? guideline.dose_min;
  if (value == null || !guideline.unit) return null;
  return { value, unit: normalizeUnitToGerman(guideline.unit) };
}

function formatDoseAmount(dose?: ManualDose | null): string {
  if (!dose) return '';
  return `${dose.value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${dose.unit}`;
}

export function populationLabel(population?: string): string {
  switch ((population ?? '').trim().toLowerCase()) {
    case 'adult_male': case 'male': case 'men': case 'maenner': case 'männer': return 'Männer';
    case 'adult_female': case 'female': case 'women': case 'frauen': return 'Frauen';
    case 'pregnancy': case 'pregnant': case 'schwangere': return 'Schwangere';
    case 'lactation': case 'breastfeeding': case 'stillende': return 'Stillzeit';
    case 'children': case 'kinder': return 'Kinder';
    case 'older': case 'aeltere': case 'ältere': return 'Ältere';
    default: return 'Standard';
  }
}

export function modalVisibleGuidelineOptions(guidelines: DosageGuideline[]): DosageGuideline[] {
  const seen = new Set<string>();
  return guidelines.filter((guideline) => {
    const label = populationLabel(guideline.population);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  }).slice(0, 4);
}

export function modalIngredientDescription(ingredient: { name: string; description?: string | null }): string {
  const raw = ingredient.description?.replace(/\s+/g, ' ').trim()
    || `Zu ${ingredient.name} ist noch kein kurzer Einführungstext hinterlegt.`;
  const sentences = raw.match(/[^.!?]+[.!?]+/g);
  const compact = sentences?.length ? sentences.slice(0, 2).join(' ').trim() : raw;
  return compact.length <= 180 ? compact : `${compact.slice(0, 177).trim()}...`;
}

function isStudyContextGuideline(guideline: DosageGuideline): boolean {
  return guideline.source === 'study'
    && (guideline.amount_type == null || guideline.amount_type === 'tested_amount')
    && (guideline.stage4_status == null || guideline.stage4_status === 'active');
}

export function selectStudyGuideline(
  guidelines: DosageGuideline[],
  referenceGuideline?: DosageGuideline,
): DosageGuideline | undefined {
  return guidelines.find((guideline) => guideline.id !== referenceGuideline?.id && isStudyContextGuideline(guideline));
}

export function describeStudyGuidelineContext(guideline?: DosageGuideline): string {
  if (!guideline) return '';
  const source = guideline.source_title?.trim();
  const notes = guideline.notes?.trim();
  if (source && notes) return `${source}: ${notes}`;
  return source || notes || 'Studienwert aus hinterlegtem Studienkontext.';
}

export function describeStudyGuidelineEffect(guideline?: DosageGuideline): string {
  return guideline?.notes?.trim() || 'Wirkung noch nicht hinterlegt.';
}

function productName(product: DemoProduct): string {
  return (product.product_name ?? product.name ?? '').trim();
}

function productServingsPerDay(product: DemoProduct): number {
  const usage = calculateProductUsage(product);
  return usage.servingsPerIntake > 0 ? usage.servingsPerIntake : 1;
}

function productInterval(product: DemoProduct): number {
  return calculateIntakeIntervalDays(product);
}

function productIntakeLabel(product: DemoProduct): string {
  if (product.dosage_text?.trim()) return product.dosage_text.trim();
  const portions = productServingsPerDay(product);
  const portionLabel = portions === 1 ? 'Portion' : 'Portionen';
  const interval = productInterval(product);
  return `${portions.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${portionLabel}${interval > 1 ? ` alle ${interval} Tage` : ' täglich'}`;
}

function productMonthlyPrice(product: DemoProduct): number {
  const price = Number(product.price ?? product.product_price ?? 0);
  const usage = calculateProductUsage(product, Number.isFinite(price) ? price : null);
  return usage.monthlyCost ?? Number(product.price ?? product.product_price ?? 0);
}

export function applyPlannedDoseToProduct(product: DemoProduct, dose: ManualDose): DemoProduct {
  const planned: DemoProduct = {
    ...product,
    dosage_text: dose.value > 0 && dose.unit ? `${dose.value} ${dose.unit} täglich` : product.dosage_text,
    timing: product.ingredient_timing || product.timing || 'anytime',
    intake_interval_days: product.intake_interval_days ?? 1,
  };
  planned.quantity = productServingsPerDay(planned);
  return planned;
}

export function describeProductPlan(product: DemoProduct): string {
  const price = Number(product.price ?? product.product_price ?? 0);
  const usage = calculateProductUsage(product, Number.isFinite(price) ? price : null);
  if (product.dosage_text?.trim() && usage.calculationSource !== 'target_dose') {
    return 'Für deinen Plan: Portionen nicht berechenbar, Reichweite nicht berechenbar, Monatskosten nicht berechenbar';
  }
  const portionLabel = usage.servingsPerIntake === 1 ? 'Portion' : 'Portionen';
  const reach = usage.daysSupply != null
    ? `reicht ${usage.daysSupply} ${usage.daysSupply === 1 ? 'Tag' : 'Tage'}`
    : 'Reichweite nicht berechenbar';
  const monthly = usage.monthlyCost != null
    ? `${formatEuro(usage.monthlyCost)} €/Monat`
    : 'Monatskosten nicht berechenbar';
  return `Für deinen Plan: ${usage.servingsPerIntake.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${portionLabel}, ${reach}, ${monthly}`;
}

function formatEuro(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timingRank(timing?: string): number {
  const normalized = (timing ?? '').toLowerCase();
  if (normalized.includes('morning') || normalized.includes('morgen') || normalized.includes('breakfast')) return 0;
  if (normalized.includes('noon') || normalized.includes('mittag')) return 1;
  if (normalized.includes('evening') || normalized.includes('abend') || normalized.includes('night')) return 2;
  return 3;
}

function sortedProducts(products: DemoProduct[], mode: ProductSortMode): DemoProduct[] {
  const rows = products.slice();
  if (mode === 'az') return rows.sort((a, b) => productName(a).localeCompare(productName(b), 'de'));
  if (mode === 'timing') {
    return rows.sort((a, b) => timingRank(a.timing) - timingRank(b.timing) || productName(a).localeCompare(productName(b), 'de'));
  }
  return rows.sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

function routineKeysForTiming(timing?: string): RoutineKey[] {
  const normalized = (timing ?? '').trim().toLowerCase().replace(/[ -]+/g, '_');
  if (normalized.includes('morning_evening') || normalized.includes('morgens_und_abends')) return ['morning', 'evening'];
  if (normalized.includes('before_breakfast') || normalized.includes('after_breakfast') || normalized.includes('morning') || normalized.includes('morgen')) return ['morning'];
  if (normalized.includes('evening') || normalized.includes('abend') || normalized.includes('night')) return ['evening'];
  if (normalized.includes('noon') || normalized.includes('mittag')) return ['noon'];
  return ['flexible'];
}

function getUserDisplayName(user: User | null | undefined): string | null {
  if (!user) return null;
  const candidate = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return candidate || user.email || null;
}

function safeCreatorReturn(value: string | null): string | null {
  if (!value || value.length > 1000 || !value.startsWith('/creator')) return null;
  try {
    const parsed = new URL(value, 'https://supplementstack.local');
    if (parsed.origin !== 'https://supplementstack.local' || parsed.pathname !== '/creator') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function loadViewMode(): ProductViewMode {
  return typeof window !== 'undefined' && window.localStorage.getItem(STACK_VIEW_KEY) === 'list' ? 'list' : 'grid';
}

function loadSortMode(): ProductSortMode {
  const value = typeof window !== 'undefined' ? window.localStorage.getItem(STACK_SORT_KEY) : null;
  return value === 'az' || value === 'timing' ? value : 'manual';
}

function safeFileName(value: string): string {
  return value.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'supplement-stack';
}

const WIN_ANSI_SPECIAL: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  '„': 0x84,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '–': 0x96,
  '—': 0x97,
};

export function encodePdfWinAnsi(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of value) {
    const special = WIN_ANSI_SPECIAL[character];
    if (special !== undefined) {
      bytes.push(special);
      continue;
    }
    const code = character.codePointAt(0) ?? 0x3f;
    bytes.push(code <= 0xff ? code : 0x3f);
  }
  return Uint8Array.from(bytes);
}

function pdfText(value: string): string {
  const withoutControls = [...value]
    .map((character) => (character.codePointAt(0) ?? 0) < 0x20 ? ' ' : character)
    .join('');
  return withoutControls.replace(/[\\()]/g, (match) => `\\${match}`);
}

function wrapPdfLine(value: string, maxLength = 88): string[] {
  const words = pdfText(value).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength && current) {
      lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines;
}

export function buildStackPdf(stack: DemoStack, createdAt = new Date()): Blob {
  const productLines = stack.products.flatMap((product, index) => [
    ...wrapPdfLine(
      `${index + 1}. ${productName(product)} · ${productIntakeLabel(product)} · ${product.timing_label || product.ingredient_timing_label || 'Zeit flexibel'} · ${formatEuro(Number(product.price ?? product.product_price ?? 0))} €`,
    ),
    ...(product.creator_statement_snapshot
      ? wrapPdfLine(`Persönlicher Hinweis des Creators: ${product.creator_statement_snapshot}`)
      : []),
  ]);
  const snapshotDates = [...new Set(stack.products.flatMap((product) => {
    if (!product.creator_snapshot_at) return [];
    const parsed = new Date(product.creator_snapshot_at);
    return Number.isNaN(parsed.getTime()) ? [] : [parsed.toLocaleDateString('de-DE')];
  }))];
  const headingLines = [
    `Supplement Stack: ${stack.name}`,
    `Erstellt am ${createdAt.toLocaleDateString('de-DE')} um ${createdAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
    ...(stack.origin_party_name ? [`Empfehlungsbezug: ${stack.origin_party_name}`] : []),
    ...(snapshotDates.length > 0 ? [`Stand der Creator-Empfehlung: ${snapshotDates.join(', ')}`] : []),
    ...wrapPdfLine(stack.description ? `Persönlicher Stack-Hinweis: ${stack.description}` : 'Keine Beschreibung hinterlegt.'),
    '',
  ];
  const footerLines = [
    '',
    ...wrapPdfLine('Gesundheitshinweis: Diese Übersicht dient der Orientierung und ersetzt keine persönliche medizinische Beratung, Diagnose oder Behandlung.'),
  ];
  const maxBodyLines = 44;
  const pages: string[][] = [];
  let remaining = productLines.slice();
  if (remaining.length === 0) remaining = ['Dieser Stack enthält noch keine Produkte.'];
  while (remaining.length > 0) {
    const pageNumber = pages.length + 1;
    const prefix = pageNumber === 1 ? headingLines : [`Supplement Stack: ${stack.name}`, `Fortsetzung · Seite ${pageNumber}`, ''];
    const footerCapacity = remaining.length <= maxBodyLines ? footerLines.length : 0;
    const capacity = Math.max(1, maxBodyLines - prefix.length - footerCapacity);
    const body = remaining.splice(0, capacity);
    pages.push([...prefix, ...body, ...(remaining.length === 0 ? footerLines : [])]);
  }

  const pageCount = pages.length;
  const firstPageObject = 3;
  const firstContentObject = firstPageObject + pageCount;
  const fontObject = firstContentObject + pageCount;
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${firstPageObject + index} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  ];
  pages.forEach((_, index) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${firstContentObject + index} 0 R >>`);
  });
  pages.forEach((lines) => {
    const stream = [
      'BT',
      '/F1 10 Tf',
      '46 800 Td',
      '15 TL',
      ...lines.flatMap((line, index) => index === 0 ? [`(${line}) Tj`] : ['T*', `(${line}) Tj`]),
      'ET',
    ].join('\n');
    objects.push(`<< /Length ${encodePdfWinAnsi(stream).length} >>\nstream\n${stream}\nendstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encodePdfWinAnsi(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = encodePdfWinAnsi(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([encodePdfWinAnsi(pdf)], { type: 'application/pdf' });
}

export function downloadStackPdf(stack: DemoStack): void {
  const url = URL.createObjectURL(buildStackPdf(stack));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(stack.name)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface AddDraft {
  ingredient: Ingredient;
  stackId: string;
}

export interface IngredientDisplayProfile {
  id: number;
  form_id: number | null;
  part_id: number | null;
  effect_summary: string | null;
}

export function resolveIngredientEffectSummary(
  profiles: IngredientDisplayProfile[],
  formId: number | null,
  partId: number | null,
): string {
  const normalized = (profile: IngredientDisplayProfile | undefined) => profile?.effect_summary?.trim() ?? '';
  if (partId !== null) {
    const part = normalized(profiles.find((profile) => profile.part_id === partId));
    if (part) return part;
  }
  if (formId !== null) {
    const form = normalized(profiles.find((profile) => profile.part_id === null && profile.form_id === formId));
    if (form) return form;
  }
  return normalized(profiles.find((profile) => profile.part_id === null && profile.form_id === null));
}

function loadAddDraft(): AddDraft | null {
  try {
    const raw = window.sessionStorage.getItem(ADD_PRODUCT_DRAFT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const candidate = value as { ingredient?: unknown; stackId?: unknown };
    if (!candidate.ingredient || typeof candidate.ingredient !== 'object' || typeof candidate.stackId !== 'string') return null;
    return { ingredient: candidate.ingredient as Ingredient, stackId: candidate.stackId };
  } catch {
    return null;
  }
}

function AddProductModal({
  stacks,
  activeStackId,
  isDemo,
  guidelineSource,
  initialDraft,
  onAdd,
  onClose,
  onRequestOwnProduct,
  onEditExistingProduct,
}: {
  stacks: DemoStack[];
  activeStackId: string;
  isDemo: boolean;
  guidelineSource: 'DGE' | 'studien';
  initialDraft: AddDraft | null;
  onAdd: (product: DemoProduct, stackId: string, replaceProductKey?: string) => Promise<void>;
  onClose: () => void;
  onRequestOwnProduct: (draft: AddDraft | null) => void;
  onEditExistingProduct: (key: string) => void;
}) {
  const [step, setStep] = useState<'search' | 'dosage' | 'products'>('search');
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [forms, setForms] = useState<IngredientFormOption[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [guidelines, setGuidelines] = useState<DosageGuideline[]>([]);
  const [selectedDgeId, setSelectedDgeId] = useState<number | null>(null);
  const [dose, setDose] = useState<ManualDose>({ value: 0, unit: '' });
  const [targetStackId, setTargetStackId] = useState(initialDraft?.stackId ?? activeStackId);
  const [displayProfiles, setDisplayProfiles] = useState<IngredientDisplayProfile[]>([]);
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<{ ingredient: Ingredient; product: DemoProduct } | null>(null);
  const [replacement, setReplacement] = useState<{ stackId: string; key: string; name: string } | null>(null);
  const restoredRef = useRef(false);

  const targetStack = stacks.find((stack) => stack.id === targetStackId) ?? stacks[0];
  const dgeOptions = guidelines.filter((guideline) => guideline.source === 'DGE' || guideline.is_default);
  const visibleDgeOptions = modalVisibleGuidelineOptions(dgeOptions);
  const dgeGuideline = dgeOptions.find((guideline) => guideline.id === selectedDgeId) ?? dgeOptions[0];
  const dgeDose = primaryDose(dgeGuideline);
  const studyGuideline = selectStudyGuideline(guidelines, dgeGuideline);
  const studyDose = primaryDose(studyGuideline);
  const effectSummary = resolveIngredientEffectSummary(
    displayProfiles,
    selectedFormId,
    ingredient?.matched_part_id ?? null,
  );

  const duplicateFor = useCallback((selected: Ingredient): DemoProduct | null => {
    return targetStack?.products.find((product) => product.ingredients?.some((row) => (
      row.ingredient_id === selected.id
    ))) ?? null;
  }, [targetStack]);

  const beginIngredient = useCallback(async (selected: Ingredient) => {
    setIngredient(selected);
    setStep('dosage');
    setLoading(true);
    setError('');
    try {
      const partQuery = selected.matched_part_id != null ? `?part_id=${selected.matched_part_id}` : '';
      const [detailResponse, guidelineResponse] = await Promise.all([
        credentialedFetch(apiPath(`/ingredients/${selected.id}`)),
        credentialedFetch(apiPath(`/ingredients/${selected.id}/dosage-guidelines${partQuery}`)),
      ]);
      const detail = detailResponse.ok ? await detailResponse.json() as {
        ingredient?: Ingredient;
        forms?: IngredientFormOption[];
        display_profiles?: IngredientDisplayProfile[];
      } : {};
      const guidelineData = guidelineResponse.ok ? await guidelineResponse.json() as { guidelines?: DosageGuideline[] } : {};
      const merged = { ...(detail.ingredient ?? selected), ...selected };
      setIngredient(merged);
      const loadedForms = Array.isArray(detail.forms) ? detail.forms : [];
      setForms(loadedForms);
      setDisplayProfiles(Array.isArray(detail.display_profiles) ? detail.display_profiles : []);
      setSelectedFormId(selected.matched_form_id ?? null);
      const loadedGuidelines = Array.isArray(guidelineData.guidelines) ? guidelineData.guidelines : [];
      setGuidelines(loadedGuidelines);
      const officialGuideline = loadedGuidelines.find((guideline) => guideline.source === 'DGE')
        ?? loadedGuidelines.find((guideline) => guideline.is_default);
      const preferredGuideline = guidelineSource === 'studien'
        ? selectStudyGuideline(loadedGuidelines, officialGuideline) ?? officialGuideline
        : officialGuideline ?? selectStudyGuideline(loadedGuidelines);
      setSelectedDgeId(officialGuideline?.id ?? null);
      setDose(primaryDose(preferredGuideline) ?? { value: 0, unit: normalizeUnitToGerman(merged.unit) });
    } catch {
      setError('Die Angaben konnten nicht vollständig geladen werden. Du kannst es erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }, [guidelineSource]);

  useEffect(() => {
    if (!initialDraft || restoredRef.current) return;
    restoredRef.current = true;
    window.sessionStorage.removeItem(ADD_PRODUCT_DRAFT_KEY);
    void beginIngredient(initialDraft.ingredient);
  }, [beginIngredient, initialDraft]);

  const chooseIngredient = (selected: Ingredient) => {
    const existing = duplicateFor(selected);
    if (existing) setDuplicate({ ingredient: selected, product: existing });
    else void beginIngredient(selected);
  };

  const loadProducts = async () => {
    if (!ingredient) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (selectedFormId != null) params.set('form_id', String(selectedFormId));
    if (ingredient.matched_part_id != null) params.set('part_id', String(ingredient.matched_part_id));
    try {
      const [catalogResponse, ownResponse] = await Promise.all([
        credentialedFetch(apiPath(`/ingredients/${ingredient.id}/products${params.size ? `?${params}` : ''}`)),
        isDemo ? Promise.resolve(null) : credentialedFetch(apiPath('/user-products')),
      ]);
      if (!catalogResponse.ok) throw new Error();
      const catalogData = await catalogResponse.json() as { products?: DemoProduct[] };
      const ownData = ownResponse?.ok ? await ownResponse.json() as { products?: DemoProduct[] } : {};
      const own = (ownData.products ?? []).filter((product) => (
        product.user_product_status !== 'rejected'
        && product.status !== 'rejected'
        && product.ingredients?.some((row) => row.ingredient_id === ingredient.id && (selectedFormId == null || row.form_id === selectedFormId))
      )).map((product) => applyPlannedDoseToProduct({ ...product, product_type: 'user_product' as const }, dose));
      const catalog = (catalogData.products ?? []).map((product) => (
        applyPlannedDoseToProduct({ ...product, product_type: 'catalog' as const }, dose)
      ));
      setProducts([...own, ...catalog]);
      setStep('products');
    } catch {
      setError('Produkte konnten nicht geladen werden. Bitte versuche es noch einmal.');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (product: DemoProduct) => {
    if (!targetStack) return;
    const enhanced = applyPlannedDoseToProduct(product, dose);
    setLoading(true);
    try {
      await onAdd(
        enhanced,
        targetStack.id,
        replacement?.stackId === targetStack.id ? replacement.key : undefined,
      );
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Produkt konnte nicht hinzugefügt werden.');
      setLoading(false);
    }
  };

  const dosePercent = dgeDose && dose.value > 0 && dgeDose.value > 0
    ? Math.round((dose.value / dgeDose.value) * 100)
    : null;

  if (duplicate) {
    return (
      <ModalWrapper onClose={() => setDuplicate(null)} title={`${duplicate.ingredient.name} ist bereits enthalten`} size="md">
        <p className="ss-modal-copy">Der Wirkstoff ist schon über „{productName(duplicate.product)}“ in „{targetStack?.name}“ enthalten. Was möchtest du tun?</p>
        <div className="ss-modal-actions ss-modal-actions-stack">
          <button type="button" className="ss-modal-btn-save" onClick={() => onEditExistingProduct(productStackKey(duplicate.product))}>Einnahmemenge bearbeiten</button>
          <button type="button" className="ss-modal-btn-cancel" onClick={() => {
            const selected = duplicate.ingredient;
            setReplacement({
              stackId: targetStackId,
              key: productStackKey(duplicate.product),
              name: productName(duplicate.product),
            });
            setDuplicate(null);
            void beginIngredient(selected);
          }}>Vorhandenes Produkt wechseln</button>
          <button type="button" className="ss-modal-btn-cancel" onClick={() => { const selected = duplicate.ingredient; setDuplicate(null); void beginIngredient(selected); }}>Trotzdem ein weiteres Produkt hinzufügen</button>
          <button type="button" className="ss-modal-btn-cancel" onClick={() => setDuplicate(null)}>Abbrechen</button>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper onClose={onClose} title="Produkt hinzufügen" size="lg">
      <div className={`stage ss-add-modal-stage${step === 'products' ? ' ss-add-modal-stage--products' : ''}`}>
        <section className="modal ss-add-modal ss-add-modal-embedded">
          <div className="ss-add-modal-content">
            {step === 'search' && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-3 text-blue-900"><Search /><h3 className="text-xl font-black">Welchen Wirkstoff möchtest du hinzufügen?</h3></div>
                <SearchBar onSelect={chooseIngredient} placeholder="Zum Beispiel Magnesium oder Vitamin D" autoFocus />
                <p className="mt-3 text-sm font-semibold text-slate-600">Die Suche berücksichtigt Namen, bekannte andere Bezeichnungen und Wirkstoffbestandteile gemeinsam.</p>
              </div>
            )}

            {step === 'dosage' && ingredient && (
              <div className="ss-dosage-panel">
                <h3 className="ss-dosage-title">Einnahmemenge für {ingredient.name}</h3>
                {ingredient.matched_part_name && <p className="ss-match-explanation">Treffer über den Bestandteil „{ingredient.matched_part_name}“. Ausgewählt wird der übergeordnete Wirkstoff „{ingredient.name}“; das konkrete Produkt wählst du später.</p>}
                <p className="ss-dosage-description">{modalIngredientDescription(ingredient)}</p>
                <div className="ss-canonical-effect"><strong>Wirkung</strong><span>{effectSummary || 'Noch kein Kurztext verfügbar.'}</span></div>

                <details className="ss-expert-details">
                  <summary>Weitere Angaben für Experten</summary>
                  <label className="ss-input-label" htmlFor="ingredient-form">Darreichungsform</label>
                  <select id="ingredient-form" className="ss-stack-select" value={selectedFormId ?? ''} onChange={(event) => setSelectedFormId(event.target.value ? Number(event.target.value) : null)}>
                    <option value="">Alle passenden Formen</option>
                    {forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
                  </select>
                  {selectedFormId != null && forms.find((form) => form.id === selectedFormId)?.comment && (
                    <p className="ss-helper-text">{forms.find((form) => form.id === selectedFormId)?.comment}</p>
                  )}
                </details>

                <div className={`ss-reference-grid ss-reference-grid--${guidelineSource}`}>
                  <div className="ss-reference-card ss-reference-card--dge">
                    <div className="ss-reference-top">
                      <p className="ss-reference-title">{dgeGuideline?.source === 'DGE' ? 'DGE-Referenzwert' : 'Offizieller Referenzwert'} für die gesamte tägliche Zufuhr</p>
                      {visibleDgeOptions.length > 1 && (
                        <div className="ss-pop-toggle" aria-label="Zielgruppe für den offiziellen Referenzwert">
                          {visibleDgeOptions.map((option) => (
                            <button type="button" key={option.id} className={`ss-pop-option ${option.id === dgeGuideline?.id ? 'is-active' : ''}`} onClick={() => setSelectedDgeId(option.id)}>{populationLabel(option.population)}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    {dgeDose ? <p className="ss-reference-value">{formatDoseAmount(dgeDose)}</p> : <p className="ss-reference-note">Kein offizieller Referenzwert verfügbar.</p>}
                    <p className="ss-reference-note">Gilt für die gesamte Zufuhr aus Lebensmitteln und Ergänzungen – nicht als automatische Supplementmenge. Quelle: {dgeGuideline?.source_title || dgeGuideline?.source || 'nicht hinterlegt'}{dgeGuideline?.population ? `, Zielgruppe ${populationLabel(dgeGuideline.population)}` : ''}.</p>
                    {dgeDose && <button type="button" className="ss-reference-cta ss-reference-cta--dge" onClick={() => setDose(dgeDose)}><Check size={18} />Einnahmemenge übernehmen</button>}
                  </div>

                  <div className="ss-reference-card ss-reference-card--study">
                    <p className="ss-reference-title">Studien-Referenz</p>
                    {studyDose ? (
                      <>
                        <p className="ss-reference-value">{formatDoseAmount(studyDose)}</p>
                        <p className="ss-reference-note">{describeStudyGuidelineEffect(studyGuideline)}</p>
                        {studyGuideline?.source_title && <p className="ss-reference-source"><FileText size={15} />{studyGuideline.source_title}</p>}
                        <button type="button" className="ss-reference-cta ss-reference-cta--study" onClick={() => setDose(studyDose)}>Einnahmemenge übernehmen</button>
                      </>
                    ) : <p className="ss-reference-note">Keine Studiendaten hinterlegt.</p>}
                  </div>
                </div>

                <label className="ss-input-label" htmlFor="planned-dose">Mit welcher täglichen Wirkstoffmenge möchtest du planen?</label>
                <div className="ss-amount-input-wrap">
                  <input id="planned-dose" type="number" min="0" step="any" value={dose.value || ''} onChange={(event) => setDose((current) => ({ ...current, value: Number(event.target.value) }))} />
                  <span className="ss-amount-unit">{dose.unit || normalizeUnitToGerman(ingredient.unit) || 'Einheit'}</span>
                </div>
                <p className="ss-helper-text">Gemeint ist die Wirkstoffmenge, nicht die Anzahl der Kapseln oder Portionen. Die passende Produktmenge wird im nächsten Schritt berechnet.</p>
                {dosePercent != null && (
                  <div className="ss-dge-notice"><Info /><div><p className="ss-dge-notice-title">Neutraler Vergleich: {dosePercent} % des angezeigten Referenzwerts</p><p className="ss-dge-notice-text">Ernährung, persönliche Situation und mögliche obere Zufuhrgrenzen sind darin nicht automatisch berücksichtigt.</p></div></div>
                )}

                <div className="ss-modal-actions ss-modal-actions-main">
                  <button type="button" className="ss-modal-btn-cancel" onClick={() => setStep('search')}>Zurück</button>
                  <button type="button" className="ss-next-btn" onClick={() => void loadProducts()} disabled={loading}>Passende Produkte anzeigen</button>
                </div>
              </div>
            )}

            {step === 'products' && ingredient && (
              <div>
                {replacement?.stackId === targetStackId && <p className="ss-match-explanation">„{replacement.name}“ wird erst entfernt, wenn du hier ein neues Produkt auswählst. Beides wird gemeinsam gespeichert.</p>}
                <div className="ss-product-choice-heading">
                  <div><h3>Produkt auswählen</h3><p>Eigene Produkte stehen zuerst, danach folgt der öffentliche Katalog in transparenter Standardreihenfolge.</p></div>
                  <label>Für Stack<select value={targetStackId} onChange={(event) => { setTargetStackId(event.target.value); setReplacement(null); }}>{stacks.map((stack) => <option key={stack.id} value={stack.id}>{stack.name}</option>)}</select></label>
                </div>
                {products.length === 0 && !loading && <div className="ss-empty-inline">Keine passenden Produkte gefunden. Du kannst stattdessen ein eigenes Produkt anlegen.</div>}
                <div className="ss-product-comparison-grid">
                  {products.map((product) => (
                    <div key={productStackKey(product)} className="ss-product-choice-card">
                      <ProductCard product={product} compact />
                      <p className="ss-product-plan-comparison">{describeProductPlan(product)}</p>
                      <button type="button" className="ss-next-btn" onClick={() => void addProduct(product)} disabled={loading}>{replacement?.stackId === targetStackId ? `${replacement.name} durch ${productName(product)} ersetzen` : `${productName(product)} zu „${targetStack?.name ?? 'Stack'}“ hinzufügen`}</button>
                    </div>
                  ))}
                </div>
                <div className="ss-modal-actions ss-modal-actions-main">
                  <button type="button" className="ss-modal-btn-cancel" onClick={() => setStep('dosage')}>Zurück</button>
                  <button type="button" className="ss-modal-btn-save" onClick={() => onRequestOwnProduct(ingredient ? { ingredient, stackId: targetStackId } : null)}>Eigenes Produkt anlegen</button>
                </div>
              </div>
            )}

            {loading && <p className="ss-live-status" role="status">Angaben werden geladen …</p>}
            {error && <p className="ss-live-status ss-live-status-error" role="alert">{error}</p>}
          </div>
        </section>
      </div>
    </ModalWrapper>
  );
}

function EditProductModal({
  product,
  timingOptions,
  onSave,
  onClose,
}: {
  product: DemoProduct;
  timingOptions: PublicIntakeTimingOption[];
  onSave: (patch: Partial<DemoProduct>) => Promise<void>;
  onClose: () => void;
}) {
  const initialInterval = productInterval(product);
  const [quantity, setQuantity] = useState(String(productServingsPerDay(product)));
  const [timing, setTiming] = useState(product.timing ?? 'anytime');
  const [rhythm, setRhythm] = useState(initialInterval === 1 ? 'daily' : 'interval');
  const [interval, setInterval] = useState(String(initialInterval));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const amount = Number(quantity);
    const days = rhythm === 'daily' ? 1 : Number(interval);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(days) || days < 1) {
      setError('Bitte trage eine gültige Menge und einen gültigen Rhythmus ein.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        quantity: amount,
        timing,
        intake_interval_days: days,
        // Eine bewusst eingegebene Portionsmenge ersetzt den früheren Wirkstoff-Zieltext.
        // Sonst würde die alte parsebare Dosis die neue Menge in Anzeige und Berechnung übersteuern.
        dosage_text: null,
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Änderung konnte nicht gespeichert werden.');
      setSaving(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="Produkt bearbeiten" size="md">
      <div className="ss-modal ss-modal-embedded">
        <label className="ss-modal-label">Menge pro Einnahme<input className="ss-modal-input" type="number" min="0.01" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label className="ss-modal-label">Wann nimmst du es?<select className="ss-modal-input" value={timing} onChange={(event) => setTiming(event.target.value)}><option value="anytime">Flexibel</option>{timingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <fieldset className="ss-rhythm-fieldset"><legend>Wie oft?</legend><label><input type="radio" checked={rhythm === 'daily'} onChange={() => setRhythm('daily')} /> täglich</label><label><input type="radio" checked={rhythm === 'interval'} onChange={() => setRhythm('interval')} /> alle X Tage</label></fieldset>
        {rhythm === 'interval' && <label className="ss-modal-label">Abstand in Tagen<input className="ss-modal-input" type="number" min="2" step="1" value={interval} onChange={(event) => setInterval(event.target.value)} /></label>}
        <p className="ss-helper-text">Reichweite und Monatskosten werden aus diesen Angaben automatisch neu berechnet.</p>
        {error && <p role="alert" className="ss-live-status ss-live-status-error">{error}</p>}
        <div className="ss-modal-actions"><button type="button" className="ss-modal-btn-cancel" onClick={onClose}>Abbrechen</button><button type="button" className="ss-modal-btn-save" disabled={saving} onClick={() => void save()}>{saving ? 'Speichern …' : 'Speichern'}</button></div>
      </div>
    </ModalWrapper>
  );
}

function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalWrapper onClose={onClose} title={title} size="md">
      <div className="ss-modal ss-modal-embedded">
        <div className="ss-modal-copy">{children}</div>
        <div className="ss-modal-actions"><button type="button" className="ss-modal-btn-cancel" onClick={onClose}>Abbrechen</button><button type="button" className={`ss-modal-btn-save${danger ? ' ss-modal-btn-danger' : ''}`} disabled={busy} onClick={onConfirm}>{busy ? 'Bitte warten …' : confirmLabel}</button></div>
      </div>
    </ModalWrapper>
  );
}

function NoticeDialog({ title, message, primaryLabel, onPrimary, onClose }: {
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  onClose: () => void;
}) {
  return (
    <ModalWrapper onClose={onClose} title={title} size="md">
      <div className="ss-modal ss-modal-embedded"><p className="ss-modal-copy">{message}</p><div className="ss-modal-actions"><button type="button" className="ss-modal-btn-cancel" onClick={onClose}>Schließen</button>{primaryLabel && onPrimary && <button type="button" className="ss-modal-btn-save" onClick={onPrimary}>{primaryLabel}</button>}</div></div>
    </ModalWrapper>
  );
}

export function StackWorkspace({ mode = 'demo', standaloneHeader, view = 'workspace' }: StackWorkspaceProps) {
  const isDemo = mode === 'demo';
  const [state, setState] = useState<DemoState>(createDefaultState);
  const [loading, setLoading] = useState(mode === 'authenticated');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [linkReportStatus, setLinkReportStatus] = useState('');
  const [linkReportRetry, setLinkReportRetry] = useState<{ product: DemoProduct; reason: 'missing_link' | 'invalid_link' } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft | null>(null);
  const [editStackOpen, setEditStackOpen] = useState(false);
  const [editingProductKey, setEditingProductKey] = useState<string | null>(null);
  const [deleteProductKey, setDeleteProductKey] = useState<string | null>(null);
  const [deleteStackOpen, setDeleteStackOpen] = useState(false);
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string; primaryLabel?: string; onPrimary?: () => void } | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trash, setTrash] = useState<TrashedStack[]>([]);
  const [viewMode, setViewMode] = useState<ProductViewMode>(loadViewMode);
  const [sortMode, setSortMode] = useState<ProductSortMode>(loadSortMode);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [shopDomains, setShopDomains] = useState<ShopDomain[]>([]);
  const [timingOptions, setTimingOptions] = useState<PublicIntakeTimingOption[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const openSearchHandled = useRef('');
  const addProductButtonRef = useRef<HTMLButtonElement>(null);

  const activeStack = state.stacks.find((stack) => stack.id === state.activeStackId) ?? state.stacks[0];
  const activeProducts = useMemo(() => sortedProducts(activeStack?.products ?? [], sortMode), [activeStack, sortMode]);
  const selectedProducts = (activeStack?.products ?? []).filter((product) => selectedKeys.has(productStackKey(product)));
  const totalOnce = selectedProducts.reduce((sum, product) => sum + Number(product.price ?? product.product_price ?? 0), 0);
  const totalMonthly = selectedProducts.reduce((sum, product) => sum + productMonthlyPrice(product), 0);
  const ingredientTotals = aggregateStackIngredientTotals(activeStack?.products ?? []);
  const creatorReturn = mode === 'authenticated'
    ? safeCreatorReturn(new URLSearchParams(location.search).get('creatorReturn'))
    : null;

  const replaceSearch = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search);
    mutate(params);
    const query = params.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ''}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  const migrateLegacyDescription = useCallback(async (stack: DemoStack): Promise<DemoStack> => {
    if (mode !== 'authenticated') return stack;
    const legacy = loadLegacyDescriptions()[stack.id]?.trim();
    if (!legacy || stack.description) {
      removeLegacyDescription(stack.id);
      return stack;
    }
    const response = await credentialedFetch(apiPath(`/stacks/${stack.id}`), {
      method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({
        description: legacy,
        expected_stack_version: stack.version,
      }),
    });
    if (!response.ok) return stack;
    removeLegacyDescription(stack.id);
    return { ...stack, description: legacy };
  }, [mode]);

  const loadAuthenticatedStacks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await credentialedFetch(apiPath('/stacks'));
      if (!response.ok) throw new Error('Deine Stacks konnten nicht geladen werden.');
      const data = await response.json() as { stacks?: Array<Record<string, unknown>> };
      let stackRows = Array.isArray(data.stacks) ? data.stacks : [];
      if (stackRows.length === 0) {
        const createdResponse = await credentialedFetch(apiPath('/stacks'), {
          method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: 'Basis Gesundheit', product_ids: [] }),
        });
        if (!createdResponse.ok) throw new Error('Dein erster Stack konnte nicht angelegt werden.');
        stackRows = [await createdResponse.json() as Record<string, unknown>];
      }
      const details = await Promise.all(stackRows.map(async (row) => {
        const detailResponse = await credentialedFetch(apiPath(`/stacks/${String(row.id)}`));
        const detail = detailResponse.ok ? await detailResponse.json() as Record<string, unknown> : undefined;
        return migrateLegacyDescription(mapStackDetail(row, detail));
      }));
      const stacks = await Promise.all(details);
      setState((current) => ({
        stacks,
        activeStackId: stacks.some((stack) => stack.id === current.activeStackId) ? current.activeStackId : stacks[0].id,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Deine Stacks konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [migrateLegacyDescription]);

  useEffect(() => {
    void getPublicIntakeTimings().then(setTimingOptions).catch(() => setTimingOptions([]));
    credentialedFetch(apiPath('/shop-domains')).then((response) => response.ok ? response.json() : { shops: [] })
      .then((data: { shops?: ShopDomain[] }) => setShopDomains(data.shops ?? [])).catch(() => setShopDomains([]));
  }, []);

  useEffect(() => {
    if (mode === 'authenticated') {
      void loadAuthenticatedStacks();
      return;
    }
    const fresh = createDefaultState();
    credentialedFetch(apiPath('/demo/products')).then((response) => response.ok ? response.json() : { products: [] })
      .then((data: { products?: DemoProduct[] }) => {
        const products = applySequentialSortOrder((data.products ?? []).slice(0, 6).map((product) => ({ ...product, quantity: productServingsPerDay(product), intake_interval_days: product.intake_interval_days ?? 1 })));
        setState({ stacks: [{ ...fresh.stacks[0], products }], activeStackId: fresh.activeStackId });
      }).catch(() => setState(fresh));
  }, [loadAuthenticatedStacks, mode]);

  useEffect(() => {
    if (loading || state.stacks.length === 0) return;
    const params = new URLSearchParams(location.search);
    const requested = params.get('stack');
    if (requested && state.stacks.some((stack) => stack.id === requested)) {
      setState((current) => current.activeStackId === requested
        ? current
        : { ...current, activeStackId: requested });
    } else if (requested) {
      setStatus('Dieser Stack ist nicht verfügbar. Vielleicht wurde er gelöscht oder gehört zu einem anderen Konto.');
      replaceSearch((next) => next.delete('stack'));
    } else {
      const firstStackId = state.stacks[0].id;
      setState((current) => current.activeStackId === firstStackId
        ? current
        : { ...current, activeStackId: firstStackId });
    }
    const openSearchRequest = `${location.key}:${location.search}`;
    if (params.get('openSearch') === '1' && openSearchHandled.current !== openSearchRequest) {
      openSearchHandled.current = openSearchRequest;
      setAddDraft(loadAddDraft());
      setAddModalOpen(true);
      replaceSearch((next) => next.delete('openSearch'));
    }
  }, [loading, location.key, location.search, replaceSearch, state.stacks]);

  useEffect(() => {
    if (!activeStack) return;
    setSelectedKeys(new Set(activeStack.products.map(productStackKey)));
    if (mode === 'authenticated' && creatorSharingEnabled) {
      const id = Number(activeStack.id);
      if (Number.isSafeInteger(id) && id > 0) void markStackOpened(id).catch(() => undefined);
    }
  }, [activeStack, mode]);

  useEffect(() => { window.localStorage.setItem(STACK_VIEW_KEY, viewMode); }, [viewMode]);
  useEffect(() => { window.localStorage.setItem(STACK_SORT_KEY, sortMode); }, [sortMode]);

  const persistProducts = useCallback(async (stack: DemoStack, products: DemoProduct[]): Promise<DemoStack> => {
    const normalized = applySequentialSortOrder(products);
    if (isDemo) return { ...stack, products: normalized };
    const response = await credentialedFetch(apiPath(`/stacks/${stack.id}`), {
      method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({
        expected_stack_version: stack.version,
        expected_items: stack.products.flatMap((product) => (
          Number.isInteger(product.stack_item_id) && Number.isInteger(product.version)
            ? [{ stack_item_id: product.stack_item_id, expected_version: product.version }]
            : []
        )),
        product_ids: normalized.map((product) => ({
          id: product.id,
          product_type: product.product_type ?? 'catalog',
          quantity: productServingsPerDay(product),
          intake_interval_days: productInterval(product),
          dosage_text: product.dosage_text,
          timing: product.timing,
          sort_order: product.sort_order,
        })),
      }),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Stack konnte nicht gespeichert werden.');
    return mapStackDetail(data.stack && typeof data.stack === 'object' ? data.stack as Record<string, unknown> : { id: stack.id, name: stack.name }, data);
  }, [isDemo]);

  const replaceStackInState = useCallback((nextStack: DemoStack) => {
    setState((current) => ({ ...current, stacks: current.stacks.map((stack) => stack.id === nextStack.id ? nextStack : stack) }));
  }, []);

  const selectStack = (stackId: string) => {
    setState((current) => ({ ...current, activeStackId: stackId }));
    const params = new URLSearchParams(location.search);
    params.set('stack', stackId);
    navigate(`${location.pathname}?${params.toString()}${location.hash}`);
  };

  const createStack = async () => {
    const name = `Stack ${state.stacks.length + 1}`;
    if (isDemo) {
      const created = { id: newStackId(), name, description: '', products: [] };
      setState((current) => ({ stacks: [...current.stacks, created], activeStackId: created.id }));
      selectStack(created.id);
      return;
    }
    setBusy(true);
    try {
      const response = await credentialedFetch(apiPath('/stacks'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name, product_ids: [] }) });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Stack konnte nicht angelegt werden.');
      const created = mapStackDetail(data);
      setState((current) => ({ stacks: [...current.stacks, created], activeStackId: created.id }));
      selectStack(created.id);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Stack konnte nicht angelegt werden.');
    } finally {
      setBusy(false);
    }
  };

  const saveStackMeta = async (name: string, description: string) => {
    if (!activeStack) return;
    if (isDemo) {
      replaceStackInState({ ...activeStack, name, description });
      setEditStackOpen(false);
      return;
    }
    const response = await credentialedFetch(apiPath(`/stacks/${activeStack.id}`), {
      method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({
        name,
        description,
        expected_stack_version: activeStack.version,
      }),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Stack konnte nicht gespeichert werden.');
    replaceStackInState(mapStackDetail(data.stack as Record<string, unknown>, data));
    setEditStackOpen(false);
    setStatus('Stackname und Beschreibung wurden gespeichert.');
  };

  const addProduct = async (product: DemoProduct, targetStackId: string, replaceProductKey?: string) => {
    const target = state.stacks.find((stack) => stack.id === targetStackId);
    if (!target) throw new Error('Ziel-Stack wurde nicht gefunden.');
    const retained = replaceProductKey
      ? target.products.filter((entry) => productStackKey(entry) !== replaceProductKey)
      : target.products;
    if (retained.some((entry) => productStackKey(entry) === productStackKey(product))) throw new Error('Dieses Produkt ist bereits im Ziel-Stack.');
    const persisted = await persistProducts(target, [...retained, product]);
    replaceStackInState(persisted);
    selectStack(targetStackId);
    setStatus(replaceProductKey
      ? `${productName(product)} hat das bisherige Produkt in „${target.name}“ ersetzt.`
      : `${productName(product)} wurde zu „${target.name}“ hinzugefügt.`);
  };

  const updateProduct = async (key: string, patch: Partial<DemoProduct>) => {
    if (!activeStack) return;
    const products = activeStack.products.map((product) => productStackKey(product) === key ? { ...product, ...patch } : product);
    replaceStackInState(await persistProducts(activeStack, products));
    setStatus('Einnahmemenge und Rhythmus wurden gespeichert.');
  };

  const removeProduct = async () => {
    if (!activeStack || !deleteProductKey) return;
    setBusy(true);
    try {
      const products = activeStack.products.filter((product) => productStackKey(product) !== deleteProductKey);
      replaceStackInState(await persistProducts(activeStack, products));
      setDeleteProductKey(null);
      setStatus('Produkt wurde aus dem Stack entfernt.');
      window.requestAnimationFrame(() => addProductButtonRef.current?.focus());
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Produkt konnte nicht entfernt werden.');
    } finally {
      setBusy(false);
    }
  };

  const moveProduct = async (key: string, direction: -1 | 1) => {
    if (!activeStack) return;
    const manual = sortedProducts(activeStack.products, 'manual');
    const index = manual.findIndex((product) => productStackKey(product) === key);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= manual.length) return;
    [manual[index], manual[targetIndex]] = [manual[targetIndex], manual[index]];
    const normalized = applySequentialSortOrder(manual);
    replaceStackInState({ ...activeStack, products: normalized });
    setSortMode('manual');
    try {
      if (!isDemo && normalized.every((product) => Number.isFinite(product.stack_item_id))) {
        await updateStackItemsLayout(activeStack.id, { items: normalized.map((product) => ({
          stack_item_id: product.stack_item_id as number,
          sort_order: product.sort_order ?? 0,
          expected_version: product.version ?? 1,
        })) });
        await loadAuthenticatedStacks();
      } else if (!isDemo) {
        replaceStackInState(await persistProducts(activeStack, normalized));
      }
      setStatus(`${productName(manual[targetIndex])} wurde ${direction < 0 ? 'nach oben' : 'nach unten'} verschoben.`);
    } catch {
      void loadAuthenticatedStacks();
      setStatus('Die Reihenfolge konnte nicht gespeichert werden. Bitte versuche es erneut.');
    }
  };

  const sendEmail = async () => {
    if (!activeStack || isDemo) return;
    setBusy(true);
    try {
      const response = await credentialedFetch(apiPath(`/stacks/${activeStack.id}/email`), { method: 'POST', headers: JSON_HEADERS });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'E-Mail konnte nicht gesendet werden.');
      setEmailConfirmOpen(false);
      setStatus(`„${activeStack.name}“ wurde an ${user?.email ?? 'deine Account-Adresse'} gesendet.`);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'E-Mail konnte nicht gesendet werden.');
    } finally {
      setBusy(false);
    }
  };

  const trashStack = async () => {
    if (!activeStack) return;
    setBusy(true);
    try {
      if (!isDemo) {
        const response = await credentialedFetch(apiPath(`/stacks/${activeStack.id}`), { method: 'DELETE' });
        const data = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Stack konnte nicht in den Papierkorb verschoben werden.');
      }
      const stacks = state.stacks.filter((stack) => stack.id !== activeStack.id);
      if (stacks.length === 0) {
        if (isDemo) {
          const fresh = createDefaultState();
          setState(fresh);
        } else await loadAuthenticatedStacks();
      } else setState({ stacks, activeStackId: stacks[0].id });
      setDeleteStackOpen(false);
      setStatus(isDemo ? 'Stack wurde entfernt.' : 'Stack liegt jetzt 7 Tage im Papierkorb und kann dort wiederhergestellt werden.');
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Stack konnte nicht gelöscht werden.');
    } finally {
      setBusy(false);
    }
  };

  const openTrash = async () => {
    setTrashOpen(true);
    if (isDemo) return;
    try { setTrash(await getTrashedStacks()); } catch { setStatus('Papierkorb konnte nicht geladen werden.'); }
  };

  const restore = async (stack: TrashedStack) => {
    setBusy(true);
    try {
      await restoreStack(stack.id);
      setTrash((current) => current.filter((entry) => entry.id !== stack.id));
      await loadAuthenticatedStacks();
      setStatus(`„${stack.name}“ wurde wiederhergestellt.`);
    } catch {
      setStatus('Der Stack konnte nicht wiederhergestellt werden. Vielleicht ist die 7-Tage-Frist abgelaufen.');
    } finally { setBusy(false); }
  };

  const registerFromDemo = () => {
    persistDemoHandoff(state);
    navigate('/register', { state: { redirect: '/stacks', demoStackHandoffKey: DEMO_STACK_HANDOFF_KEY } });
  };

  const requestSignedIn = (title: string) => {
    if (user) {
      setNotice({
        title: 'Funktion in deinen Stacks nutzen',
        message: 'Du bist bereits angemeldet. Änderungen in dieser Demo werden nicht in deinem Konto gespeichert. Öffne „Meine Stacks“, um die Funktion mit deinen gespeicherten Daten zu nutzen.',
        primaryLabel: 'Meine Stacks öffnen',
        onPrimary: () => navigate('/stacks'),
      });
      return;
    }
    setNotice({ title, message: DEMO_SIGN_IN_TEXT, primaryLabel: 'Kostenlos anmelden', onPrimary: registerFromDemo });
  };

  const handleLinkReport = async (product: DemoProduct, reason: 'missing_link' | 'invalid_link') => {
    if (isDemo || !activeStack) {
      requestSignedIn('Link kostenlos melden');
      return;
    }
    setLinkReportRetry(null);
    setLinkReportStatus(`Meldung zu „${productName(product)}“ wird gesendet …`);
    try {
      await reportProductLink({ product_id: product.id, product_type: product.product_type ?? 'catalog', stack_id: activeStack.id, reason });
      setLinkReportRetry(null);
      setLinkReportStatus(`Danke. Der Link zu „${productName(product)}“ wurde gemeldet. Du kannst das Produkt weiterhin bearbeiten oder entfernen.`);
    } catch {
      setLinkReportRetry({ product, reason });
      setLinkReportStatus(`Die Meldung zu „${productName(product)}“ konnte nicht gesendet werden.`);
    }
  };

  const header = standaloneHeader ?? false;
  const title = view === 'routine' ? 'Mein Einnahmeplan' : isDemo ? 'Supplement Stack kostenlos testen' : 'Meine Stacks';
  const subtitle = view === 'routine'
    ? 'Alle geplanten Einnahmen verständlich nach Tageszeit sortiert.'
    : isDemo
      ? user
        ? 'Du bist angemeldet. Diese Demo bleibt getrennt von deinen gespeicherten Stacks; dauerhafte Änderungen nimmst du unter „Meine Stacks“ vor.'
        : 'Alle Stack-Funktionen sind kostenlos nutzbar. Zum dauerhaften Speichern und Versenden meldest du dich kostenlos an.'
      : 'Stacks anlegen, vergleichen und auf jedem Gerät weiterführen.';

  const rightSlot = user ? <><span className="header-email">{getUserDisplayName(user)}</span><button type="button" className="btn-logout" onClick={() => void logout()}>Abmelden</button></> : undefined;

  const routineGroups = (Object.keys(ROUTINE_META) as RoutineKey[]).map((key) => ({
    key,
    ...ROUTINE_META[key],
    products: (activeStack?.products ?? []).filter((product) => routineKeysForTiming(product.timing).includes(key)),
  }));

  if (view === 'routine') {
    return (
      <>
        {header && <StacksHeader variant={HEADER_VARIANT} title={title} subtitle={subtitle} rightSlot={rightSlot} />}
        <div className="ss-page ss-page-embedded ss-routine-page">
          {!header && <div className="ss-inline-page-heading"><h1>{title}</h1><p>{subtitle}</p></div>}
          <div className="ss-stack-list" aria-label="Stacks auswählen">{state.stacks.map((stack) => <button type="button" key={stack.id} className={`ss-stack-list-item${stack.id === activeStack?.id ? ' is-active' : ''}`} onClick={() => selectStack(stack.id)}><strong>{stack.name}</strong><span>{stack.products.length} Produkte</span></button>)}</div>
          {activeStack && <div className="ss-routine-actions"><button type="button" className="ss-btn ss-btn-outline" onClick={() => window.print()}><Printer size={17} />Drucken</button><button type="button" className="ss-btn ss-btn-outline" onClick={() => isDemo ? requestSignedIn('PDF kostenlos erstellen') : downloadStackPdf(activeStack)}><Download size={17} />PDF erstellen</button></div>}
          <div className="routine-grid">{routineGroups.map((group) => <section key={group.key} className="routine-column"><div className="routine-column-head"><strong>{group.label}</strong><span>{group.products.length}</span></div><p>{group.hint}</p>{group.products.length === 0 ? <div className="routine-empty">Keine Produkte</div> : <div className="routine-list">{group.products.map((product) => <div key={`${group.key}-${productStackKey(product)}`} className="routine-item"><strong>{productName(product)}</strong><span>{productIntakeLabel(product)}</span><small>{product.timing_label || product.ingredient_timing_label || 'Flexibel'}</small></div>)}</div>}</section>)}</div>
        </div>
        {notice && <NoticeDialog {...notice} onClose={() => setNotice(null)} />}
      </>
    );
  }

  const deletingProduct = activeStack?.products.find((product) => productStackKey(product) === deleteProductKey);
  const editingProduct = activeStack?.products.find((product) => productStackKey(product) === editingProductKey);

  return (
    <>
      {header && <StacksHeader variant={HEADER_VARIANT} title={title} subtitle={subtitle} rightSlot={rightSlot} />}
      <div className={header ? 'ss-page' : 'ss-page ss-page-embedded'}>
        {!header && <div className="ss-inline-page-heading"><h1>{title}</h1><p>{subtitle}</p></div>}
        {creatorReturn && (
          <div className="info-banner" role="status">
            <Undo2 size={18} />
            <div>
              <strong>Dein Creator-Entwurf bleibt gespeichert.</strong>{' '}
              <span>Prüfe oder ändere den Stack. Danach kannst du genau diese Empfehlung weiterbearbeiten.</span>
            </div>
            <button type="button" className="ss-btn ss-btn-outline" onClick={() => navigate(creatorReturn)}>
              Zur Empfehlung zurück
            </button>
          </div>
        )}
        {isDemo && <div className="info-banner info-banner-demo"><Info size={18} /><div><strong>Alle Stack-Funktionen nutzbar.</strong> <span>{user ? 'Du kannst alles ausprobieren. Für deine gespeicherten Daten öffnest du anschließend „Meine Stacks“.' : 'Speichern, E-Mail, PDF und eigene Produkte sind nach einer kostenlosen Anmeldung verfügbar. Der Hinweis erscheint immer vorab.'}</span></div></div>}
        {error && <p className="ss-live-status ss-live-status-error" role="alert">{error}</p>}
        {status && <p className="ss-live-status" role="status">{status}</p>}

        <div className="ss-stack-browser">
          <div className="ss-stack-browser-heading"><div><h2>Deine Stacks untereinander</h2><p>Öffne einen Stack, ohne den Überblick über die anderen zu verlieren.</p></div><button type="button" className="ss-btn ss-btn-green" onClick={() => void createStack()} disabled={busy}><Plus size={17} />Neuen Stack anlegen</button></div>
          <div className="ss-stack-list">{state.stacks.map((stack) => (
            <article key={stack.id} className={`ss-stack-list-section${stack.id === activeStack?.id ? ' is-active' : ''}`}>
              <button type="button" className="ss-stack-list-item" aria-expanded={stack.id === activeStack?.id} onClick={() => selectStack(stack.id)}><div><strong>{stack.name}</strong>{stack.description && <small>{stack.description}</small>}</div><span>{stack.products.length} {stack.products.length === 1 ? 'Produkt' : 'Produkte'}</span><ChevronDown size={18} /></button>
            </article>
          ))}</div>
          {!isDemo && <button type="button" className="ss-trash-link" onClick={() => void openTrash()}><Trash2 size={16} />Papierkorb öffnen</button>}
        </div>

        {loading && <div className="ss-loading" role="status">Stacks werden geladen …</div>}
        {!loading && activeStack && (
          <section className="ss-active-stack" aria-labelledby="active-stack-title">
            <div className="ss-active-stack-heading"><div><h2 id="active-stack-title">{activeStack.name}</h2><p>{activeStack.description || 'Noch keine Beschreibung. Du kannst Ziele oder den Zeitraum ergänzen.'}</p></div>{activeStack.origin_party_name && <span className="ss-creator-origin">Aus der Empfehlung von {activeStack.origin_party_name}</span>}</div>
            <div className="ss-toolbar" aria-label="Stack-Aktionen">
              <button ref={addProductButtonRef} type="button" className="ss-btn ss-btn-green ss-toolbar-primary-action" onClick={() => { setAddDraft(null); setAddModalOpen(true); }}><Plus size={17} />Produkt hinzufügen</button>
              <button type="button" className="ss-btn ss-btn-outline" onClick={() => setEditStackOpen(true)}><Pencil size={17} />Stack bearbeiten</button>
              <button type="button" className="ss-btn ss-btn-outline" onClick={() => isDemo ? requestSignedIn('Stack kostenlos per E-Mail senden') : setEmailConfirmOpen(true)}><Mail size={17} />Per E-Mail senden</button>
              <button type="button" className="ss-btn ss-btn-outline" onClick={() => window.print()}><Printer size={17} />Drucken</button>
              <button type="button" className="ss-btn ss-btn-outline" onClick={() => isDemo ? requestSignedIn('PDF kostenlos erstellen') : downloadStackPdf(activeStack)}><Download size={17} />PDF erstellen</button>
              <button type="button" className="ss-btn ss-btn-red-soft" onClick={() => setDeleteStackOpen(true)}><Trash2 size={17} />In Papierkorb</button>
            </div>

            <div className="ss-product-area-heading"><div><h2>Produkte</h2><p>Die Auswahl bestimmt, was in der Kostenübersicht enthalten ist.</p></div><div className="ss-product-view-controls"><label>Sortierung<select value={sortMode} onChange={(event) => setSortMode(event.target.value as ProductSortMode)}><option value="manual">Manuell</option><option value="az">A–Z</option><option value="timing">Nach Einnahmezeit</option></select></label><div role="group" aria-label="Produktansicht"><button type="button" className={viewMode === 'grid' ? 'active' : ''} aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><LayoutGrid size={16} />Kacheln</button><button type="button" className={viewMode === 'list' ? 'active' : ''} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List size={16} />Liste</button></div></div></div>
            {sortMode === 'manual' && activeProducts.length > 1 && <p className="ss-manual-help">Manuelle Reihenfolge: Verschiebe Produkte mit „Nach oben“ und „Nach unten“. Die feste Rastervorschau bleibt dabei stabil und ist vollständig per Tastatur nutzbar.</p>}

            {activeProducts.length === 0 ? (
              <div className="ss-empty-stack"><Package size={34} /><h3>„{activeStack.name}“ ist noch leer</h3><p>Füge dein erstes Produkt über eine Wirkstoffsuche hinzu.</p><button ref={addProductButtonRef} type="button" className="ss-btn ss-btn-green" onClick={() => setAddModalOpen(true)}><Plus size={17} />Produkt hinzufügen</button></div>
            ) : (
              <div className={viewMode === 'grid' ? 'ss-stable-product-grid' : 'product-list-view'}>
                {activeProducts.map((product, index) => {
                  const key = productStackKey(product);
                  return <div key={key} className="ss-product-shell">
                    {sortMode === 'manual' && <div className="ss-manual-order-actions" role="group" aria-label={`Reihenfolge für ${productName(product)}`}><button type="button" disabled={index === 0} onClick={() => void moveProduct(key, -1)} aria-label={`${productName(product)} nach oben verschieben`}><ArrowUp size={15} />Nach oben</button><button type="button" disabled={index === activeProducts.length - 1} onClick={() => void moveProduct(key, 1)} aria-label={`${productName(product)} nach unten verschieben`}><ArrowDown size={15} />Nach unten</button></div>}
                    {product.creator_statement_snapshot && <div className="ss-creator-note"><strong>Hinweis des Creators:</strong> {product.creator_statement_snapshot}</div>}
                    <ProductCard product={product} shopDomains={shopDomains} selected={selectedKeys.has(key)} display={viewMode === 'list' ? 'list' : 'card'} onToggleSelected={() => setSelectedKeys((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; })} onEdit={() => setEditingProductKey(key)} onDelete={() => setDeleteProductKey(key)} onReportMissingLink={(item, reason) => void handleLinkReport(item as DemoProduct, reason)} />
                  </div>;
                })}
              </div>
            )}

            {linkReportStatus && <div className="ss-link-report-status" aria-live="polite"><span>{linkReportStatus}</span>{linkReportRetry && <button type="button" className="ss-btn ss-btn-outline" onClick={() => void handleLinkReport(linkReportRetry.product, linkReportRetry.reason)}>Erneut versuchen</button>}</div>}

            {ingredientTotals.length > 0 && (
              <details className="ss-ingredient-summary">
                <summary><span><strong>Wirkstoffe pro Tag</strong><small>Zusammenfassung aus allen Produkten dieses Stacks</small></span><ChevronDown size={18} /></summary>
                <div className="ss-ingredient-summary-grid">{ingredientTotals.map((ingredient) => <div key={ingredient.ingredient_id}><strong>{ingredient.ingredient_name}</strong><span>{ingredient.totals.length ? ingredient.totals.map((amount) => `${amount.quantity.toLocaleString('de-DE', { maximumFractionDigits: 3 })} ${amount.unit}`).join(' + ') : 'Nicht addierbar – unterschiedliche oder fehlende Einheiten'}</span></div>)}</div>
              </details>
            )}
            <p className="ss-print-health-note">Gesundheitshinweis: Diese Übersicht dient der Orientierung und ersetzt keine persönliche medizinische Beratung, Diagnose oder Behandlung.</p>
          </section>
        )}
      </div>

      {activeStack && activeProducts.length > 0 && <div className="bottom-bar" aria-live="polite"><div><div className="bb-title">Kostenübersicht</div><div className="bb-sub">{selectedKeys.size} von {activeProducts.length} Produkten enthalten</div></div><div className="bb-prices"><div className="bb-price-block"><div className="bb-price-label">Packungen einmalig</div><div className="bb-price-value">{formatEuro(totalOnce)} €</div></div><div className="bb-divider" /><div className="bb-price-block"><div className="bb-price-label">Aus Nutzung pro Monat</div><div className="bb-price-value">{formatEuro(totalMonthly)} €</div></div><button type="button" className="btn-select-all" onClick={() => setSelectedKeys(selectedKeys.size === activeProducts.length ? new Set() : new Set(activeProducts.map(productStackKey)))}>{selectedKeys.size === activeProducts.length ? 'Alle abwählen' : 'Alle auswählen'}</button></div></div>}

      {addModalOpen && <AddProductModal stacks={state.stacks} activeStackId={state.activeStackId} isDemo={isDemo} guidelineSource={user?.guideline_source ?? 'DGE'} initialDraft={addDraft} onAdd={addProduct} onClose={() => { setAddModalOpen(false); setAddDraft(null); }} onRequestOwnProduct={(draft) => { if (isDemo) { requestSignedIn('Eigenes Produkt kostenlos anlegen'); return; } if (draft) window.sessionStorage.setItem(ADD_PRODUCT_DRAFT_KEY, JSON.stringify(draft)); navigate('/my-products?returnTo=%2Fstacks%3FopenSearch%3D1'); }} onEditExistingProduct={(key) => { setAddModalOpen(false); setEditingProductKey(key); }} />}
      {editStackOpen && activeStack && <EditStackModal initialName={activeStack.name} initialDescription={activeStack.description} onSave={saveStackMeta} onClose={() => setEditStackOpen(false)} />}
      {editingProduct && <EditProductModal product={editingProduct} timingOptions={timingOptions} onSave={(patch) => updateProduct(productStackKey(editingProduct), patch)} onClose={() => setEditingProductKey(null)} />}
      {deleteProductKey && <ConfirmDialog title="Produkt aus dem Stack entfernen?" confirmLabel="Produkt entfernen" danger busy={busy} onConfirm={() => void removeProduct()} onClose={() => setDeleteProductKey(null)}><strong>{deletingProduct ? productName(deletingProduct) : 'Dieses Produkt'}</strong> wird aus „{activeStack?.name}“ entfernt. Andere Produkte bleiben unverändert.</ConfirmDialog>}
      {deleteStackOpen && activeStack && <ConfirmDialog title="Stack in den Papierkorb verschieben?" confirmLabel="In Papierkorb verschieben" danger busy={busy} onConfirm={() => void trashStack()} onClose={() => setDeleteStackOpen(false)}>„{activeStack.name}“ mit {activeStack.products.length} {activeStack.products.length === 1 ? 'Produkt' : 'Produkten'} wird für 7 Tage in den Papierkorb verschoben. In dieser Zeit kannst du ihn wiederherstellen; danach wird er vollständig gelöscht.</ConfirmDialog>}
      {emailConfirmOpen && activeStack && <ConfirmDialog title="Stack per E-Mail senden?" confirmLabel="Jetzt senden" busy={busy} onConfirm={() => void sendEmail()} onClose={() => setEmailConfirmOpen(false)}>Gesendet wird „{activeStack.name}“ mit {activeStack.products.length} Produkten{activeStack.origin_party_name ? ` und dem sichtbaren Creator-Bezug zu ${activeStack.origin_party_name}` : ''} an deine Account-Adresse <strong>{user?.email}</strong>.</ConfirmDialog>}
      {notice && <NoticeDialog {...notice} onClose={() => setNotice(null)} />}
      {trashOpen && <ModalWrapper onClose={() => setTrashOpen(false)} title="Papierkorb" size="lg"><div className="ss-trash-modal"><p className="ss-modal-copy">Stacks bleiben ab dem Löschzeitpunkt 7 Tage wiederherstellbar. Danach entfernt der Server sie samt Produkten aus dem Stack.</p>{trash.length === 0 ? <div className="ss-empty-inline">Der Papierkorb ist leer.</div> : <div className="ss-trash-list">{trash.map((stack) => <article key={stack.id}><div><strong>{stack.name}</strong><span>{stack.items_count} Produkte · Löschung am {new Date(`${stack.delete_purge_after.replace(' ', 'T')}Z`).toLocaleString('de-DE')}</span></div><button type="button" className="ss-btn ss-btn-outline" disabled={busy} onClick={() => void restore(stack)}><Undo2 size={16} />Wiederherstellen</button></article>)}</div>}</div></ModalWrapper>}
    </>
  );
}

export default StackWorkspace;
