// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminCreatorPublicProfileReview from './AdminCreatorPublicProfileReview';
import { getAdminCreatorPublicProfiles, reviewCreatorPublicProfile, type CreatorPublicProfileState } from '../api/creatorPublicProfile';

vi.mock('../api/creatorPublicProfile', () => ({ getAdminCreatorPublicProfiles: vi.fn(), reviewCreatorPublicProfile: vi.fn() }));
function entry(version = 3): CreatorPublicProfileState {
  return { party: { id: 7, name: 'Alex Alltag', slug: 'alex-alltag', type: 'creator', profile_image_url: null }, identity_hash: 'identity-7', consent_version: 'creator-public-profile-v1', profile: { status: 'pending', version, description: 'Ich bin Alex und stelle hier meinen persönlichen Alltag vor.', identity_matches: true, review_fingerprint: `fingerprint-${version}`, moderation_reason: null, published_at: null } };
}
const approve = () => screen.getByRole('button', { name: 'Diese Fassung öffentlich freigeben' });
const reject = () => screen.getByRole('button', { name: 'Mit Rückmeldung ablehnen' });

describe('Admin public Creator profile review', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getAdminCreatorPublicProfiles).mockResolvedValue([entry()]); });
  afterEach(cleanup);

  it('shows the exact pending revision and approves with its version/fingerprint without editing identity or prose', async () => {
    const approved = entry(4); approved.profile!.status = 'approved';
    vi.mocked(reviewCreatorPublicProfile).mockResolvedValue(approved);
    render(<AdminCreatorPublicProfileReview />);
    await screen.findByText('Fassung 3 · wartet auf Prüfung · nicht öffentlich');
    expect(screen.getByText(entry().profile!.description)).toBeTruthy();
    expect(screen.queryByText('fingerprint-3')).toBeNull();
    expect(screen.getByText(/Mit der Freigabe wird genau diese Fassung öffentlich/)).toBeTruthy();
    fireEvent.click(approve());
    await screen.findByText('Die öffentliche Creator-Seite von Alex Alltag wurde freigegeben.');
    expect(reviewCreatorPublicProfile).toHaveBeenCalledWith(7, { expected_version: 3, expected_review_fingerprint: 'fingerprint-3', decision: 'approve' });
    expect(screen.queryByRole('button', { name: 'Diese Fassung öffentlich freigeben' })).toBeNull();
  });

  it('requires a specific 5–500 character rejection reason and submits only that decision', async () => {
    const rejected = entry(4); rejected.profile!.status = 'rejected';
    vi.mocked(reviewCreatorPublicProfile).mockResolvedValue(rejected);
    render(<AdminCreatorPublicProfileReview />);
    const text = await screen.findByLabelText('Rückmeldung bei Ablehnung');
    expect((reject() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(text, { target: { value: 'Kurz' } }); expect((reject() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(text, { target: { value: 'a'.repeat(501) } }); expect((reject() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(text, { target: { value: ' Bitte entferne die private Telefonnummer. ' } }); fireEvent.click(reject());
    await screen.findByText(/Der Inhaber sieht deine Rückmeldung/);
    expect(reviewCreatorPublicProfile).toHaveBeenCalledWith(7, { expected_version: 3, expected_review_fingerprint: 'fingerprint-3', decision: 'reject', reason: 'Bitte entferne die private Telefonnummer.' });
  });

  it('never offers approval when the current central identity differs from the submission', async () => {
    const changed = entry(); changed.profile!.identity_matches = false;
    vi.mocked(getAdminCreatorPublicProfiles).mockResolvedValue([changed]);
    render(<AdminCreatorPublicProfileReview />);
    await screen.findByText(/Die Creator-Angaben haben sich seit der Einreichung geändert/);
    expect((approve() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(approve()); expect(reviewCreatorPublicProfile).not.toHaveBeenCalled();
  });

  it('requires explicit reload after a conflict and uses only the new pending fingerprint', async () => {
    vi.mocked(getAdminCreatorPublicProfiles).mockResolvedValueOnce([entry(3)]).mockResolvedValueOnce([entry(5)]);
    vi.mocked(reviewCreatorPublicProfile).mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValueOnce({ ...entry(6), profile: null });
    render(<AdminCreatorPublicProfileReview />); await screen.findByText('Fassung 3 · wartet auf Prüfung · nicht öffentlich');
    fireEvent.change(screen.getByLabelText('Rückmeldung bei Ablehnung'), { target: { value: 'Mein vorhandener Hinweis bleibt erhalten.' } });
    fireEvent.click(approve()); await screen.findByText(/Diese Fassung oder die Creator-Angaben wurden inzwischen geändert/);
    expect((approve() as HTMLButtonElement).disabled).toBe(true);
    expect(reviewCreatorPublicProfile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Liste neu laden' })); await screen.findByText('Fassung 5 · wartet auf Prüfung · nicht öffentlich');
    expect((screen.getByLabelText('Rückmeldung bei Ablehnung') as HTMLTextAreaElement).value).toBe('Mein vorhandener Hinweis bleibt erhalten.');
    fireEvent.click(approve());
    await waitFor(() => expect(reviewCreatorPublicProfile).toHaveBeenCalledTimes(2));
    expect(vi.mocked(reviewCreatorPublicProfile).mock.calls[1][1].expected_review_fingerprint).toBe('fingerprint-5');
  });

  it('does not turn approved, rejected, withdrawn or absent profiles into pending decisions', async () => {
    const profiles = ['approved', 'rejected', 'withdrawn'].map(status => { const value = entry(); value.profile!.status = status as NonNullable<CreatorPublicProfileState['profile']>['status']; return value; });
    vi.mocked(getAdminCreatorPublicProfiles).mockResolvedValue([...profiles, { ...entry(), profile: null }]);
    render(<AdminCreatorPublicProfileReview />);
    await screen.findByText('Aktuell wartet keine öffentliche Creator-Seite auf Prüfung.');
    expect(screen.queryByRole('button', { name: 'Diese Fassung öffentlich freigeben' })).toBeNull();
  });

  it('provides loading failure recovery without a misleading empty queue or any write', async () => {
    vi.mocked(getAdminCreatorPublicProfiles).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    render(<AdminCreatorPublicProfileReview />);
    await screen.findByText(/Die öffentlichen Creator-Seiten konnten nicht geladen werden/);
    expect(screen.queryByText('Aktuell wartet keine öffentliche Creator-Seite auf Prüfung.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Liste neu laden' }));
    await screen.findByText('Aktuell wartet keine öffentliche Creator-Seite auf Prüfung.');
    expect(reviewCreatorPublicProfile).not.toHaveBeenCalled();
  });
});
