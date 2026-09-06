import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigationType } from 'react-router-dom';
import { legalDocumentVersionText, renderLegalMarkdown } from '../../../functions/lib/legal-document-renderer.mjs';
import { loadLegalDocument, readLegalDocumentBootstrap, type LegalDocumentState, type LegalSlug } from '../lib/legalDocumentClient';
import { setPublicPageHead } from '../lib/publicPageHead';

type Props = { slug: LegalSlug; title: string };

function LegalDocumentContent({ slug, title }: Props) {
  const bootstrap = useRef(readLegalDocumentBootstrap(slug));
  const [state, setState] = useState<LegalDocumentState>(() => bootstrap.current ?? { status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // The initial server projection is already the published source, not a cache to refresh.
    if (attempt === 0 && bootstrap.current) return;
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading' });
    void loadLegalDocument(slug, controller.signal).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, attempt]);

  useLayoutEffect(() => {
    document.getElementById('legal-prerender')?.remove();
    document.getElementById('legal-document-bootstrap')?.remove();
  }, []);

  useLayoutEffect(() => {
    if (navigationType !== 'POP' && !location.hash) window.scrollTo(0, 0);
  }, [navigationType, location.hash]);

  useLayoutEffect(() => {
    setPublicPageHead({
      title: `${state.status === 'ready' ? state.document.title : title} | Supplement Stack`,
      robots: state.status === 'ready' ? 'index,follow' : 'noindex,nofollow',
      canonicalPath: state.status === 'ready' ? `/${slug}` : null,
    });
  }, [slug, state, title]);

  if (state.status !== 'ready') {
    return (
      <div className="legal-page">
        <article className="legal-document" aria-labelledby="legal-page-title">
          <h1 id="legal-page-title" className="legal-document-title">{title}</h1>
          {state.status === 'loading' ? (
            <p className="legal-page-message" role="status">Der Text wird geladen …</p>
          ) : (
            <div className="legal-page-recovery">
              <p role="alert">{state.httpStatus === 404
                ? 'Dieser Text ist gerade nicht verfügbar.'
                : 'Der Text konnte gerade nicht geladen werden. Bitte versuche es erneut.'}</p>
              <div className="legal-page-actions">
                <button className="legal-page-primary" type="button" onClick={() => setAttempt((value) => value + 1)}>Erneut versuchen</button>
                <Link className="legal-page-secondary" to="/">Zur Startseite</Link>
              </div>
            </div>
          )}
        </article>
      </div>
    );
  }

  const legalDocument = state.document;
  const versionText = legalDocumentVersionText(legalDocument);
  return (
    <div className="legal-page">
      <article className="legal-document" aria-labelledby="legal-page-title" data-legal-slug={slug} data-legal-version={legalDocument.version ?? undefined}>
        <h1 id="legal-page-title" className="legal-document-title">{legalDocument.title}</h1>
        {versionText && <p className="legal-document-version">{versionText}</p>}
        <div className="legal-document-body" dangerouslySetInnerHTML={{ __html: renderLegalMarkdown(legalDocument.body_md, legalDocument.title) }} />
      </article>
    </div>
  );
}

export default function LegalDocumentPage(props: Props) {
  // A slug change must never keep the previous legal text visible while loading.
  return <LegalDocumentContent key={props.slug} {...props} />;
}
