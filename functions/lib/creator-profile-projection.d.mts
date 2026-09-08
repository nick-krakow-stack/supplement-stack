import type { RouteHead } from './route-head-contract.mjs';
export type PublicCreatorProfile = {
  slug: string;
  name: string;
  type: 'creator' | 'brand';
  profile_image_url: string | null;
  description: string;
  published_at: string;
};
export type CreatorProfilePageState = { status: 200; profile: PublicCreatorProfile } | { status: 'loading' | 404 | 503 };
export const CREATOR_PROFILE_COPY: Readonly<{ boundary: string; exploreHeading: string; exploreDescription: string }>;
export function projectCreatorProfile(slug: string, state: CreatorProfilePageState): { title: string; description: string; profile: PublicCreatorProfile | null; head: RouteHead };
