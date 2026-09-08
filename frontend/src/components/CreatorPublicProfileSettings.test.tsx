// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreatorPublicProfileSettings from './CreatorPublicProfileSettings';
import { getCreatorPublicProfileSettings, submitCreatorPublicProfile, withdrawCreatorPublicProfile, type CreatorPublicProfileState } from '../api/creatorPublicProfile';
import type { CreatorParty } from '../api/creatorSharing';

vi.mock('../api/creatorPublicProfile', () => ({ getCreatorPublicProfileSettings: vi.fn(), submitCreatorPublicProfile: vi.fn(), withdrawCreatorPublicProfile: vi.fn() }));
const party: CreatorParty = { id: 7, name: 'Alex Alltag', slug: 'alex-alltag', type: 'creator', role: 'owner', status: 'active' };
const introduction = 'Ich bin Alex und teile hier meinen persönlichen Alltag.';
function state(status: NonNullable<CreatorPublicProfileState['profile']>['status'] | null = null, version = 2, creator = party): CreatorPublicProfileState {
  return { party: { id: creator.id, name: creator.name, slug: creator.slug, type: creator.type, profile_image_url: '/api/r2/creator/alex.png' }, identity_hash: `identity-${creator.id}`, consent_version: 'creator-public-profile-v1', profile: status ? { status, version, description: introduction, identity_matches: true, review_fingerprint: `review-${version}`, moderation_reason: null, published_at: status === 'approved' ? '2026-09-08T09:00:00Z' : null } : null };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function loaded() { return screen.findByLabelText('Dein Vorstellungstext'); }
function consent() { return screen.getByRole('checkbox', { name: /Ich möchte diese Angaben/ }); }
function submit() { return screen.getByRole('button', { name: 'Zur Prüfung und Veröffentlichung senden' }); }

describe('Creator public profile owner settings', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCreatorPublicProfileSettings).mockResolvedValue(state()); });
  afterEach(cleanup);

  it.each(['editor', 'viewer'] as const)('shows the %s permission boundary without owner API calls or actions', role => {
    render(<CreatorPublicProfileSettings party={{ ...party, role }} />);
    expect(screen.getByText(/Nur der Inhaber des aktiven Creator-Kontos/)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(getCreatorPublicProfileSettings).not.toHaveBeenCalled();
  });

  it('does not load settings or offer actions for a blocked owner', () => {
    render(<CreatorPublicProfileSettings party={{ ...party, status: 'blocked' }} />);
    expect(getCreatorPublicProfileSettings).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the sharing page compact and loads the independent profile only when opened', async () => {
    render(<CreatorPublicProfileSettings party={party} initiallyExpanded={false} />);
    expect(getCreatorPublicProfileSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Öffentliche Creator-Seite verwalten' }));
    await loaded();
    expect(getCreatorPublicProfileSettings).toHaveBeenCalledWith(7);
    fireEvent.change(screen.getByLabelText('Dein Vorstellungstext'), { target: { value: introduction } });
    fireEvent.click(screen.getByRole('button', { name: 'Öffentliche Creator-Seite verwalten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Öffentliche Creator-Seite verwalten' }));
    expect((screen.getByLabelText('Dein Vorstellungstext') as HTMLTextAreaElement).value).toBe(introduction);
    expect(getCreatorPublicProfileSettings).toHaveBeenCalledTimes(1);
  });

  it('requires deliberate consent, shows central read-only identity, and submits exact identity/version guards', async () => {
    vi.mocked(submitCreatorPublicProfile).mockResolvedValue(state('pending', 1));
    render(<CreatorPublicProfileSettings party={party} />);
    const text = await loaded();
    expect(screen.getByLabelText('Adresse deiner öffentlichen Seite').getAttribute('readonly')).not.toBeNull();
    expect((screen.getByLabelText('Adresse deiner öffentlichen Seite') as HTMLInputElement).value).toBe('https://supplementstack.de/creator/alex-alltag');
    expect(screen.getByRole('img', { name: 'Öffentliches Profilbild von Alex Alltag' }).getAttribute('src')).toBe('/api/r2/creator/alex.png');
    expect((consent() as HTMLInputElement).checked).toBe(false);
    fireEvent.change(text, { target: { value: `  ${introduction}  ` } });
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Mit dem Absenden wird ein bisheriges Profil ausgeblendet/)).toBeTruthy();
    fireEvent.click(consent()); fireEvent.click(submit());
    await screen.findByText(/Dein Vorstellungstext wurde zur Prüfung eingereicht/);
    expect(submitCreatorPublicProfile).toHaveBeenCalledWith(7, { expected_version: null, expected_identity_hash: 'identity-7', description: introduction, consent: true, consent_version: 'creator-public-profile-v1' });
    expect((consent() as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('Wird geprüft · nicht öffentlich')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Öffentliche Seite ansehen' })).toBeNull();
  });

  it('counts normalized Unicode codepoints and accepts only the 40–180 range', async () => {
    render(<CreatorPublicProfileSettings party={party} />);
    const input = await loaded();
    for (const [value, enabled] of [['a'.repeat(39), false], ['a'.repeat(39) + 'e\u0301', true], ['😀'.repeat(180), true], ['a'.repeat(181), false]] as const) {
      fireEvent.change(input, { target: { value } }); fireEvent.click(consent());
      expect((submit() as HTMLButtonElement).disabled).toBe(!enabled);
    }
    expect(submitCreatorPublicProfile).not.toHaveBeenCalled();
  });

  it('withdraws a pending review only after explicit confirmation with its exact version', async () => {
    vi.mocked(getCreatorPublicProfileSettings).mockResolvedValue(state('pending', 8));
    vi.mocked(withdrawCreatorPublicProfile).mockResolvedValue(state('withdrawn', 9));
    render(<CreatorPublicProfileSettings party={party} />); await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Prüfung abbrechen und Seite ausblenden' }));
    expect(withdrawCreatorPublicProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(withdrawCreatorPublicProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Prüfung abbrechen und Seite ausblenden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt ausblenden' }));
    await screen.findByText('Ausgeblendet · nicht öffentlich');
    expect(withdrawCreatorPublicProfile).toHaveBeenCalledWith(7, 8);
    expect(screen.getByText(/Eine ausstehende Prüfung ist damit beendet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Jetzt ausblenden' })).toBeNull();
  });

  it('shows an approved public link, but never when the identity no longer matches', async () => {
    vi.mocked(getCreatorPublicProfileSettings).mockResolvedValue(state('approved'));
    const mounted = render(<CreatorPublicProfileSettings party={party} />); await loaded();
    expect(screen.getByRole('link', { name: 'Öffentliche Seite ansehen' })).toBeTruthy();
    mounted.unmount();
    const changed = state('approved'); changed.profile!.identity_matches = false;
    vi.mocked(getCreatorPublicProfileSettings).mockResolvedValue(changed);
    render(<CreatorPublicProfileSettings party={party} />); await loaded();
    expect(screen.queryByRole('link', { name: 'Öffentliche Seite ansehen' })).toBeNull();
    expect(screen.getByText(/Creator-Angaben geändert · nicht öffentlich/)).toBeTruthy();
  });

  it('does not claim public visibility without the backend publication timestamp', async () => {
    const hidden = state('approved'); hidden.profile!.published_at = null;
    vi.mocked(getCreatorPublicProfileSettings).mockResolvedValue(hidden);
    render(<CreatorPublicProfileSettings party={party} />); await loaded();
    expect(screen.queryByRole('link', { name: 'Öffentliche Seite ansehen' })).toBeNull();
    expect(screen.queryByText('Öffentlich')).toBeNull();
  });

  it('discards an old Creator GET response and local consent after switching Creator', async () => {
    const slow = deferred<CreatorPublicProfileState>();
    const other = { ...party, id: 8, name: 'Bea Alltag', slug: 'bea-alltag' };
    vi.mocked(getCreatorPublicProfileSettings).mockReturnValueOnce(slow.promise).mockResolvedValueOnce(state(null, 1, other));
    const mounted = render(<CreatorPublicProfileSettings party={party} />);
    mounted.rerender(<CreatorPublicProfileSettings party={other} />); await loaded();
    await act(async () => slow.resolve(state('approved')));
    expect(screen.getByText('Bea Alltag')).toBeTruthy(); expect(screen.queryByText('Alex Alltag')).toBeNull();
    expect((consent() as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('link', { name: 'Öffentliche Seite ansehen' })).toBeNull();
  });

  it('does not apply an old Creator submission result to the newly selected Creator', async () => {
    const pending = deferred<CreatorPublicProfileState>();
    vi.mocked(submitCreatorPublicProfile).mockReturnValue(pending.promise);
    const other = { ...party, id: 8, name: 'Bea Alltag', slug: 'bea-alltag' };
    const mounted = render(<CreatorPublicProfileSettings party={party} />); const input = await loaded();
    fireEvent.change(input, { target: { value: introduction } }); fireEvent.click(consent()); fireEvent.click(submit());
    vi.mocked(getCreatorPublicProfileSettings).mockResolvedValue(state(null, 1, other));
    mounted.rerender(<CreatorPublicProfileSettings party={other} />); await loaded();
    await act(async () => pending.resolve(state('pending', 1)));
    expect(screen.getByText('Bea Alltag')).toBeTruthy();
    expect(screen.queryByText(/Dein Vorstellungstext wurde zur Prüfung eingereicht/)).toBeNull();
    expect((screen.getByLabelText('Dein Vorstellungstext') as HTMLTextAreaElement).value).toBe('');
  });

  it('blocks stale actions, preserves local text on explicit reload and requires fresh consent', async () => {
    vi.mocked(getCreatorPublicProfileSettings).mockResolvedValueOnce(state('approved', 2)).mockResolvedValueOnce(state('approved', 3));
    vi.mocked(submitCreatorPublicProfile).mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValueOnce(state('pending', 4));
    render(<CreatorPublicProfileSettings party={party} />); const input = await loaded();
    const local = 'Hier steht meine überarbeitete persönliche Vorstellung.';
    fireEvent.change(input, { target: { value: local } }); fireEvent.click(consent()); fireEvent.click(submit());
    await screen.findByText(/Die Angaben wurden inzwischen geändert/);
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    expect(submitCreatorPublicProfile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Aktuellen Stand neu laden' })); await loaded();
    expect((screen.getByLabelText('Dein Vorstellungstext') as HTMLTextAreaElement).value).toBe(local);
    expect((consent() as HTMLInputElement).checked).toBe(false);
    fireEvent.click(consent()); fireEvent.click(submit());
    await waitFor(() => expect(submitCreatorPublicProfile).toHaveBeenCalledTimes(2));
    expect(vi.mocked(submitCreatorPublicProfile).mock.calls[1][1].expected_version).toBe(3);
  });

  it('offers a real retry on GET failure and reconciles uncertain writes rather than retrying them', async () => {
    vi.mocked(getCreatorPublicProfileSettings).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(state());
    vi.mocked(submitCreatorPublicProfile).mockRejectedValue(new Error('response lost'));
    render(<CreatorPublicProfileSettings party={party} />);
    await screen.findByText(/Die Einstellungen konnten nicht geladen werden/);
    fireEvent.click(screen.getByRole('button', { name: 'Aktuellen Stand neu laden' })); const input = await loaded();
    fireEvent.change(input, { target: { value: introduction } }); fireEvent.click(consent()); fireEvent.click(submit());
    await screen.findByText(/Der Vorgang konnte nicht bestätigt werden/);
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    expect(submitCreatorPublicProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Dein Vorstellungstext wurde zur Prüfung eingereicht/)).toBeNull();
  });
});
