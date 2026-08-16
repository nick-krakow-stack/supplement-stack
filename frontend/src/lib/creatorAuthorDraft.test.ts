// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CREATOR_AUTHOR_DRAFT_MAX_AGE_MS,
  clearCreatorAuthorDraft,
  readActiveCreatorAuthorDraft,
  readCreatorAuthorDraft,
  readSelectedCreatorParty,
  writeCreatorAuthorDraft,
  writeSelectedCreatorParty,
  type CreatorAuthorDraft,
} from './creatorAuthorDraft';

function makeDraft(overrides: Partial<CreatorAuthorDraft> = {}): CreatorAuthorDraft {
  return {
    user_id: 41,
    party_id: 7,
    view: 'product',
    stack_id: 10,
    stack_item_id: 90,
    source_share_id: 3,
    title: 'Mein Magnesium',
    statements: { '90': 'Passt in meinen Alltag.' },
    source_share_guard: {
      share_id: 3,
      expected_version: 4,
      expected_snapshot_hash: 'a'.repeat(64),
      expected_status: 'blocked',
      expected_moderation_status: 'blocked',
      expected_is_revoked: 0,
      expected_expires_at: null,
    },
    ...overrides,
  };
}

describe('creator author draft', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('keeps two accounts with the same party strictly separate', () => {
    const first = makeDraft({ user_id: 41, title: 'Konto A' });
    const second = makeDraft({ user_id: 42, title: 'Konto B' });
    writeCreatorAuthorDraft(first, 1_000);
    writeCreatorAuthorDraft(second, 1_100);
    expect(readCreatorAuthorDraft(first, 2_000)?.title).toBe('Konto A');
    expect(readCreatorAuthorDraft(second, 2_000)?.title).toBe('Konto B');
  });

  it('keeps stacks and stack/product tasks separate instead of overwriting them', () => {
    const stackTen = makeDraft({ source_share_id: null, source_share_guard: null, title: 'Stack 10' });
    const stackEleven = makeDraft({ stack_id: 11, stack_item_id: 91, source_share_id: null, source_share_guard: null, title: 'Stack 11' });
    const wholeStack = makeDraft({ view: 'stack', stack_item_id: null, source_share_id: null, source_share_guard: null, title: 'Ganzer Stack' });
    writeCreatorAuthorDraft(stackTen, 1_000);
    writeCreatorAuthorDraft(stackEleven, 1_100);
    writeCreatorAuthorDraft(wholeStack, 1_200);
    expect(readCreatorAuthorDraft(stackTen, 2_000)?.title).toBe('Stack 10');
    expect(readCreatorAuthorDraft(stackEleven, 2_000)?.title).toBe('Stack 11');
    expect(readCreatorAuthorDraft(wholeStack, 2_000)?.title).toBe('Ganzer Stack');
    expect(readActiveCreatorAuthorDraft(41, 7, 'product', 2_000)?.title).toBe('Stack 11');
    expect(readActiveCreatorAuthorDraft(41, 7, 'stack', 2_000)?.title).toBe('Ganzer Stack');
  });

  it('keeps drafts from two source shares separate and clears only the published one', () => {
    const first = makeDraft({ source_share_id: 3, title: 'Quelle 3' });
    const second = makeDraft({
      source_share_id: 4,
      title: 'Quelle 4',
      source_share_guard: { ...makeDraft().source_share_guard!, share_id: 4 },
    });
    writeCreatorAuthorDraft(first, 1_000);
    writeCreatorAuthorDraft(second, 1_100);
    clearCreatorAuthorDraft(second);
    expect(readCreatorAuthorDraft(first, 2_000)?.title).toBe('Quelle 3');
    expect(readCreatorAuthorDraft(second, 2_000)).toBeNull();
  });

  it('expires and rejects malformed state', () => {
    const draft = makeDraft();
    writeCreatorAuthorDraft(draft, 1_000);
    expect(readCreatorAuthorDraft(draft, 1_000 + CREATOR_AUTHOR_DRAFT_MAX_AGE_MS + 1)).toBeNull();
    window.sessionStorage.setItem(
      'ss_creator_author_draft_v2:41:7:10:product:90:3',
      JSON.stringify({ ...draft, version: 2, updated_at: 3_000, title: 'x'.repeat(121) }),
    );
    expect(readCreatorAuthorDraft(draft, 3_001)).toBeNull();
  });

  it('persists selected parties separately for each account', () => {
    writeSelectedCreatorParty(41, 12);
    writeSelectedCreatorParty(42, 13);
    expect(readSelectedCreatorParty(41)).toBe(12);
    expect(readSelectedCreatorParty(42)).toBe(13);
    writeSelectedCreatorParty(41, 0);
    expect(readSelectedCreatorParty(41)).toBe(12);
  });
});
