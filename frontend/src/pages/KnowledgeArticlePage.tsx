import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { apiPath } from '../api/base';
import type { KnowledgeArticle } from '../types';

function formatReviewedDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default function KnowledgeArticlePage() {
  const { slug } = useParams();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) {
      setError('Artikel nicht gefunden.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetch(apiPath(`/knowledge/${slug}`), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Artikel nicht gefunden.' : 'Artikel konnte nicht geladen werden.');
        return response.json() as Promise<{ article: KnowledgeArticle }>;
      })
      .then((data) => setArticle(data.article))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Artikel konnte nicht geladen werden.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [slug]);

  const reviewedDate = formatReviewedDate(article?.reviewed_at);
  const normalizedBody = article?.body.replace(/\\n/g, '\n') ?? '';
  const paragraphs = normalizedBody.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Zurueck
      </Link>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">
          Artikel wird geladen...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {!loading && article && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 border-b border-slate-100 pb-6">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-blue-600">Wissen</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{article.title}</h1>
            <p className="mt-4 text-base font-semibold leading-relaxed text-slate-600">{article.summary}</p>
            {reviewedDate && (
              <p className="mt-4 text-sm font-semibold text-slate-400">Geprueft am {reviewedDate}</p>
            )}
          </div>

          <div className="space-y-4 text-[15px] font-medium leading-7 text-slate-700">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {article.sources.length > 0 && (
            <section className="mt-8 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Quellen</h2>
              <ul className="mt-4 space-y-3">
                {article.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-2 text-sm font-bold text-blue-700 hover:text-blue-900"
                    >
                      <ExternalLink size={15} className="mt-0.5 shrink-0" />
                      <span>{source.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
    </main>
  );
}
