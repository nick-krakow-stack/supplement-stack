import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

type KnowledgeEntry = {
  slug: string;
  type: string;
  title: string;
  summary: string;
  keywords: string[];
  available?: boolean;
};

const ENTRIES: KnowledgeEntry[] = [
  {
    slug: 'beta-carotin-raucher-lungenkrebs',
    type: 'Sicherheitshinweis',
    title: 'Beta-Carotin und Lungenkrebsrisiko bei Rauchern',
    summary: 'Kurzüberblick zu hoch dosiertem Beta-Carotin, Risikogruppen und den zugrunde liegenden Quellen.',
    keywords: ['beta carotin', 'rauchen', 'lungenkrebs', 'vitamin a', 'risiko', 'sicherheit'],
    available: true,
  },
  {
    slug: 'vitamin-d-dge-studien',
    type: 'Dosierung',
    title: 'Vitamin D: DGE, Studien und sinnvolle Zielwerte',
    summary: 'Warum offizielle Empfehlungen und Studienwerte teilweise deutlich auseinanderliegen.',
    keywords: ['vitamin d', 'dge', 'studien', 'iu', 'ie', 'sonne', 'blutwert'],
  },
  {
    slug: 'magnesium-formen-vergleich',
    type: 'Wirkstoffformen',
    title: 'Magnesiumcitrat, Glycinat und Oxid im Vergleich',
    summary: 'Welche Magnesiumformen häufig genutzt werden und worin sie sich praktisch unterscheiden.',
    keywords: ['magnesium', 'citrat', 'glycinat', 'oxid', 'formen', 'aufnahme'],
  },
  {
    slug: 'b12-methylcobalamin-cyanocobalamin',
    type: 'Wirkstoffformen',
    title: 'Vitamin B12: Methylcobalamin oder Cyanocobalamin?',
    summary: 'Einordnung der B12-Formen, typischer Dosierungen und offener Fragen.',
    keywords: ['b12', 'methylcobalamin', 'cyanocobalamin', 'lutschtabletten', 'tropfen'],
  },
  {
    slug: 'kaffee-tee-mineralstoffe',
    type: 'Einnahme',
    title: 'Kaffee, Tee und Mineralstoffe',
    summary: 'Wann ein zeitlicher Abstand sinnvoll sein kann und wie stark die Hinweise sind.',
    keywords: ['kaffee', 'tee', 'einnahmeabstand', 'mineralstoffe', 'aufnahme'],
  },
  {
    slug: 'omega-3-epa-dha',
    type: 'Dosierung',
    title: 'Omega-3: EPA, DHA und Tagesmengen',
    summary: 'Unterschiede zwischen Algenöl, Fischöl, ALA und typischen Studienmengen.',
    keywords: ['omega 3', 'epa', 'dha', 'algenöl', 'fischöl', 'ala'],
  },
  {
    slug: 'zink-kupfer-langzeit',
    type: 'Sicherheitshinweis',
    title: 'Zink und Kupfer bei langfristiger Einnahme',
    summary: 'Warum hohe Zinkmengen langfristig nicht isoliert betrachtet werden sollten.',
    keywords: ['zink', 'kupfer', 'langzeit', 'upper limit', 'ul', 'mangel'],
  },
  {
    slug: 'kreatin-monohydrat',
    type: 'Studienlage',
    title: 'Kreatin Monohydrat: was ist gut belegt?',
    summary: 'Kurzordnung zu Dosierung, Ladephase, Alltagstauglichkeit und Studienlage.',
    keywords: ['kreatin', 'creatin', 'monohydrat', 'sport', 'ladephase'],
  },
  {
    slug: 'nrv-ul-dge-efsa',
    type: 'Grundlagen',
    title: 'NRV, UL, DGE und EFSA einfach erklärt',
    summary: 'Was die Werte bedeuten, warum sie nicht dasselbe sind und wie wir sie verwenden.',
    keywords: ['nrv', 'ul', 'dge', 'efsa', 'referenzwert', 'grenzwert'],
  },
  {
    slug: 'ashwagandha-sicherheit',
    type: 'Sicherheitshinweis',
    title: 'Ashwagandha: Nutzen, Risiken und offene Fragen',
    summary: 'Einordnung häufiger Aussagen, Warnhinweise und Qualität der verfügbaren Quellen.',
    keywords: ['ashwagandha', 'adaptogen', 'stress', 'schilddrüse', 'leber'],
  },
  {
    slug: 'eisen-ferritin',
    type: 'Blutwerte',
    title: 'Eisen, Ferritin und Supplementierung',
    summary: 'Warum Eisen ohne Kontext schnell falsch eingeordnet werden kann.',
    keywords: ['eisen', 'ferritin', 'mangel', 'blutwert', 'anämie'],
  },
  {
    slug: 'probiotika-mikrobiom',
    type: 'Studienlage',
    title: 'Probiotika und Mikrobiom',
    summary: 'Warum Stamm, Dosis und Ziel sehr viel wichtiger sind als ein allgemeines Probiotikum-Label.',
    keywords: ['probiotika', 'mikrobiom', 'darm', 'stämme', 'verdauung'],
  },
];

const POPULAR_TERMS = ['Vitamin D', 'Magnesium', 'B12', 'Omega-3', 'DGE', 'EFSA', 'Kaffee', 'Zink', 'NRV', 'UL'];

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function entryMatches(entry: KnowledgeEntry, query: string): boolean {
  if (!query) return true;
  const haystack = [
    entry.type,
    entry.title,
    entry.summary,
    ...entry.keywords,
  ].join(' ').toLowerCase();
  return haystack.includes(query);
}

function EntryCard({ entry }: { entry: KnowledgeEntry }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{entry.type}</p>
        {!entry.available && (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
            bald
          </span>
        )}
      </div>
      <h2 className="mt-2 text-lg font-black leading-tight text-slate-950">{entry.title}</h2>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{entry.summary}</p>
    </>
  );

  if (!entry.available) {
    return (
      <article className="mb-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {content}
      </article>
    );
  }

  return (
    <Link
      to={`/wissen/${entry.slug}`}
      className="mb-4 block break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      {content}
    </Link>
  );
}

export default function KnowledgeIndexPage() {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearch(query);
  const filteredEntries = useMemo(
    () => ENTRIES.filter((entry) => entryMatches(entry, normalizedQuery)),
    [normalizedQuery],
  );
  const featuredEntries = filteredEntries.slice(0, 9);
  const remainingEntries = filteredEntries.slice(9);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700">Studien & mehr</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">Was willst du wissen?</h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
              Woher nehmen wir die Zahlen, die wir in den Supplements angeben? Welche Wirkungen und welche Risiken
              wurden gefunden? Wo liegt eigentlich der Unterschied bei den Empfehlungen in verschiedenen Ländern?
              Hier findest du sämtliche Quellen, Studien und Auswertungen, auf die wir uns beziehen.
            </p>
          </div>
          <label className="relative block w-full lg:w-80">
            <span className="sr-only">Wissensdatenbank durchsuchen</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
              placeholder="Wirkstoff, Risiko, Quelle..."
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {POPULAR_TERMS.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setQuery(term)}
              className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
            >
              {term}
            </button>
          ))}
        </div>
      </section>

      <section>
        {featuredEntries.length > 0 ? (
          <div className="gap-4 md:columns-2 lg:columns-3">
            {featuredEntries.map((entry) => (
              <EntryCard key={entry.slug} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">
            Keine passenden Einträge gefunden.
          </div>
        )}
      </section>

      {remainingEntries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Weitere Einträge</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {remainingEntries.map((entry) => (
              <div key={entry.slug} className="py-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{entry.type}</p>
                <p className="mt-1 text-sm font-black text-slate-950">{entry.title}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{entry.summary}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-relaxed text-amber-950">
        Wir fassen Studien, Behördenangaben und Quellen redaktionell zusammen und ordnen sie ein. Trotz sorgfältiger
        Prüfung können Aussagen unvollständig sein oder sich durch neue Forschung ändern. Deshalb verlinken wir die
        zugrunde liegenden Quellen, damit du Angaben selbst prüfen und bei gesundheitlichen Fragen medizinischen Rat
        einholen kannst.
      </section>
    </div>
  );
}
