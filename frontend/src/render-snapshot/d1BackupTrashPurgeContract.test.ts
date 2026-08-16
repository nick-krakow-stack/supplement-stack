import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('daily D1 backup and stack trash purge contract', () => {
  it('purges only expired trashed stacks after the backup artifact and checks exact before/after counts', () => {
    const workflow = readFileSync(resolve(process.cwd(), '..', '.github/workflows/d1-backup.yml'), 'utf8');
    const upload = workflow.indexOf('Upload backup as artifact');
    const purge = workflow.indexOf('Purge stacks whose 7-day recovery window expired');

    expect(upload).toBeGreaterThan(0);
    expect(purge).toBeGreaterThan(upload);
    expect(workflow).toContain('group: d1-production-backup-and-trash-purge');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain("WHERE deleted_at IS NOT NULL AND delete_purge_after IS NOT NULL AND delete_purge_after <= '${PURGE_CUTOFF}'");
    expect(workflow).toContain('PURGED_COUNT" != "$BEFORE_COUNT');
    expect(workflow).toContain('AFTER_COUNT" != "0');
    expect(workflow).toContain('GITHUB_STEP_SUMMARY');
  });
});
