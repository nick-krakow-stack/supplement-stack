export const CREATOR_SHARE_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

export type CreatorShareDraft = {
  stack_name: string;
  target_stack_id: number | null;
};

type StoredCreatorShareDraft = CreatorShareDraft & {
  version: 1;
  token: string;
  updated_at: number;
};

function storageKey(token: string): string | null {
  return /^[A-Za-z0-9_-]{24,80}$/.test(token) ? `ss_creator_share_draft_v1:${token}` : null;
}

export function readCreatorShareDraft(
  token: string,
  now = Date.now(),
  storage: Storage = window.localStorage,
): CreatorShareDraft | null {
  const key = storageKey(token);
  if (!key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCreatorShareDraft>;
    const valid = parsed.version === 1
      && parsed.token === token
      && typeof parsed.updated_at === 'number'
      && now >= parsed.updated_at
      && now - parsed.updated_at <= CREATOR_SHARE_DRAFT_MAX_AGE_MS
      && typeof parsed.stack_name === 'string'
      && parsed.stack_name.length <= 120
      && (parsed.target_stack_id === null || (Number.isSafeInteger(parsed.target_stack_id) && Number(parsed.target_stack_id) > 0));
    if (!valid) {
      storage.removeItem(key);
      return null;
    }
    return { stack_name: parsed.stack_name as string, target_stack_id: parsed.target_stack_id as number | null };
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeCreatorShareDraft(
  token: string,
  draft: CreatorShareDraft,
  now = Date.now(),
  storage: Storage = window.localStorage,
): void {
  const key = storageKey(token);
  if (!key || draft.stack_name.length > 120) return;
  if (draft.target_stack_id !== null && (!Number.isSafeInteger(draft.target_stack_id) || draft.target_stack_id <= 0)) return;
  try {
    const stored: StoredCreatorShareDraft = { version: 1, token, updated_at: now, ...draft };
    storage.setItem(key, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable without blocking the share flow.
  }
}

export function clearCreatorShareDraft(token: string, storage: Storage = window.localStorage): void {
  const key = storageKey(token);
  if (!key) return;
  try {
    storage.removeItem(key);
  } catch {
    // Storage can be unavailable without blocking the share flow.
  }
}
