import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createProductionKnowledgeHonoHarness,
  type ProductionKnowledgeHonoHarness,
} from './productionKnowledgeHonoTestHarness';
import { fetchCreatorSharingHono } from './creatorSharingHonoHandlers.mjs';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

type TestStatement = {
  bind: (...values: unknown[]) => TestStatement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ meta: { changes: number } }>;
};
type TestDatabase = { prepare: (sql: string) => TestStatement };

// Frozen byte-for-byte from the persistent UPDATE in
// functions/api/modules/creator-sharing-admin.ts at the pre-0106 HEAD
// (6bf4497c40fbf1afa33b53dea798690a4ebe00e6). This is the real write contract
// that remains live while D1 migrations finish before the Pages deployment.
const LEGACY_HEAD_MODERATION_UPDATE_SQL = `
    UPDATE share_links
    SET moderation_status = ?, is_revoked = COALESCE(?, is_revoked),
      moderated_by_user_id = ?, moderated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND moderation_status = ? AND snapshot_hash = ?
  `;

const LEGACY_HEAD_CREATOR_REVOKE_SQL = `
    UPDATE share_links
    SET is_revoked = 1
    WHERE id = ?
      AND creator_party_id = ?
      AND snapshot_hash = ?
      AND moderation_status = ?
      AND is_revoked = 0
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
  `;

const JWT_SECRET = 'creator-workflow-migration-test-secret-that-is-long-enough';

async function authToken(userId: number, email: string): Promise<string> {
  const encode = (value: string) => Buffer.from(value).toString('base64url');
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify({ userId, role: 'user', email, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${Buffer.from(signature).toString('base64url')}`;
}

function recordLegacyHeadAdminAudit(
  harness: ProductionKnowledgeHonoHarness,
  input: {
    shareId: number;
    adminUserId: number;
    expectedStatus: 'pending' | 'approved';
    moderationStatus: 'approved' | 'blocked';
    revoked: 0 | 1;
  },
): void {
  harness.run(`
    INSERT INTO admin_audit_log (
      user_id, action, entity_type, entity_id, changes, created_at
    )
    SELECT ?, 'moderate_creator_share', 'share_link', id, ?,
      CAST(strftime('%s', moderated_at) AS INTEGER)
    FROM share_links WHERE id = ?
  `, input.adminUserId, JSON.stringify({
    expected_status: input.expectedStatus,
    moderation_status: input.moderationStatus,
    is_revoked: input.revoked,
  }), input.shareId);
}

async function runLegacyHeadModeration(
  db: TestDatabase,
  input: {
    shareId: number;
    moderationStatus: 'approved' | 'blocked';
    revoked: 0 | 1;
    adminUserId: number;
    expectedStatus: 'pending' | 'approved';
    expectedHash: string;
  },
): Promise<number> {
  const before = await db.prepare('SELECT total_changes() AS count').first<{ count: number }>();
  await db.prepare(LEGACY_HEAD_MODERATION_UPDATE_SQL).bind(
    input.moderationStatus,
    input.revoked,
    input.adminUserId,
    input.shareId,
    input.expectedStatus,
    input.expectedHash,
  ).run();
  const after = await db.prepare('SELECT total_changes() AS count').first<{ count: number }>();
  return Number(after?.count ?? 0) - Number(before?.count ?? 0);
}

function sqlFiles(directoryName: string): Array<{ name: string; sql: string }> {
  const directory = resolve(process.cwd(), '..', directoryName);
  return readdirSync(directory)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort()
    .map((name) => ({ name, sql: readFileSync(resolve(directory, name), 'utf8') }));
}

describe('creator portfolio workflow migration', () => {
  let harness: ProductionKnowledgeHonoHarness | null = null;

  afterEach(() => {
    harness?.close();
    harness = null;
  });

  it('keeps the old runtime valid during expand, then reconciles and activates exact moderation writes', async () => {
    harness = createProductionKnowledgeHonoHarness();
    const migrations = sqlFiles('d1-migrations');
    for (const migration of migrations.filter(({ name }) => name < '0106_')) harness.exec(migration.sql);

    harness.run(`INSERT INTO users (id, email, password_hash) VALUES (8900, 'legacy-creator@test.invalid', 'x')`);
    harness.run(`INSERT INTO users (id, email, password_hash, role) VALUES (8999, 'legacy-admin@test.invalid', 'x', 'admin')`);
    harness.run(`INSERT INTO parties (id, type, name, slug, status) VALUES (8900, 'creator', 'Legacy Creator', 'legacy-creator', 'active')`);
    harness.run(`
      INSERT INTO share_links (
        id, token, entity_type, entity_id, snapshot_json, creator_user_id,
        creator_party_id, snapshot_schema_version, snapshot_hash,
        moderation_status, is_revoked
      ) VALUES (
        8900, 'legacy_blocked_abcdefghijkl', 'stack', 1, '{}', 8900,
        8900, 3, ?, 'blocked', 0
      )
    `, 'b'.repeat(64));

    const workflowMigration = migrations.find(({ name }) => name.startsWith('0106_'));
    expect(workflowMigration).toBeDefined();
    harness.exec(workflowMigration!.sql);
    const db = harness.db as TestDatabase;

    expect(await db.prepare(`
      SELECT moderation_status, moderation_reason, moderation_target, moderation_item_index
      FROM share_links WHERE id = 8900
    `).first()).toEqual({
      moderation_status: 'blocked',
      moderation_reason: null,
      moderation_target: null,
      moderation_item_index: null,
    });
    expect(() => harness!.run(`UPDATE share_links SET archived_at = 1700000000 WHERE id = 8900`)).not.toThrow();

    const columns = await db.prepare(`PRAGMA table_info('creator_share_notification_events')`).all<{
      name: string;
    }>();
    const columnNames = columns.results.map((column) => column.name);
    expect(columnNames).toEqual(expect.arrayContaining([
      'share_link_id', 'share_version', 'event_type', 'origin', 'status', 'attempts', 'claim_run_key', 'last_error',
    ]));
    expect(columnNames.some((name) => /email|recipient|user_id/i.test(name))).toBe(false);

    const foreignKeys = await db.prepare(`PRAGMA foreign_key_list('creator_share_notification_events')`).all<{
      table: string;
      from: string;
      on_delete: string;
    }>();
    expect(foreignKeys.results).toContainEqual(expect.objectContaining({
      table: 'share_links',
      from: 'share_link_id',
      on_delete: 'CASCADE',
    }));

    harness.run(`
      INSERT INTO share_links (
        id, token, entity_type, entity_id, snapshot_json, creator_user_id,
        creator_party_id, snapshot_schema_version, snapshot_hash,
        moderation_status, is_revoked
      ) VALUES
        (8910, 'legacy_pending_block_abcdef', 'stack', 1, '{}', 8900, 8900, 3, ?, 'pending', 0),
        (8911, 'legacy_pending_approve_abc', 'stack', 1, '{}', 8900, 8900, 3, ?, 'pending', 0)
    `, 'c'.repeat(64), 'd'.repeat(64));
    // Expand/deploy compatibility: execute the previous runtime's exact SQL
    // and its old UI semantics (block=revoked 1, approve=revoked 0).
    expect(await runLegacyHeadModeration(db, {
      shareId: 8910,
      moderationStatus: 'blocked',
      revoked: 1,
      adminUserId: 8999,
      expectedStatus: 'pending',
      expectedHash: 'c'.repeat(64),
    })).toBe(1);
    expect(await runLegacyHeadModeration(db, {
      shareId: 8911,
      moderationStatus: 'approved',
      revoked: 0,
      adminUserId: 8999,
      expectedStatus: 'pending',
      expectedHash: 'd'.repeat(64),
    })).toBe(1);
    recordLegacyHeadAdminAudit(harness, {
      shareId: 8910,
      adminUserId: 8999,
      expectedStatus: 'pending',
      moderationStatus: 'blocked',
      revoked: 1,
    });
    recordLegacyHeadAdminAudit(harness, {
      shareId: 8911,
      adminUserId: 8999,
      expectedStatus: 'pending',
      moderationStatus: 'approved',
      revoked: 0,
    });
    const expandedTransitions = await db.prepare(`
      SELECT id, moderation_status, version, moderation_reason, is_revoked
      FROM share_links WHERE id IN (8910, 8911) ORDER BY id
    `).all<Record<string, unknown>>();
    expect(expandedTransitions.results).toEqual([
      { id: 8910, moderation_status: 'blocked', version: 1, moderation_reason: null, is_revoked: 1 },
      { id: 8911, moderation_status: 'approved', version: 1, moderation_reason: null, is_revoked: 0 },
    ]);
    expect(await db.prepare(`
      SELECT COUNT(*) AS count
      FROM creator_share_notification_events
      WHERE share_link_id IN (8910, 8911)
    `).first()).toEqual({ count: 0 });

    const activation = sqlFiles('d1-postdeploy-migrations').find(({ name }) => name.startsWith('0001_'));
    expect(activation).toBeDefined();
    harness.exec(activation!.sql);

    const legacyTransitions = await db.prepare(`
      SELECT id, moderation_status, version, moderation_reason, is_revoked
      FROM share_links WHERE id IN (8910, 8911) ORDER BY id
    `).all<Record<string, unknown>>();
    expect(legacyTransitions.results).toEqual([
      { id: 8910, moderation_status: 'blocked', version: 2, moderation_reason: null, is_revoked: 0 },
      { id: 8911, moderation_status: 'approved', version: 2, moderation_reason: null, is_revoked: 0 },
    ]);
    expect((await db.prepare(`
      SELECT share_link_id, share_version, event_type, origin, status, attempts
      FROM creator_share_notification_events
      WHERE share_link_id IN (8910, 8911)
      ORDER BY share_link_id
    `).all<Record<string, unknown>>()).results).toEqual([
      {
        share_link_id: 8910,
        share_version: 2,
        event_type: 'moderation_blocked',
        origin: 'legacy_activation',
        status: 'pending',
        attempts: 0,
      },
      {
        share_link_id: 8911,
        share_version: 2,
        event_type: 'moderation_approved',
        origin: 'legacy_activation',
        status: 'pending',
        attempts: 0,
      },
    ]);
    expect(await db.prepare(`
      SELECT phase, baseline_share_count, activated_at IS NOT NULL AS has_activated_at
      FROM creator_share_workflow_rollouts
      WHERE rollout_key = 'creator_portfolio_v1'
    `).first()).toEqual({
      phase: 'active',
      baseline_share_count: 1,
      has_activated_at: 1,
    });
    expect(await db.prepare(`
      SELECT version, moderation_status, is_revoked
      FROM share_links WHERE id = 8900
    `).first()).toEqual({ version: 1, moderation_status: 'blocked', is_revoked: 0 });

    const activationStateBeforeRetry = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM creator_share_workflow_legacy_transitions) AS transitions,
        (SELECT COUNT(*) FROM creator_share_notification_events) AS events,
        (SELECT activated_at FROM creator_share_workflow_rollouts
          WHERE rollout_key = 'creator_portfolio_v1') AS activated_at
    `).first<Record<string, unknown>>();
    harness.exec(activation!.sql);
    expect(await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM creator_share_workflow_legacy_transitions) AS transitions,
        (SELECT COUNT(*) FROM creator_share_notification_events) AS events,
        (SELECT activated_at FROM creator_share_workflow_rollouts
          WHERE rollout_key = 'creator_portfolio_v1') AS activated_at
    `).first()).toEqual(activationStateBeforeRetry);

    expect(() => harness!.run(`UPDATE share_links SET moderation_reason = 'Unvollständig' WHERE id = 8900`)).toThrow(/moderation feedback/i);

    harness.run(`INSERT INTO users (id, email, password_hash) VALUES (8901, 'creator-migration@test.invalid', 'x')`);
    harness.run(`INSERT INTO parties (id, type, name, slug, status) VALUES (8901, 'creator', 'Migration Creator', 'migration-creator', 'active')`);
    harness.run(`
      INSERT INTO share_links (
        id, token, entity_type, entity_id, snapshot_json, creator_user_id,
        creator_party_id, snapshot_schema_version, snapshot_hash,
        moderation_status, is_revoked
      ) VALUES (
        8901, 'migration_token_abcdefghijkl', 'stack', 1, '{}', 8901,
        8901, 3, ?, 'pending', 0
      )
    `, 'a'.repeat(64));

    expect(() => harness!.run(`
      UPDATE share_links
      SET moderation_status = 'blocked', version = version + 1
      WHERE id = 8901
    `)).toThrow(/moderation feedback/i);

    expect(await (async () => {
      const before = await db.prepare('SELECT total_changes() AS count').first<{ count: number }>();
      harness!.run(`
      UPDATE share_links
      SET moderation_status = 'blocked', moderation_reason = 'Bitte Namen vereinfachen.',
        moderation_target = 'title', version = version + 1
      WHERE id = 8901
      `);
      const after = await db.prepare('SELECT total_changes() AS count').first<{ count: number }>();
      return Number(after?.count ?? 0) - Number(before?.count ?? 0);
    })()).toBe(1);
    expect(await db.prepare(`
      SELECT COUNT(*) AS count FROM creator_share_notification_events WHERE share_link_id = 8901
    `).first()).toEqual({ count: 0 });

    expect(() => harness!.run(`
      UPDATE share_links
      SET moderation_item_index = 0
      WHERE id = 8901
    `)).toThrow(/moderation feedback/i);
    expect(() => harness!.run(`
      UPDATE share_links
      SET supersedes_share_link_id = id
      WHERE id = 8901
    `)).toThrow(/constraint/i);

    harness.run(`
      INSERT INTO share_links (
        id, token, entity_type, entity_id, snapshot_json, creator_user_id,
        creator_party_id, snapshot_schema_version, snapshot_hash,
        moderation_status, is_revoked
      ) VALUES (
        8912, 'active_old_runtime_rejected', 'stack', 1, '{}', 8900,
        8900, 3, ?, 'pending', 0
      )
    `, 'e'.repeat(64));
    await expect(runLegacyHeadModeration(db, {
      shareId: 8912,
      moderationStatus: 'blocked',
      revoked: 1,
      adminUserId: 8900,
      expectedStatus: 'pending',
      expectedHash: 'e'.repeat(64),
    })).rejects.toThrow(/exact version increment/i);
  });

  it('orders expand before Pages and activation strictly after a successful Pages deploy', () => {
    const workflow = readFileSync(resolve(process.cwd(), '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
    const expandIndex = workflow.indexOf('\n      - name: Run D1 migrations');
    const deployIndex = workflow.indexOf('\n      - name: Deploy to Cloudflare Pages');
    const activateIndex = workflow.indexOf('\n      - name: Activate postdeploy D1 migrations');
    const drainIndex = workflow.indexOf('\n      - name: Drain postdeploy creator notifications');
    expect(expandIndex).toBeGreaterThanOrEqual(0);
    expect(deployIndex).toBeGreaterThan(expandIndex);
    expect(activateIndex).toBeGreaterThan(deployIndex);
    expect(drainIndex).toBeGreaterThan(activateIndex);

    const config = readFileSync(resolve(process.cwd(), '..', 'wrangler.postdeploy.toml'), 'utf8');
    expect(config).toContain('migrations_dir = "./d1-postdeploy-migrations"');
    expect(config).toContain('migrations_table = "d1_postdeploy_migrations"');
    expect(workflow).toContain('--config wrangler.postdeploy.toml');
    expect(workflow).toContain('openssl rand -hex 32');
    expect(workflow).toContain('creator_share_notification_drain_runs');
    expect(workflow).toContain('X-Creator-Drain-Run');
    expect(workflow).toContain('set -euo pipefail');
    expect(workflow).toContain('for _ in $(seq 1 30)');
    expect(workflow).toContain('if ! DRAIN_HTTP_STATUS="$(curl --silent --show-error');
    expect(workflow).toContain('--connect-timeout 5');
    expect(workflow).toContain('--max-time 20');
    expect(workflow).toContain('--output "${DRAIN_RESPONSE_FILE}"');
    expect(workflow).toContain("--write-out '%{http_code}'");
    expect(workflow).toContain('404|429|502|504)');
    expect(workflow).toContain('sleep 2');
    expect(workflow).not.toContain('--fail-with-body');
    expect(workflow).not.toMatch(/set -x|echo[^\n]*DRAIN_NONCE/);
  });

  it('normalizes only proven admin blocks and quarantines every ambiguous or Creator-revoked legacy row', async () => {
    harness = createProductionKnowledgeHonoHarness();
    const migrations = sqlFiles('d1-migrations');
    for (const migration of migrations.filter(({ name }) => name < '0106_')) harness.exec(migration.sql);
    harness.run(`INSERT INTO users (id, email, password_hash) VALUES (8930, 'provenance-creator@test.invalid', 'x')`);
    harness.run(`INSERT INTO users (id, email, password_hash, role) VALUES (8931, 'provenance-admin@test.invalid', 'x', 'admin')`);
    harness.run(`INSERT INTO users (id, email, password_hash, role) VALUES (8932, 'provenance-importer@test.invalid', 'x', 'user')`);
    harness.run(`INSERT INTO parties (id, type, name, slug, status) VALUES (8930, 'creator', 'Provenance Creator', 'provenance-creator', 'active')`);
    harness.run(`
      INSERT INTO share_links (
        id, token, entity_type, entity_id, snapshot_json, creator_user_id,
        creator_party_id, snapshot_schema_version, snapshot_hash,
        moderation_status, is_revoked, moderated_by_user_id, moderated_at
      ) VALUES
        (8930, 'historic_admin_block_abcdef', 'stack', 1, '{}', 8930, 8930, 3, ?, 'blocked', 1, 8931, '2026-08-01 12:00:00'),
        (8933, 'legacy_creator_revoke_abcdef', 'stack', 1, '{}', 8930, 8930, 3, ?, 'pending', 0, NULL, NULL),
        (8934, 'legacy_ambiguous_approve_ab', 'stack', 1, '{}', 8930, 8930, 3, ?, 'pending', 0, NULL, NULL),
        (8935, 'legacy_same_status_unrevoke', 'stack', 1, '{}', 8930, 8930, 3, ?, 'approved', 0, 8931, CURRENT_TIMESTAMP)
    `, '1'.repeat(64), '2'.repeat(64), '3'.repeat(64), '4'.repeat(64));
    recordLegacyHeadAdminAudit(harness, {
      shareId: 8930,
      adminUserId: 8931,
      expectedStatus: 'pending',
      moderationStatus: 'blocked',
      revoked: 1,
    });

    const expand = migrations.find(({ name }) => name.startsWith('0106_'));
    expect(expand).toBeDefined();
    harness.exec(expand!.sql);
    const db = harness.db as TestDatabase;

    expect(await runLegacyHeadModeration(db, {
      shareId: 8933,
      moderationStatus: 'approved',
      revoked: 0,
      adminUserId: 8931,
      expectedStatus: 'pending',
      expectedHash: '2'.repeat(64),
    })).toBe(1);
    recordLegacyHeadAdminAudit(harness, {
      shareId: 8933,
      adminUserId: 8931,
      expectedStatus: 'pending',
      moderationStatus: 'approved',
      revoked: 0,
    });
    expect((await db.prepare(LEGACY_HEAD_CREATOR_REVOKE_SQL).bind(
      8933,
      8930,
      '2'.repeat(64),
      'approved',
    ).run()).meta.changes).toBe(1);

    expect(await runLegacyHeadModeration(db, {
      shareId: 8934,
      moderationStatus: 'approved',
      revoked: 0,
      adminUserId: 8931,
      expectedStatus: 'pending',
      expectedHash: '3'.repeat(64),
    })).toBe(1);

    expect((await db.prepare(LEGACY_HEAD_CREATOR_REVOKE_SQL).bind(
      8935,
      8930,
      '4'.repeat(64),
      'approved',
    ).run()).meta.changes).toBe(1);
    await expect(runLegacyHeadModeration(db, {
      shareId: 8935,
      moderationStatus: 'approved',
      revoked: 0,
      adminUserId: 8931,
      expectedStatus: 'approved',
      expectedHash: '4'.repeat(64),
    })).rejects.toThrow(/ambiguous legacy creator share moderation write|creator share revocation is terminal/);
    expect(await db.prepare(`
      SELECT version, moderation_status, is_revoked, legacy_provenance_status
      FROM share_links WHERE id = 8935
    `).first()).toEqual({
      version: 1,
      moderation_status: 'approved',
      is_revoked: 1,
      legacy_provenance_status: null,
    });
    expect(await db.prepare(`
      SELECT COUNT(*) AS count FROM admin_audit_log
      WHERE entity_type = 'share_link' AND entity_id = '8935'
        AND action = 'moderate_creator_share'
    `).first()).toEqual({ count: 0 });

    const activation = sqlFiles('d1-postdeploy-migrations').find(({ name }) => name.startsWith('0001_'));
    expect(activation).toBeDefined();
    harness.exec(activation!.sql);

    expect((await db.prepare(`
      SELECT id, version, moderation_status, is_revoked, legacy_provenance_status
      FROM share_links WHERE id IN (8930, 8933, 8934, 8935) ORDER BY id
    `).all<Record<string, unknown>>()).results).toEqual([
      { id: 8930, version: 2, moderation_status: 'blocked', is_revoked: 0, legacy_provenance_status: null },
      { id: 8933, version: 2, moderation_status: 'approved', is_revoked: 1, legacy_provenance_status: 'ambiguous' },
      { id: 8934, version: 2, moderation_status: 'approved', is_revoked: 0, legacy_provenance_status: 'ambiguous' },
      { id: 8935, version: 2, moderation_status: 'approved', is_revoked: 1, legacy_provenance_status: 'ambiguous' },
    ]);
    expect(await db.prepare(`SELECT COUNT(*) AS count FROM creator_share_workflow_legacy_transitions`).first()).toEqual({ count: 1 });
    expect(await db.prepare(`SELECT COUNT(*) AS count FROM creator_share_workflow_legacy_ambiguous`).first()).toEqual({ count: 3 });
    expect(await db.prepare(`SELECT COUNT(*) AS count FROM creator_share_notification_events`).first()).toEqual({ count: 0 });

    const importer = await authToken(8932, 'provenance-importer@test.invalid');
    for (const token of ['legacy_creator_revoke_abcdef', 'legacy_ambiguous_approve_ab', 'legacy_same_status_unrevoke']) {
      const publicResponse = await fetchCreatorSharingHono(new Request(
        `https://supplementstack.de/api/creator-sharing/shares/${token}`,
      ), {
        DB: harness.db,
        JWT_SECRET,
        FRONTEND_URL: 'https://supplementstack.de',
        CREATOR_STACK_SHARING_ENABLED: 'true',
      }, { waitUntil() {}, passThroughOnException() {}, props: {} });
      expect(publicResponse.status).toBe(410);
      expect(await publicResponse.json()).toMatchObject({ code: 'SHARE_UNAVAILABLE' });

      const importResponse = await fetchCreatorSharingHono(new Request(
        `https://supplementstack.de/api/creator-sharing/shares/${token}/preflight`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${importer}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_mode: 'new', stack_name: 'Quarantäne' }),
        },
      ), {
        DB: harness.db,
        JWT_SECRET,
        FRONTEND_URL: 'https://supplementstack.de',
        CREATOR_STACK_SHARING_ENABLED: 'true',
      }, { waitUntil() {}, passThroughOnException() {}, props: {} });
      expect(importResponse.status).toBe(410);
      expect(await importResponse.json()).toMatchObject({ code: 'SHARE_UNAVAILABLE' });
    }
  });

  it('keeps the rollout expanded and installs no strict trigger when the baseline check fails', async () => {
    harness = createProductionKnowledgeHonoHarness();
    const migrations = sqlFiles('d1-migrations');
    for (const migration of migrations.filter(({ name }) => name < '0106_')) harness.exec(migration.sql);
    harness.run(`INSERT INTO users (id, email, password_hash) VALUES (8920, 'baseline-check@test.invalid', 'x')`);
    harness.run(`
      INSERT INTO share_links (
        id, token, entity_type, entity_id, snapshot_json, creator_user_id,
        snapshot_schema_version, snapshot_hash, moderation_status, is_revoked
      ) VALUES (8920, 'baseline_check_abcdefghijkl', 'stack', 1, '{}', 8920, 3, ?, 'pending', 0)
    `, 'f'.repeat(64));
    const expand = migrations.find(({ name }) => name.startsWith('0106_'));
    expect(expand).toBeDefined();
    harness.exec(expand!.sql);
    harness.run(`
      DELETE FROM creator_share_workflow_baseline
      WHERE rollout_key = 'creator_portfolio_v1' AND share_link_id = 8920
    `);
    const activation = sqlFiles('d1-postdeploy-migrations').find(({ name }) => name.startsWith('0001_'));
    expect(activation).toBeDefined();
    expect(() => harness!.exec(activation!.sql)).toThrow(/constraint|check/i);
    const db = harness.db as TestDatabase;
    expect(await db.prepare(`
      SELECT phase, activated_at FROM creator_share_workflow_rollouts
      WHERE rollout_key = 'creator_portfolio_v1'
    `).first()).toEqual({ phase: 'expanded', activated_at: null });
    expect(await db.prepare(`
      SELECT COUNT(*) AS count FROM sqlite_master
      WHERE type = 'trigger' AND name = 'trg_share_links_require_versioned_moderation'
    `).first()).toEqual({ count: 0 });
  });
});
