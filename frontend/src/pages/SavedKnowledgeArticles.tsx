import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiPath } from '../api/base';
import { KnowledgeArticleLoadError, loadKnowledgeArticle } from '../lib/knowledgeArticleClient';
import { knowledgeNavigationState, knowledgeOverviewSearch, readSavedKnowledgeSlugs, setKnowledgeArticleSaved } from '../lib/knowledgeNavigation';
import type { KnowledgeArticle } from '../types';

type SavedArticle = { slug: string; article?: KnowledgeArticle; unavailable?: boolean; failed?: boolean };

export default function SavedKnowledgeArticles() {
  const location = useLocation();
  const [slugs, setSlugs] = useState(readSavedKnowledgeSlugs);
  const [items, setItems] = useState<SavedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  const navigationState = knowledgeNavigationState(location.state);
  const articleSearch = knowledgeOverviewSearch(location.search);
  const overviewParams = new URLSearchParams(articleSearch);
  overviewParams.delete('saved');
  const overviewHref = `/wissen${overviewParams.size ? `?${overviewParams}` : ''}`;
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all(slugs.map(async (slug): Promise<SavedArticle> => {
      try {
        return { slug, article: await loadKnowledgeArticle(slug, apiPath(`/knowledge/${encodeURIComponent(slug)}`)) };
      } catch (error) {
        return { slug, unavailable: error instanceof KnowledgeArticleLoadError && [404, 410].includes(error.status), failed: true };
      }
    })).then((result) => { if (active) { setItems(result); setLoading(false); } });
    return () => { active = false; };
  }, [slugs, attempt]);

  const remove = (slug: string) => {
    try {
      setKnowledgeArticleSaved(slug, false);
      setSlugs(readSavedKnowledgeSlugs());
      setMessage('Artikel aus deiner Merkliste entfernt.');
    } catch { setMessage('Der Artikel konnte gerade nicht aus der Merkliste entfernt werden.'); }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <h1 className="text-3xl font-black text-slate-950">Gemerkte Artikel</h1>
      <p className="text-base text-slate-600">Hier findest du Artikel, die du in diesem Browser gemerkt hast.</p>
      <Link to={overviewHref} state={navigationState} className="inline-flex min-h-11 items-center font-bold text-blue-700 underline">Zur Wissensübersicht</Link>
      <p role="status" aria-live="polite">{loading ? 'Deine gemerkten Artikel werden geladen …' : message}</p>
      {!loading && !items.length && <p>Noch keine Artikel gemerkt. Öffne einen Artikel und wähle „Artikel merken“.</p>}
      <ul className="space-y-3">
        {!loading && items.map(({ slug, article, unavailable }) => (
          <li key={slug} className="rounded-xl border border-slate-200 bg-white p-4">
            {article ? <><Link to={`/wissen/${slug}${articleSearch}`} state={{ ...navigationState, overviewSearch: articleSearch }} className="block break-words text-lg font-bold text-blue-700 hover:underline">{article.title}</Link><p className="mt-2 text-sm text-slate-600">{article.article_layer === 'single_study' ? 'Studien- und Quellenartikel' : 'Wissensartikel'}</p></> : <><h2 className="break-words text-lg font-bold">{slug.replace(/-/g, ' ')}</h2><p className="mt-2">{unavailable ? 'Dieser Artikel ist nicht mehr verfügbar.' : 'Dieser Artikel konnte gerade nicht geladen werden.'}</p></>}
            <button type="button" onClick={() => remove(slug)} className="mt-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Aus Merkliste entfernen</button>
          </li>
        ))}
      </ul>
      {!loading && items.some((item) => item.failed && !item.unavailable) && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 rounded-lg bg-blue-600 px-4 font-bold text-white">Erneut laden</button>}
    </main>
  );
}
