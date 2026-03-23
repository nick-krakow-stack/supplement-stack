import { apiClient } from './client';
import type { Ingredient, IngredientSynonym, IngredientForm, Recommendation } from '../types';

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
