import type { CreatorProfilePageState, PublicCreatorProfile } from '../../../functions/lib/creator-profile-projection.mjs';

export function initialCreatorProfileState(pathname: string): CreatorProfilePageState | null {
  if (window.location.pathname !== pathname || !document.getElementById('site-page-prerender')) return null;
  try {
    const payload: unknown = JSON.parse(document.getElementById('creator-profile-bootstrap')?.textContent ?? 'null');
    if (!payload || typeof payload !== 'object' || !('slug' in payload) || `/creator/${payload.slug}` !== pathname || !('state' in payload)) return null;
    const state = payload.state;
    if (!state || typeof state !== 'object' || !('status' in state)) return null;
    if (state.status === 404 || state.status === 503) return { status: state.status };
    if (state.status !== 200 || !('profile' in state) || !state.profile || typeof state.profile !== 'object') return null;
    const profile = state.profile as Partial<PublicCreatorProfile>;
    if (profile.slug !== payload.slug || typeof profile.name !== 'string' || typeof profile.description !== 'string'
      || typeof profile.published_at !== 'string' || !['creator', 'brand'].includes(profile.type ?? '')
      || !(profile.profile_image_url === null || typeof profile.profile_image_url === 'string')) return null;
    return { status: 200, profile: profile as PublicCreatorProfile };
  } catch {
    return null;
  }
}
