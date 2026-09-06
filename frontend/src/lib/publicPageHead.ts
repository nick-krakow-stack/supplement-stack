type PublicPageHead = {
  title: string;
  robots: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  canonicalPath: string | null;
};

export function setPublicPageHead({ title, robots, canonicalPath }: PublicPageHead) {
  document.title = title;
  let robotsMeta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.content = robots;
  const canonicals = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')];
  if (!canonicalPath) {
    canonicals.forEach((link) => link.remove());
    return;
  }
  const canonical = canonicals.shift() ?? document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = `https://supplementstack.de${canonicalPath}`;
  if (!canonical.isConnected) document.head.appendChild(canonical);
  canonicals.forEach((link) => link.remove());
}
