import { apiClient } from './client';
import type { Ingredient, IngredientSynonym, IngredientForm, Recommendation } from '../types';
import type { IngredientPartOption } from '../types/local';

export async function searchIngredients(query: string): Promise<{ ingredients: Ingredient[] }> {
  const res = await apiClient.get<{ ingredients: Ingredient[] }>('/ingredients/search', {
    params: { q: query },
  });
  return res.data;
}

export async function getIngredient(id: number): Promise<Ingredient> {
  const res = await apiClient.get<Ingredient | { ingredient?: Ingredient; forms?: IngredientForm[]; synonyms?: IngredientSynonym[] }>(`/ingredients/${id}`);
  const payload = res.data;
  if ('ingredient' in payload && payload.ingredient) {
    return {
      ...payload.ingredient,
      forms: payload.forms ?? payload.ingredient.forms,
      synonyms: payload.synonyms ?? payload.ingredient.synonyms,
    };
  }
  return payload as Ingredient;
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

export async function updateSynonym(
  ingredientId: number,
  synId: number,
  data: Partial<IngredientSynonym>,
): Promise<IngredientSynonym> {
  const res = await apiClient.patch<{ synonym?: IngredientSynonym } | IngredientSynonym>(
    `/ingredients/${ingredientId}/synonyms/${synId}`,
    data,
  );
  const payload = res.data as Record<string, unknown>;
  return payload.synonym && typeof payload.synonym === 'object'
    ? payload.synonym as IngredientSynonym
    : res.data as IngredientSynonym;
}

export async function addForm(
  ingredientId: number,
  data: Partial<IngredientForm>
): Promise<IngredientForm> {
  const res = await apiClient.post<IngredientForm>(`/ingredients/${ingredientId}/forms`, data);
  return res.data;
}

export async function updateForm(
  ingredientId: number,
  formId: number,
  data: Partial<IngredientForm>,
): Promise<IngredientForm> {
  const res = await apiClient.patch<{ form?: IngredientForm } | IngredientForm>(
    `/ingredients/${ingredientId}/forms/${formId}`,
    data,
  );
  return 'form' in res.data && res.data.form ? res.data.form : res.data as IngredientForm;
}

export async function deleteForm(ingredientId: number, formId: number): Promise<void> {
  await apiClient.delete(`/ingredients/${ingredientId}/forms/${formId}`);
}

export async function getRecommendations(ingredientId: number): Promise<Recommendation[]> {
  const res = await apiClient.get<Recommendation[]>(`/ingredients/${ingredientId}/recommendations`);
  return res.data;
}

type RawIngredientPart = Partial<IngredientPartOption & {
  parent_ingredient_id?: number;
  child_ingredient_id?: number;
  child_name?: string;
  childIngredientId?: number;
  childName?: string;
  sortOrder?: number;
}>;

function normalizeIngredientPart(raw: RawIngredientPart, ingredientId: number): IngredientPartOption | null {
  const partId = raw.part_id ?? raw.child_ingredient_id ?? raw.childIngredientId;
  const partName = raw.part_name ?? raw.child_name ?? raw.childName;

  if (!Number.isFinite(partId as number) || partId === undefined || partId === null) {
    return null;
  }

  if (!partName || typeof partName !== 'string' || !partName.trim()) {
    return null;
  }

  return {
    ingredient_id: raw.ingredient_id ?? raw.parent_ingredient_id ?? ingredientId,
    part_id: partId,
    part_name: partName.trim(),
    part_type: raw.part_type ?? null,
    part_status: raw.part_status ?? 'active',
    sort_order: raw.sort_order ?? raw.sortOrder,
  };
}

export async function getIngredientParts(ingredientId: number): Promise<IngredientPartOption[]> {
  try {
    const res = await apiClient.get<unknown>(`/ingredients/${ingredientId}/sub-ingredients`);
    const rawPayload = res.data as
      | IngredientPartOption[]
      | { parts?: IngredientPartOption[]; sub_ingredients?: IngredientPartOption[]; data?: IngredientPartOption[] };

    const rawList = Array.isArray(rawPayload)
      ? rawPayload
      : rawPayload?.parts ?? rawPayload?.sub_ingredients ?? rawPayload?.data ?? [];

    return rawList
      .map((entry) => normalizeIngredientPart(entry as RawIngredientPart, ingredientId))
      .filter((item): item is IngredientPartOption => item !== null && item.part_status !== 'inactive' && item.part_status !== 'deprecated')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  } catch {
    return [];
  }
}

/** @deprecated Use getIngredientParts; kept temporarily for import compatibility. */
export const getSubIngredients = getIngredientParts;
