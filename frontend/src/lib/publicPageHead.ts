import { resolveRouteHead, type RouteHead } from '../../../functions/lib/route-head-contract.mjs';

/** Replace, never restore, route-owned metadata when the SPA moves between pages. */
export function applyPublicRouteHead(head: RouteHead) {
  document.title = head.title;
  document.head.querySelectorAll('meta[name="description"], meta[name="robots"], meta[name="referrer"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], script[type="application/ld+json"]').forEach((node) => node.remove());
  const meta = (name: string, content: string, property = false) => {
    const element = document.createElement('meta');
    element.setAttribute(property ? 'property' : 'name', name);
    element.content = content;
    element.dataset.routeHead = '';
    document.head.appendChild(element);
  };
  meta('description', head.description);
  meta('robots', head.robots);
  meta('referrer', head.referrerPolicy);
  meta('og:title', head.title, true);
  meta('og:description', head.description, true);
  meta('og:type', head.ogType, true);
  meta('og:site_name', 'Supplement Stack', true);
  meta('og:locale', 'de_DE', true);
  meta('og:image', head.image, true);
  meta('og:image:alt', head.imageAlt, true);
  meta('twitter:card', 'summary_large_image');
  meta('twitter:title', head.title);
  meta('twitter:description', head.description);
  meta('twitter:image', head.image);
  meta('twitter:image:alt', head.imageAlt);
  if (head.canonicalUrl) {
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = head.canonicalUrl;
    canonical.dataset.routeHead = '';
    document.head.appendChild(canonical);
    meta('og:url', head.canonicalUrl, true);
  }
  if (head.jsonLd) {
    const script = document.createElement('script');
    script.id = 'route-json-ld';
    script.type = 'application/ld+json';
    script.dataset.routeHead = '';
    if (head.kind === 'knowledge-article') script.dataset.knowledgeArticleJsonLd = 'true';
    script.textContent = JSON.stringify(head.jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    document.head.appendChild(script);
  }
}

type PublicPageHead = {
  title: string;
  robots: RouteHead['robots'];
  canonicalPath: string | null;
};

// Compatibility for legal/error states: the route contract still limits indexing.
export function setPublicPageHead({ title, robots, canonicalPath }: PublicPageHead) {
  const head = resolveRouteHead({ pathname: canonicalPath ?? window.location.pathname, title });
  if (robots === 'noindex,nofollow') {
    head.robots = robots;
    head.canonicalUrl = null;
    head.jsonLd = null;
  }
  applyPublicRouteHead(head);
}
