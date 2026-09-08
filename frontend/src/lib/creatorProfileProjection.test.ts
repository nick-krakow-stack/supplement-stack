// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { projectCreatorProfile, type PublicCreatorProfile } from '../../../functions/lib/creator-profile-projection.mjs';
import { renderCreatorProfileHtml } from '../../../functions/lib/creator-profile-html';
import { canonicalRouteRedirect, resolveRouteHead } from '../../../functions/lib/route-head-contract.mjs';
import { buildSitemapXml } from '../../../functions/lib/site-crawl.mjs';

const profile: PublicCreatorProfile = { slug: 'creator-test', name: 'Ein Creator <Test>', type: 'creator', profile_image_url: null, description: 'Ich teile hier meine Erfahrungen mit einer übersichtlichen Planung im Alltag.', published_at: '2026-09-08 12:00:00' };
const shell = '<html><head><title>Old</title></head><body><div id="root"></div></body></html>';

describe('one consented public creator projection', () => {
  it('requires positive publication data, separate from the private dashboard and capability links', () => {
    expect(resolveRouteHead({ pathname: '/creator' }).authRequired).toBe(true);
    expect(resolveRouteHead({ pathname: '/creator/creator-test' }).indexable).toBe(false);
    expect(resolveRouteHead({ pathname: '/share/creator-test' }).indexable).toBe(false);
    const { head } = projectCreatorProfile(profile.slug, { status: 200, profile });
    expect(head).toMatchObject({ status: 200, indexable: true, authRequired: false, cacheControl: 'private, no-store', canonicalUrl: 'https://supplementstack.de/creator/creator-test' });
    expect(JSON.stringify(head.jsonLd)).not.toContain('logo.png');
    expect(head.jsonLd).toMatchObject({ '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name: profile.name }, dateModified: '2026-09-08T12:00:00.000Z' });
  });

  it('uses only an actual optional portrait for structured data and recognizes a brand as an organization', () => {
    const { head } = projectCreatorProfile(profile.slug, { status: 200, profile: { ...profile, type: 'brand', profile_image_url: '/api/r2/creator.png' } });
    expect(head.image).toBe('https://supplementstack.de/api/r2/creator.png');
    expect(head.jsonLd).toMatchObject({ mainEntity: { '@type': 'Organization', image: head.image } });
  });

  it.each([404, 503, 'loading'] as const)('keeps unavailable/loading state %s free of profile metadata', (status) => {
    const { head, profile: visible } = projectCreatorProfile(profile.slug, { status });
    expect(visible).toBeNull();
    expect(head.indexable).toBe(false);
    expect(head.canonicalUrl).toBeNull();
    expect(head.jsonLd).toBeNull();
    expect(head.cacheControl).toBe('private, no-store');
    expect(head.title).not.toContain(profile.name);
  });

  it('cannot present another slug’s response as this profile', () => {
    expect(projectCreatorProfile('creator-other', { status: 200, profile }).head.status).toBe(404);
    expect(projectCreatorProfile('../private', { status: 200, profile }).head.indexable).toBe(false);
  });

  it('renders one escaped title and the same description/schema, without claiming a stack or medical approval', () => {
    const { html } = renderCreatorProfileHtml(shell, profile.slug, { status: 200, profile });
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll('main h1')).toHaveLength(1);
    expect(doc.querySelector('h1')?.textContent).toBe(profile.name);
    expect(doc.querySelector('main test')).toBeNull();
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(profile.description);
    expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(doc.querySelector('main')?.textContent).toContain('Deine eigenen Stacks bleiben privat.');
    expect(doc.querySelector('a[href="/wissen"]')).not.toBeNull();
    expect(doc.querySelector('a[href="/demo"]')).not.toBeNull();
    expect(doc.querySelector('a[href^="/share/"]')).toBeNull();
    expect(doc.querySelector('#creator-profile-bootstrap')?.textContent).toContain('creator-test');
  });

  it('adds only provided eligible profile rows to the sitemap and preserves stable canonical aliases', () => {
    const sitemap = buildSitemapXml(new Map([['magnesium', null]]), [{ slug: profile.slug, published_at: profile.published_at }, { slug: '../secret', published_at: profile.published_at }]);
    expect(sitemap).toContain('/creator/creator-test</loc>');
    expect(sitemap).not.toContain('../secret');
    expect(sitemap).not.toContain('/share/');
    expect(canonicalRouteRedirect('https://evil.test/creator/creator-test/')).toBe('https://supplementstack.de/creator/creator-test');
  });
});
