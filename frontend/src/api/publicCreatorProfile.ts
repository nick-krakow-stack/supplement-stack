import { apiClient } from './client';
import type { PublicCreatorProfile } from '../../../functions/lib/creator-profile-projection.mjs';

export async function getPublicCreatorProfile(slug: string): Promise<PublicCreatorProfile> {
  const response = await apiClient.get<{ profile: PublicCreatorProfile }>(`/creator-sharing/public-profiles/${encodeURIComponent(slug)}`);
  if (response.data.profile?.slug !== slug) throw new Error('Unexpected public profile response');
  return response.data.profile;
}
