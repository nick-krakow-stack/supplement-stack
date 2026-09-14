import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { collectSeoMetadataSurfaceV1 } from '../../validate-knowledge-magazine-style.mjs';

describe('SEO-only observation preserves the actual article surface', () => {
  for (const hydrated of [false, true]) {
    it(`collects ${hydrated ? 'hydrated' : 'raw SSR'} content without app navigation`, () => {
      const dom = new JSDOM(`<html><head><title>Kurzer Suchtext</title>
        <meta name="description" content="Eine eigene Suchbeschreibung.">
        <meta name="robots" content="index,follow"><link rel="canonical" href="/wissen/test">
        <script type="application/ld+json">{"@graph":[{"@type":"Article"}]}</script></head>
        <body><nav><a href="/profile">Privates Menü</a></nav><main ${hydrated ? '' : 'data-knowledge-prerender="test"'}>
        <article ${hydrated ? 'data-template="magazine"' : ''}><h1>Langer Originaltitel</h1>
        <p>Unveränderter <strong>Inhalt</strong>.</p><a href="https://example.org/source">Originalquelle</a>
        <img src="/image.png" alt="Bild"><time datetime="2026-09-01">1. September</time></article>
        </main></body></html>`, { url: 'https://supplementstack.de/wissen/test' });
      const result = collectSeoMetadataSurfaceV1(dom.window.document);
      expect(result.h1).toBe('Langer Originaltitel');
      expect(result.article_html).toContain('<strong>Inhalt</strong>');
      expect(result.article_text).not.toContain('Privates Menü');
      expect(result.links).toEqual([{ label: 'Originalquelle', url: 'https://example.org/source' }]);
      expect(result.images).toEqual([{ src: '/image.png', alt: 'Bild' }]);
      expect(result.times).toEqual([{ text: '1. September', datetime: '2026-09-01' }]);
      expect(result.title).toBe('Kurzer Suchtext');
      expect(result.canonical).toBe('https://supplementstack.de/wissen/test');
      expect(result.json_ld).toEqual([{ '@graph': [{ '@type': 'Article' }] }]);
      dom.window.close();
    });
  }
  it('does not replace a missing article or malformed JSON-LD with a fabricated value', () => {
    const dom = new JSDOM('<main>App shell</main><script type="application/ld+json">invalid</script>');
    const result = collectSeoMetadataSurfaceV1(dom.window.document);
    expect(result.article_html).toBeNull();
    expect(result.h1).toBeNull();
    expect(result.json_ld).toEqual([null]);
    dom.window.close();
  });
});
