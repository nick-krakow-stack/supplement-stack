// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { markdownToPrerenderText } from '../../../functions/lib/knowledge-indexability';

describe('knowledge indexability text projection', () => {
  it('keeps unsupported inline syntax literal and only unwraps a real image caption', () => {
    const markdown = [
      '## Einordnung',
      '',
      '~~unsicher~~ und <https://example.com>',
      '',
      'Text <!-- literal --> bleibt.',
      '',
      '_Eigenständiger Unterstrichtext_',
      '',
      '![**Schema**](/api/r2/knowledge/schema.png)',
      '',
      '_Untertitel_',
    ].join('\n');

    const visible = markdownToPrerenderText(markdown);

    expect(visible).toContain('~~unsicher~~ und <https://example.com>');
    expect(visible).toContain('Text <!-- literal --> bleibt.');
    expect(visible).toContain('_Eigenständiger Unterstrichtext_');
    expect(visible).toContain('Schema');
    expect(visible).toContain('Untertitel');
    expect(visible).not.toContain('**Schema**');
    expect(visible).not.toContain('_Untertitel_');
  });
});
