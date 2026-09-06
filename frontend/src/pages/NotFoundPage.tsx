import { useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { setPublicPageHead } from '../lib/publicPageHead';

export default function NotFoundPage() {
  useLayoutEffect(() => {
    document.getElementById('site-not-found-prerender')?.remove();
    setPublicPageHead({ title: 'Seite nicht gefunden | Supplement Stack', robots: 'noindex,nofollow', canonicalPath: null });
  }, []);

  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <p className="not-found-code" aria-hidden="true">404</p>
      <h1 id="not-found-title">Diese Seite gibt es nicht</h1>
      <p>Vielleicht wurde sie verschoben oder der Link ist nicht mehr gültig.</p>
      <nav className="legal-page-actions" aria-label="Weiter nach der Fehlerseite">
        <Link className="legal-page-primary" to="/">Startseite</Link>
        <Link className="legal-page-secondary" to="/wissen">Wissen entdecken</Link>
        <Link className="legal-page-secondary" to="/stacks">Meine Stacks</Link>
      </nav>
    </section>
  );
}
