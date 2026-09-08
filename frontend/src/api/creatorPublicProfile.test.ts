import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { getAdminCreatorPublicProfiles, getCreatorPublicProfileSettings, reviewCreatorPublicProfile, submitCreatorPublicProfile, withdrawCreatorPublicProfile } from './creatorPublicProfile';

vi.mock('./client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
describe('Creator public profile API paths', () => {
  beforeEach(() => vi.resetAllMocks());
  it('uses the exact separate owner paths and preserves all supplied guards and consent', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { party: { id: 7 } } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { party: { id: 7 } } });
    const input = { expected_version: null, expected_identity_hash: 'current-identity', description: 'An explicitly submitted introduction, without private data.', consent: true as const, consent_version: 'creator-public-profile-v1' as const };
    await getCreatorPublicProfileSettings(7); await submitCreatorPublicProfile(7, input); await withdrawCreatorPublicProfile(7, 4);
    expect(apiClient.get).toHaveBeenCalledWith('/creator-sharing/parties/7/public-profile');
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/creator-sharing/parties/7/public-profile/submit', input);
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/creator-sharing/parties/7/public-profile/withdraw', { expected_version: 4 });
  });
  it('uses the admin review queue and submits the exact pending revision fingerprint', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { profiles: [] } }); vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const input = { expected_version: 3, expected_review_fingerprint: 'reviewed-exact-revision', decision: 'reject' as const, reason: 'Remove the private contact details.' };
    expect(await getAdminCreatorPublicProfiles()).toEqual([]); await reviewCreatorPublicProfile(7, input);
    expect(apiClient.get).toHaveBeenCalledWith('/admin/creator-sharing/public-profiles');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/creator-sharing/parties/7/public-profile/review', input);
  });
});
