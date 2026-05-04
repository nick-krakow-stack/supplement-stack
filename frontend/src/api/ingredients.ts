import { apiClient } from './client';
import type { Ingredient, IngredientSynonym, IngredientForm, Recommendation } from '../types';
import type { IngredientSubIngredient } from '../types/local';

export async function searchIngredients(query: string): Promise<{ ingredients: Ingredient[] }> {
  const res = await apiClient.get<{ ingredients: Ingredient[] }>('/ingredients/search', {
    params: { q: query },
  });
  return res.data;
}

export async function getIngredient(id: number): Promise<Ingredient> {
  const res = await apiClient.get<Ingredient>(`/ingredients/${id}`);
  return res.data;
}

export async function createIngredient(data: Partial<Ingredient>): Promise<Ingredient> {
  const res = await apiClient.post<Ingredient>('/ingredients', data);
  return res.data;
}

export async function updateIngredient(id: number, data: Partial<Ingredient>): Promise<Ingredient> {
  const res = await apiClient.put<Ingredient>(`/ingredients/${id}`, data);
  return res.data;
}

export async function addSynonym(
  ingredientId: number,
  synonym: string
): Promise<IngredientSynonym> {
  const res = await apiClient.post<IngredientSynonym>(
    `/ingredients/${ingredientId}/synonyms`,
    { synonym }
  );
  return res.data;
}

export async function deleteSynonym(ingredientId: number, synId: number): Promise<void> {
  await apiClient.delete(`/ingredients/${ingredientId}/synonyms/${synId}`);
}

export async function addForm(
  ingredientId: number,
  data: Partial<IngredientForm>
): Promise<IngredientForm> {
  const res = await apiClient.post<IngredientForm>(`/ingredients/${ingredientId}/forms`, data);
  return res.data;
}

export async function deleteForm(ingredientId: number, formId: number): Promise<void> {
  await apiClient.delete(`/ingredients/${ingredientId}/forms/${formId}`);
}

export async function getRecommendations(ingredientId: number): Promise<Recommendation[]> {
  const res = await apiClient.get<Recommendation[]>(`/ingredients/${ingredientId}/recommendations`);
  return res.data;
}

type RawIngredientSubIngredient = Partial<IngredientSubIngredient & {
  childIngredientId?: number;
  childName?: string;
  child_unit?: string;
  promptLabel?: string;
  sortOrder?: number;
}>;

function normalizeSubIngredientCandidate(raw: RawIngredientSubIngredient): IngredientSubIngredient | null {
  const parentIngredientId = raw.parent_ingredient_id ?? -1;
  const childIngredientId = raw.child_ingredient_id ?? raw.childIngredientId;
  const childName = raw.child_name ?? raw.childName;

  if (!Number.isFinite(childIngredientId as number) || childIngredientId === undefined || childIngredientId === null) {
    return null;
  }

  if (!childName || typeof childName !== 'string' || !childName.trim()) {
    return null;
  }

  return {
    parent_ingredient_id: parentIngredientId,
    child_ingredient_id: childIngredientId,
    child_name: childName.trim(),
    child_unit: raw.child_unit ?? raw.unit,
    prompt_label: raw.prompt_label ?? raw.promptLabel ?? undefined,
    sort_order: raw.sort_order ?? raw.sortOrder,
  };
}

export async function getSubIngredients(ingredientId: number): Promise<IngredientSubIngredient[]> {
  try {
    const res = await apiClient.get<unknown>(`/ingredients/${ingredientId}/sub-ingredients`);
    const rawPayload = res.data as
      | IngredientSubIngredient[]
      | { sub_ingredients?: IngredientSubIngredient[]; children?: IngredientSubIngredient[]; data?: IngredientSubIngredient[] };

    const rawList = Array.isArray(rawPayload)
      ? rawPayload
      : rawPayload?.sub_ingredients ?? rawPayload?.children ?? rawPayload?.data ?? [];

    return rawList
      .map((entry) => normalizeSubIngredientCandidate(entry as RawIngredientSubIngredient))
      .filter((item): item is IngredientSubIngredient => item !== null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  } catch {
    return [];
  }
}
