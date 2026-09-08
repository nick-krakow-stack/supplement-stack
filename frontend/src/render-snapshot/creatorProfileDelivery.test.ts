import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/_middleware';
import { onRequestGet as sitemap } from '../../../functions/sitemap.xml';
import * as profiles from '../../../functions/api/lib/creator-public-profile';
import type { Env } from '../../../functions/api/lib/types';
import type { PublicCreatorProfile } from '../../../functions/lib/creator-profile-projection.mjs';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
const shell = '<html><head><title>Old</title></head><body><div id="root"></div></body></html>';
const profile: PublicCreatorProfile = { slug: 'creator-test', name: 'Creator Test', type: 'creator', profile_image_url: null, description: 'Ich stelle mich auf meiner öffentlichen Creator-Seite kurz vor und teile meinen Blick auf die Planung.', published_at: '2026-09-08 12:00:00' };
async function page(method = 'GET', enabled = true) {
  const response = await onRequest({ request: new Request('https://supplementstack.de/creator/creator-test?private=query', { method }), next: async () => new Response(shell, { headers: { 'Content-Type': 'text/html', ETag: 'shell' } }), env: { CREATOR_STACK_SHARING_ENABLED: String(enabled) } } as unknown as Parameters<typeof onRequest>[0]);
  return { response, html: await response.text() };
}
afterEach(() => vi.restoreAllMocks());

describe('consented public creator edge delivery', () => {
  it('serves GET/HEAD through the same public-state loader with no-store and canonical metadata', async () => {
    const load = vi.spyOn(profiles, 'loadPublicCreatorProfile').mockResolvedValue(profile);
    for (const method of ['GET', 'HEAD']) {
      const { response, html } = await page(method);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(response.headers.get('ETag')).toBeNull();
      expect(response.headers.get('X-Robots-Tag')).toBe('index, follow');
      if (method === 'HEAD') expect(html).toBe('');
      else {
        const doc = new JSDOM(html).window.document;
        expect(doc.querySelector('h1')?.textContent).toBe(profile.name);
        expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://supplementstack.de/creator/creator-test');
        expect(html).not.toContain('private=query');
        expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
      }
    }
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('returns noindex404 for hidden profiles or disabled feature without exposing prior data', async () => {
    const load = vi.spyOn(profiles, 'loadPublicCreatorProfile').mockResolvedValue(null);
    const hidden = await page();
    const disabled = await page('GET', false);
    expect(load).toHaveBeenCalledOnce();
    for (const { response, html } of [hidden, disabled]) {
      expect(response.status).toBe(404);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      expect(html).not.toContain(profile.description);
      expect(new JSDOM(html).window.document.querySelector('link[rel="canonical"]')).toBeNull();
    }
  });

  it('fails closed with503 instead of a stale profile on storage failure', async () => {
    vi.spyOn(profiles, 'loadPublicCreatorProfile').mockRejectedValue(new Error('private D1 error'));
    const { response, html } = await page();
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(html).toContain('Diese Creator-Seite kann gerade nicht geladen werden');
    expect(html).not.toContain('private D1 error');
  });

  it('uses the same public eligibility service for the sitemap, including disabled and failure states', async () => {
    const list = vi.spyOn(profiles, 'listPublicCreatorProfiles').mockResolvedValue([{ slug: profile.slug, published_at: profile.published_at }]);
    const db = { prepare: () => ({ all: async () => ({ results: [{ slug: 'magnesium', updated_at: '2026-09-08 12:00:00' }] }) }) } as unknown as Env['DB'];
    const request = new Request('https://supplementstack.de/sitemap.xml');
    const context = { request, env: { DB: db, CREATOR_STACK_SHARING_ENABLED: 'true' } } as unknown as Parameters<typeof sitemap>[0];
    expect(await (await sitemap(context)).text()).toContain('/creator/creator-test</loc>');
    list.mockResolvedValue([]);
    expect(await (await sitemap(context)).text()).not.toContain('/creator/');
    list.mockRejectedValue(new Error('unavailable'));
    expect((await sitemap(context)).status).toBe(503);
    context.env.CREATOR_STACK_SHARING_ENABLED = 'false';
    expect((await sitemap(context)).status).toBe(200);
    expect(list).toHaveBeenCalledTimes(3);
  });
});
