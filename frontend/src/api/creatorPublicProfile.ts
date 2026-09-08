import { apiClient } from './client';

export type CreatorPublicProfileState = {
  party: { id: number; name: string; slug: string; type: 'creator' | 'brand'; profile_image_url: string | null };
  identity_hash: string;
  profile: null | {
    status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
    version: number;
    description: string;
    identity_matches: boolean;
    review_fingerprint: string;
    moderation_reason: string | null;
    published_at: string | null;
  };
  consent_version: 'creator-public-profile-v1';
};

export type CreatorPublicProfileSubmission = {
  expected_version: number | null;
  expected_identity_hash: string;
  description: string;
  consent: true;
  consent_version: CreatorPublicProfileState['consent_version'];
};

export type CreatorPublicProfileReview = {
  expected_version: number;
  expected_review_fingerprint: string;
  decision: 'approve' | 'reject';
  reason?: string;
};

export async function getCreatorPublicProfileSettings(partyId: number): Promise<CreatorPublicProfileState> {
  return (await apiClient.get<CreatorPublicProfileState>(`/creator-sharing/parties/${partyId}/public-profile`)).data;
}

export async function submitCreatorPublicProfile(partyId: number, input: CreatorPublicProfileSubmission): Promise<CreatorPublicProfileState> {
  return (await apiClient.post<CreatorPublicProfileState>(`/creator-sharing/parties/${partyId}/public-profile/submit`, input)).data;
}

export async function withdrawCreatorPublicProfile(partyId: number, expectedVersion: number): Promise<CreatorPublicProfileState> {
  return (await apiClient.post<CreatorPublicProfileState>(`/creator-sharing/parties/${partyId}/public-profile/withdraw`, { expected_version: expectedVersion })).data;
}

export async function getAdminCreatorPublicProfiles(): Promise<CreatorPublicProfileState[]> {
  return (await apiClient.get<{ profiles: CreatorPublicProfileState[] }>('/admin/creator-sharing/public-profiles')).data.profiles;
}

export async function reviewCreatorPublicProfile(partyId: number, input: CreatorPublicProfileReview): Promise<CreatorPublicProfileState> {
  return (await apiClient.post<CreatorPublicProfileState>(`/admin/creator-sharing/parties/${partyId}/public-profile/review`, input)).data;
}
