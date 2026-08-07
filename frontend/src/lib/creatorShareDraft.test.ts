// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CREATOR_SHARE_DRAFT_MAX_AGE_MS,
  clearCreatorShareDraft,
  readCreatorShareDraft,
  writeCreatorShareDraft,
} from './creatorShareDraft';

const token = 'abcdefghijklmnopqrstuvwxyz123456';
const otherToken = 'zyxwvutsrqponmlkjihgfedcba654321';

function draftKey(value: string): string {
  return `ss_creator_share_draft_v1:${value}`;
}

function storageFor(values = new Map<string, string>()): Storage {
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('token-bound creator share draft', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('restores form values in a new tab of the same browser, but not on another device', () => {
    const browserValues = new Map<string, string>();
    const firstTab = storageFor(browserValues);
    const mailLinkTab = storageFor(browserValues);
    const otherDevice = storageFor();

    writeCreatorShareDraft(token, { stack_name: 'Mein Ziel', target_stack_id: 42 }, 1_000, firstTab);

    expect(mailLinkTab).not.toBe(firstTab);
    expect(readCreatorShareDraft(token, 2_000, mailLinkTab)).toEqual({ stack_name: 'Mein Ziel', target_stack_id: 42 });
    expect(readCreatorShareDraft(otherToken, 2_000, mailLinkTab)).toBeNull();
    expect(mailLinkTab.getItem(draftKey(token))).not.toBeNull();
    expect(readCreatorShareDraft(token, 2_000, otherDevice)).toBeNull();
  });

  it('expires quickly, stores only the allowed form values and can be cleared after success', () => {
    writeCreatorShareDraft(token, { stack_name: 'Kurz gespeichert', target_stack_id: null }, 1_000);
    const raw = window.localStorage.getItem(draftKey(token)) || '';
    expect(Object.keys(JSON.parse(raw))).toEqual([
      'version',
      'token',
      'updated_at',
      'stack_name',
      'target_stack_id',
    ]);
    expect(window.sessionStorage.length).toBe(0);
    expect(raw).not.toContain('conflict');
    expect(raw).not.toContain('replace');
    expect(readCreatorShareDraft(token, 1_000 + CREATOR_SHARE_DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(draftKey(token))).toBeNull();

    writeCreatorShareDraft(token, { stack_name: 'Neu', target_stack_id: 7 }, 3_000);
    clearCreatorShareDraft(token);
    expect(readCreatorShareDraft(token, 3_001)).toBeNull();
    expect(window.localStorage.getItem(draftKey(token))).toBeNull();
  });

  it('removes malformed, wrong-version and token-mismatched payloads', () => {
    window.localStorage.setItem(draftKey(token), '{broken-json');
    expect(readCreatorShareDraft(token, 1_000)).toBeNull();
    expect(window.localStorage.getItem(draftKey(token))).toBeNull();

    window.localStorage.setItem(draftKey(token), JSON.stringify({
      version: 2,
      token,
      updated_at: 1_000,
      stack_name: 'Falsche Version',
      target_stack_id: null,
    }));
    expect(readCreatorShareDraft(token, 1_001)).toBeNull();
    expect(window.localStorage.getItem(draftKey(token))).toBeNull();

    window.localStorage.setItem(draftKey(token), JSON.stringify({
      version: 1,
      token: otherToken,
      updated_at: 1_000,
      stack_name: 'Falscher Token',
      target_stack_id: 7,
    }));
    expect(readCreatorShareDraft(token, 1_001)).toBeNull();
    expect(window.localStorage.getItem(draftKey(token))).toBeNull();
  });
});
