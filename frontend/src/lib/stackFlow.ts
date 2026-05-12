export const DEMO_STACK_TRANSFER_KEY = 'supplement-stack-demo-stacks';

export type StackProductType = 'catalog' | 'user_product';

export interface StackFlowIngredient {
  ingredient_id: number;
  ingredient_name?: string | null;
  parent_ingredient_id?: number | null;
  quantity?: number | null;
  unit?: string | null;
  basis_quantity?: number | null;
  basis_unit?: string | null;
  search_relevant?: number | boolean | null;
}

export interface StackFlowProduct {
  id: number;
  product_type?: StackProductType;
  name: string;
  brand?: string;
  form?: string;
  price: number;
  quantity?: number;
  intake_interval_days?: number;
  dosage_text?: string;
  timing?: string;
  ingredients?: StackFlowIngredient[];
}

export interface StackFlowStack {
  id: string;
  name: string;
  products: StackFlowProduct[];
  description?: string;
  family_member_id?: number | null;
  family_member_first_name?: string | null;
}

export interface DemoStackSnapshot {
  activeStackId: string;
  stacks: StackFlowStack[];
  savedAt: string;
}

export interface StackProductPayload {
  id: number;
  product_type: StackProductType;
  quantity?: number;
  intake_interval_days?: number;
  dosage_text?: string;
  timing?: string;
}

export interface DuplicateIngredientMatch {
  product: StackFlowProduct;
  productKey: string;
}

export interface IngredientDailyTotal {
  ingredientId: number;
  label: string;
  total: number;
  unit: string;
}

export interface DemoStackTransferResult {
  importedStacks: number;
  importedProducts: number;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function stackProductKey(product: Pick<StackFlowProduct, 'id' | 'product_type'>): string {
  return `${product.product_type ?? 'catalog'}:${product.id}`;
}

function isStackProduct(value: unknown): value is StackFlowProduct {
  if (!value || typeof value !== 'object') return false;
  const product = value as Partial<StackFlowProduct>;
  return Number.isInteger(product.id) && typeof product.name === 'string' && typeof product.price === 'number';
}

function sanitizeStack(value: unknown): StackFlowStack | null {
  if (!value || typeof value !== 'object') return null;
  const stack = value as Partial<StackFlowStack>;
  if (typeof stack.id !== 'string' || typeof stack.name !== 'string' || !Array.isArray(stack.products)) {
    return null;
  }
  const products = stack.products.filter(isStackProduct);
  return {
    id: stack.id,
    name: stack.name.trim() || 'Demo Stack',
    products,
    description: typeof stack.description === 'string' ? stack.description : undefined,
    family_member_id: null,
    family_member_first_name: null,
  };
}

export function writeDemoStackSnapshot(
  storage: Pick<Storage, 'setItem'> | undefined,
  snapshot: Omit<DemoStackSnapshot, 'savedAt'>,
): void {
  if (!storage) return;
  const stacks = snapshot.stacks.map((stack) => sanitizeStack(stack)).filter((stack): stack is StackFlowStack => stack !== null);
  if (stacks.length === 0) return;
  storage.setItem(DEMO_STACK_TRANSFER_KEY, JSON.stringify({
    activeStackId: snapshot.activeStackId,
    stacks,
    savedAt: new Date().toISOString(),
  }));
}

export function readDemoStackSnapshot(storage: Pick<Storage, 'getItem'> | undefined): DemoStackSnapshot | null {
  if (!storage) return null;
  const raw = storage.getItem(DEMO_STACK_TRANSFER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DemoStackSnapshot>;
    if (!Array.isArray(parsed.stacks) || typeof parsed.activeStackId !== 'string') return null;
    const stacks = parsed.stacks.map((stack) => sanitizeStack(stack)).filter((stack): stack is StackFlowStack => stack !== null);
    if (stacks.length === 0) return null;
    const activeStackId = stacks.some((stack) => stack.id === parsed.activeStackId)
      ? parsed.activeStackId
      : stacks[0].id;
    return {
      activeStackId,
      stacks,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return null;
  }
}

export function clearDemoStackSnapshot(storage: Pick<Storage, 'removeItem'> | undefined): void {
  storage?.removeItem(DEMO_STACK_TRANSFER_KEY);
}

export function buildStackProductPayload(products: StackFlowProduct[]): StackProductPayload[] {
  return products.map((product) => ({
    id: product.id,
    product_type: product.product_type ?? 'catalog',
    quantity: product.quantity,
    intake_interval_days: product.intake_interval_days,
    dosage_text: product.dosage_text,
    timing: product.timing,
  }));
}

export function findDuplicateIngredientInStack(
  stacks: StackFlowStack[],
  stackId: string,
  ingredientId: number,
): DuplicateIngredientMatch | null {
  const stack = stacks.find((item) => item.id === stackId);
  if (!stack) return null;
  for (const product of stack.products) {
    const hasIngredient = (product.ingredients ?? []).some((ingredient) => {
      if (ingredient.search_relevant === false || ingredient.search_relevant === 0) return false;
      return (ingredient.parent_ingredient_id ?? ingredient.ingredient_id) === ingredientId;
    });
    if (hasIngredient) {
      return { product, productKey: stackProductKey(product) };
    }
  }
  return null;
}

export function summarizeDailyIngredientTotals(products: StackFlowProduct[]): IngredientDailyTotal[] {
  const totals = new Map<string, IngredientDailyTotal>();
  for (const product of products) {
    const servingsPerIntake = product.quantity && Number.isFinite(product.quantity) && product.quantity > 0
      ? product.quantity
      : 1;
    const intervalDays = product.intake_interval_days && product.intake_interval_days > 0
      ? product.intake_interval_days
      : 1;
    for (const ingredient of product.ingredients ?? []) {
      if (ingredient.search_relevant === false || ingredient.search_relevant === 0) continue;
      if (!ingredient.quantity || !ingredient.unit) continue;
      const basisQuantity = ingredient.basis_quantity && ingredient.basis_quantity > 0 ? ingredient.basis_quantity : 1;
      const dailyAmount = (ingredient.quantity / basisQuantity) * servingsPerIntake / intervalDays;
      if (!Number.isFinite(dailyAmount) || dailyAmount <= 0) continue;
      const ingredientId = ingredient.parent_ingredient_id ?? ingredient.ingredient_id;
      const key = `${ingredientId}:${ingredient.unit}`;
      const existing = totals.get(key);
      if (existing) {
        existing.total += dailyAmount;
      } else {
        totals.set(key, {
          ingredientId,
          label: ingredient.ingredient_name || `Wirkstoff ${ingredientId}`,
          total: dailyAmount,
          unit: ingredient.unit,
        });
      }
    }
  }
  return [...totals.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

export async function transferDemoStacksToAccount(
  storage: Storage | undefined,
  fetcher: Fetcher,
  apiPath: (path: string) => string,
): Promise<DemoStackTransferResult> {
  const snapshot = readDemoStackSnapshot(storage);
  if (!snapshot) return { importedStacks: 0, importedProducts: 0 };

  let importedStacks = 0;
  let importedProducts = 0;
  for (const stack of snapshot.stacks) {
    const products = buildStackProductPayload(stack.products);
    const res = await fetcher(apiPath('/stacks'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: stack.name || 'Demo Stack',
        product_ids: products,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? 'Demo-Stack konnte nicht übernommen werden.');
    }
    importedStacks += 1;
    importedProducts += products.length;
  }
  clearDemoStackSnapshot(storage);
  return { importedStacks, importedProducts };
}
