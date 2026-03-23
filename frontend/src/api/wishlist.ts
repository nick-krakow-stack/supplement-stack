import { apiClient } from './client';
import type { WishlistItem } from '../types';

export async function getWishlist(): Promise<{ items: WishlistItem[] }> {
  const res = await apiClient.get<{ items: WishlistItem[] }>('/wishlist');
  return res.data;
}

export async function addToWishlist(productId: number): Promise<WishlistItem> {
  const res = await apiClient.post<WishlistItem>('/wishlist', { product_id: productId });
  return res.data;
}

export async function removeFromWishlist(productId: number): Promise<void> {
  await apiClient.delete(`/wishlist/${productId}`);
}
