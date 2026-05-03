import { apiClient } from './client';
import type { Product } from '../types';

export async function getProducts(): Promise<{ products: Product[] }> {
  const res = await apiClient.get<{ products: Product[] }>('/products');
  return res.data;
}

export async function getProduct(id: number): Promise<Product> {
  const res = await apiClient.get<Product>(`/products/${id}`);
  return res.data;
}

export async function createProduct(data: Partial<Product>): Promise<Product> {
  const res = await apiClient.post<Product>('/products', data);
  return res.data;
}

export async function updateProductStatus(
  id: number,
  moderationStatus: string,
  visibility: string
): Promise<Product> {
  const res = await apiClient.put<{ product: Product }>(`/products/${id}/status`, {
    moderation_status: moderationStatus,
    visibility,
  });
  return res.data.product;
}

export async function getAdminProducts(): Promise<{ products: Product[] }> {
  const res = await apiClient.get<{ products: Product[] }>('/admin/products');
  return res.data;
}
