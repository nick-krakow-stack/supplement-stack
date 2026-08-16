import type { CreatorSourceShareGuard } from '../api/creatorSharing';

export const CREATOR_AUTHOR_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type CreatorAuthorDraftView = 'stack' | 'product';

export type CreatorAuthorDraftScope = {
  user_id: number;
  party_id: number;
  stack_id: number;
  view: CreatorAuthorDraftView;
  stack_item_id: number | null;
  source_share_id: number | null;
};

export type CreatorAuthorDraft = CreatorAuthorDraftScope & {
  title: string;
  statements: Record<string, string>;
  source_share_guard: CreatorSourceShareGuard | null;
};

type StoredCreatorAuthorDraft = CreatorAuthorDraft & {
  version: 2;
  updated_at: number;
};

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function optionalPositiveInteger(value: unknown): value is number | null {
  return value === null || positiveInteger(value);
}

function validScope(scope: CreatorAuthorDraftScope): boolean {
  return positiveInteger(scope.user_id)
    && positiveInteger(scope.party_id)
    && positiveInteger(scope.stack_id)
    && (scope.view === 'stack' || scope.view === 'product')
    && optionalPositiveInteger(scope.stack_item_id)
    && optionalPositiveInteger(scope.source_share_id)
    && (scope.view === 'product' || scope.stack_item_id === null);
}

function draftKey(scope: CreatorAuthorDraftScope): string | null {
  if (!validScope(scope)) return null;
  return [
    'ss_creator_author_draft_v2',
    scope.user_id,
    scope.party_id,
    scope.stack_id,
    scope.view,
    scope.stack_item_id ?? 0,
    scope.source_share_id ?? 0,
  ].join(':');
}

function activeDraftKey(userId: number, partyId: number, view: CreatorAuthorDraftView): string | null {
  if (!positiveInteger(userId) || !positiveInteger(partyId)) return null;
  return `ss_creator_author_draft_active_v2:${userId}:${partyId}:${view}`;
}

function selectedPartyKey(userId: number): string | null {
  return positiveInteger(userId) ? `ss_creator_selected_party_v2:${userId}` : null;
}

function validStatements(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, statement]) => (
    /^\d+$/.test(key)
      && Number(key) > 0
      && typeof statement === 'string'
      && statement.length <= 500
  ));
}

function validSourceGuard(value: unknown): value is CreatorSourceShareGuard | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const guard = value as Partial<CreatorSourceShareGuard>;
  return positiveInteger(guard.share_id)
    && positiveInteger(guard.expected_version)
    && typeof guard.expected_snapshot_hash === 'string'
    && /^[a-f0-9]{64}$/i.test(guard.expected_snapshot_hash)
    && ['blocked', 'revoked', 'expired'].includes(String(guard.expected_status))
    && ['pending', 'approved', 'blocked'].includes(String(guard.expected_moderation_status))
    && (guard.expected_is_revoked === 0 || guard.expected_is_revoked === 1)
    && (guard.expected_expires_at === null || positiveInteger(guard.expected_expires_at));
}

function parseStoredDraft(raw: string, expectedScope: CreatorAuthorDraftScope, now: number): CreatorAuthorDraft | null {
  const parsed = JSON.parse(raw) as Partial<StoredCreatorAuthorDraft>;
  const valid = parsed.version === 2
    && parsed.user_id === expectedScope.user_id
    && parsed.party_id === expectedScope.party_id
    && parsed.stack_id === expectedScope.stack_id
    && parsed.view === expectedScope.view
    && parsed.stack_item_id === expectedScope.stack_item_id
    && parsed.source_share_id === expectedScope.source_share_id
    && typeof parsed.updated_at === 'number'
    && now >= parsed.updated_at
    && now - parsed.updated_at <= CREATOR_AUTHOR_DRAFT_MAX_AGE_MS
    && typeof parsed.title === 'string'
    && parsed.title.length <= 120
    && validStatements(parsed.statements)
    && validSourceGuard(parsed.source_share_guard)
    && (parsed.source_share_guard?.share_id ?? null) === parsed.source_share_id;
  if (!valid) return null;
  return {
    ...expectedScope,
    title: parsed.title as string,
    statements: { ...(parsed.statements as Record<string, string>) },
    source_share_guard: parsed.source_share_guard as CreatorSourceShareGuard | null,
  };
}

export function readCreatorAuthorDraft(
  scope: CreatorAuthorDraftScope,
  now = Date.now(),
  storage: Storage = window.sessionStorage,
): CreatorAuthorDraft | null {
  const key = draftKey(scope);
  if (!key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = parseStoredDraft(raw, scope, now);
    if (!parsed) storage.removeItem(key);
    return parsed;
  } catch {
    try { storage.removeItem(key); } catch { /* Browser storage can be blocked. */ }
    return null;
  }
}

export function readActiveCreatorAuthorDraft(
  userId: number,
  partyId: number,
  view: CreatorAuthorDraftView,
  now = Date.now(),
  storage: Storage = window.sessionStorage,
): CreatorAuthorDraft | null {
  const indexKey = activeDraftKey(userId, partyId, view);
  if (!indexKey) return null;
  try {
    const rawScope = storage.getItem(indexKey);
    if (!rawScope) return null;
    const scope = JSON.parse(rawScope) as CreatorAuthorDraftScope;
    if (scope.user_id !== userId || scope.party_id !== partyId || scope.view !== view || !validScope(scope)) {
      storage.removeItem(indexKey);
      return null;
    }
    const draft = readCreatorAuthorDraft(scope, now, storage);
    if (!draft) storage.removeItem(indexKey);
    return draft;
  } catch {
    try { storage.removeItem(indexKey); } catch { /* Browser storage can be blocked. */ }
    return null;
  }
}

export function writeCreatorAuthorDraft(
  draft: CreatorAuthorDraft,
  now = Date.now(),
  storage: Storage = window.sessionStorage,
): void {
  const scope: CreatorAuthorDraftScope = {
    user_id: draft.user_id,
    party_id: draft.party_id,
    stack_id: draft.stack_id,
    view: draft.view,
    stack_item_id: draft.stack_item_id,
    source_share_id: draft.source_share_id,
  };
  const key = draftKey(scope);
  const indexKey = activeDraftKey(draft.user_id, draft.party_id, draft.view);
  if (!key
    || !indexKey
    || draft.title.length > 120
    || !validStatements(draft.statements)
    || !validSourceGuard(draft.source_share_guard)
    || (draft.source_share_guard?.share_id ?? null) !== draft.source_share_id) return;
  try {
    const stored: StoredCreatorAuthorDraft = { version: 2, updated_at: now, ...draft };
    storage.setItem(key, JSON.stringify(stored));
    storage.setItem(indexKey, JSON.stringify(scope));
  } catch {
    // A blocked browser storage must never block authoring or publishing.
  }
}

export function clearCreatorAuthorDraft(
  scope: CreatorAuthorDraftScope,
  storage: Storage = window.sessionStorage,
): void {
  const key = draftKey(scope);
  const indexKey = activeDraftKey(scope.user_id, scope.party_id, scope.view);
  if (!key || !indexKey) return;
  try {
    storage.removeItem(key);
    const indexedScope = storage.getItem(indexKey);
    if (indexedScope && draftKey(JSON.parse(indexedScope) as CreatorAuthorDraftScope) === key) {
      storage.removeItem(indexKey);
    }
  } catch {
    // A blocked browser storage must never block authoring or publishing.
  }
}

export function readSelectedCreatorParty(userId: number, storage: Storage = window.sessionStorage): number | null {
  const key = selectedPartyKey(userId);
  if (!key) return null;
  try {
    const value = Number(storage.getItem(key));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeSelectedCreatorParty(userId: number, partyId: number, storage: Storage = window.sessionStorage): void {
  const key = selectedPartyKey(userId);
  if (!key || !positiveInteger(partyId)) return;
  try {
    storage.setItem(key, String(partyId));
  } catch {
    // Selection persistence is an enhancement; the page remains usable without it.
  }
}
