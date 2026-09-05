import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, CheckCircle, ChevronDown, Clock, Copy, ExternalLink, Lightbulb, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { KnowledgeArticle, KnowledgeArticleSource } from '../types';
import { knowledgeSourceIdentity } from '../../../functions/lib/knowledge-source-identity.mjs';
import type { KnowledgeNavigationState } from '../lib/knowledgeNavigation';
import './KnowledgeArticleUx.css';
import {
  isKnowledgeSourceHeading,
  knowledgeInlineMarkdownToText,
  type KnowledgeMarkdownBlock,
  parseKnowledgeMarkdown,
  renderKnowledgeInlineMarkdown,
} from './KnowledgeMarkdown';

type Props = {
  article: KnowledgeArticle;
  reviewedDate: string | null;
  heroActions?: ReactNode;
  editorialInfo?: ReactNode;
  navigationState?: KnowledgeNavigationState;
};

type Section = {
  id: string;
  title: string;
  blocks: KnowledgeMarkdownBlock[];
  controlType: 'merkkasten' | 'legal_notice' | null;
};

type FaqItem = {
  id: string;
  question: string;
  answer: KnowledgeMarkdownBlock[];
};

type TocLink = {
  id: string;
  title: string;
};

export type NormalizedKnowledgeSourceUrl =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string };

const MAGAZINE_MARKER = '<!-- knowledge-template:magazine -->';
const INTERNAL_URL_BASE = 'https://supplementstack.invalid';
// HTTP remains link-only support for verified legacy locators; the client never fetches source URLs.
const ALLOWED_EXTERNAL_SOURCE_PROTOCOLS = new Set(['https:', 'http:']);

function stripMagazineMarker(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().toLowerCase() !== MAGAZINE_MARKER)
    .join('\n');
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function allocateSectionId(text: string, usedIds: Set<string>): string {
  const baseId = slugifyHeading(text) || 'abschnitt';
  let candidate = baseId;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function isTemplateControlHeading(text: string): boolean {
  return /^(merkkasten|rechtlicher hinweis)$/i.test(knowledgeInlineMarkdownToText(text).trim());
}

function isConclusionHeading(text: string): boolean {
  return /^fazit(?:\b|$)/i.test(knowledgeInlineMarkdownToText(text).trim());
}

function controlTypeForHeading(text: string): Section['controlType'] {
  const normalized = knowledgeInlineMarkdownToText(text).trim().toLowerCase();
  if (normalized === 'merkkasten') return 'merkkasten';
  if (normalized === 'rechtlicher hinweis') return 'legal_notice';
  return null;
}

export function isMagazineKnowledgeArticle(markdown: string): boolean {
  return markdown.toLowerCase().includes(MAGAZINE_MARKER);
}

export function hasUnsafeKnowledgeUrlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (
      codePoint <= 0x20
      || (codePoint >= 0x7f && codePoint <= 0xa0)
      || codePoint === 0x1680
      || (codePoint >= 0x2000 && codePoint <= 0x200f)
      || (codePoint >= 0x2028 && codePoint <= 0x202f)
      || codePoint === 0x205f
      || codePoint === 0x2060
      || codePoint === 0x3000
      || codePoint === 0xfeff
      || character === '\\'
    ) {
      return true;
    }
  }
  return false;
}

export function normalizeKnowledgeSourceUrl(
  value: string | null | undefined,
): NormalizedKnowledgeSourceUrl | null {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim() || hasUnsafeKnowledgeUrlCharacters(value)) {
    return null;
  }

  if (value.startsWith('/wissen/')) {
    try {
      const parsed = new URL(value, INTERNAL_URL_BASE);
      if (parsed.origin !== INTERNAL_URL_BASE || !parsed.pathname.startsWith('/wissen/')) return null;
      return { kind: 'internal', href: `${parsed.pathname}${parsed.search}${parsed.hash}` };
    } catch {
      return null;
    }
  }

  if (value.startsWith('/')) return null;

  const lowerCaseValue = value.toLowerCase();
  if (!lowerCaseValue.startsWith('https://') && !lowerCaseValue.startsWith('http://')) return null;

  try {
    const parsed = new URL(value);
    if (
      !ALLOWED_EXTERNAL_SOURCE_PROTOCOLS.has(parsed.protocol)
      || !parsed.hostname
      || parsed.username
      || parsed.password
    ) {
      return null;
    }
    return { kind: 'external', href: parsed.href };
  } catch {
    return null;
  }
}

export function isRenderableKnowledgeSource(source: KnowledgeArticleSource): boolean {
  const label = typeof source.label === 'string' ? source.label.trim() : '';
  const rawUrl = typeof source.url === 'string' ? source.url : '';
  return Boolean(label && rawUrl.trim() !== '#');
}

/** Collapse only identical entries, retaining distinct source identities and locators. */
export function deduplicateKnowledgeSources(sources: KnowledgeArticleSource[]): KnowledgeArticleSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const identity = knowledgeSourceIdentity(source);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function decodeArticleHash(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}

function afterArticleLayout(callback: () => void): () => void {
  if (typeof window.requestAnimationFrame === 'function') {
    const frame = window.requestAnimationFrame(callback);
    return () => window.cancelAnimationFrame(frame);
  }
  const timer = window.setTimeout(callback, 0);
  return () => window.clearTimeout(timer);
}

export function calculateKnowledgeReadingMinutes(body: string, conclusion?: string | null): number {
  const readableText = `${stripMagazineMarker(body)} ${conclusion ?? ''}`;
  const words = readableText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function knowledgeReadingTimeLabel(minutes: number): string {
  return `Lesezeit ca. ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;
}

export function knowledgeSourceCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'Quelle' : 'Quellen'}`;
}

function splitMagazineBody(markdown: string, options: { skipBodySourceSections?: boolean } = {}): {
  leadBlocks: KnowledgeMarkdownBlock[];
  takeaways: string[];
  sections: Section[];
} {
  const blocks = parseKnowledgeMarkdown(stripMagazineMarker(markdown));
  const leadBlocks: KnowledgeMarkdownBlock[] = [];
  const sections: Section[] = [];
  const takeaways: string[] = [];
  const usedSectionIds = new Set<string>(['ueberblick']);
  if (options.skipBodySourceSections) usedSectionIds.add('quellen');
  let activeSection: Section | null = null;
  let activeControl: 'takeaways' | 'skip' | null = null;

  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 2) {
      if (options.skipBodySourceSections && isKnowledgeSourceHeading(block.text)) {
        activeControl = 'skip';
        activeSection = null;
        continue;
      }

      if (/^auf einen blick$/i.test(knowledgeInlineMarkdownToText(block.text))) {
        activeControl = 'takeaways';
        activeSection = null;
        continue;
      }

      activeControl = null;
      activeSection = {
        id: allocateSectionId(knowledgeInlineMarkdownToText(block.text), usedSectionIds),
        title: block.text,
        blocks: [],
        controlType: controlTypeForHeading(block.text),
      };
      sections.push(activeSection);
      continue;
    }

    if (activeControl === 'skip') {
      continue;
    }

    if (activeControl === 'takeaways') {
      if (block.type === 'list') takeaways.push(...block.items);
      if (block.type === 'paragraph' && block.text.trim()) takeaways.push(block.text.trim());
      continue;
    }

    if (activeSection) {
      activeSection.blocks.push(block);
    } else {
      leadBlocks.push(block);
    }
  }

  return { leadBlocks, takeaways, sections };
}

function mergeStoredConclusion(sections: Section[], conclusion?: string | null): Section[] {
  const normalizedConclusion = conclusion?.trim();
  if (!normalizedConclusion) return sections;

  const conclusionBlocks = parseKnowledgeMarkdown(normalizedConclusion).filter((block, index) => (
    !(index === 0 && block.type === 'heading' && isConclusionHeading(block.text))
  ));
  const conclusionSection: Section = {
    id: 'fazit',
    title: 'Fazit',
    blocks: conclusionBlocks,
    controlType: null,
  };
  const mergedSections: Section[] = [];
  let conclusionInserted = false;

  for (const section of sections) {
    if (!isConclusionHeading(section.title)) {
      mergedSections.push(section);
      continue;
    }

    if (!conclusionInserted) {
      mergedSections.push(conclusionSection);
      conclusionInserted = true;
    }
  }

  if (!conclusionInserted) mergedSections.push(conclusionSection);
  return mergedSections;
}

function renderSourceLink(source: KnowledgeArticleSource, navigationState?: Props['navigationState']): ReactNode {
  const className = 'source-link';
  const normalizedUrl = normalizeKnowledgeSourceUrl(source.url);
  const label = source.label.trim();
  const internalArticles = knowledgeSourceInternalArticles(source);

  if (!normalizedUrl) {
    return <span className="source-label" data-invalid-source-url="true">{label}</span>;
  }

  if (normalizedUrl.kind === 'external' && internalArticles.length > 0) {
    return (
      <div className="source-link-group">
        <div
          className="source-internal-primary"
          data-internal-source-articles="true"
          data-projection-additive-navigation="true"
        >
          {internalArticles.length === 1 ? (
            <Link
              to={internalArticles[0].href}
              state={navigationState}
              className="source-primary-link"
              data-knowledge-leaf="internal-article-link"
            >
              <span className="source-primary-kicker">Studienartikel</span>
              <span>{label}</span>
            </Link>
          ) : (
            <>
              <span className="source-primary-label">{label}</span>
              <div className="source-primary-options">
                {internalArticles.map((article) => (
                  <Link
                    key={article.slug}
                    to={article.href}
                    state={navigationState}
                    className="source-internal-link"
                    data-knowledge-leaf="internal-article-link"
                  >
                    Studienartikel: {article.title}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
        <a
          href={normalizedUrl.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${className} source-original-link`}
          data-knowledge-leaf="source-link"
          aria-label={`Originalquelle öffnen: ${label}`}
        >
          <ExternalLink size={13} aria-hidden="true" />
          <span className="source-projection-label">{label}</span>
        </a>
      </div>
    );
  }

  const content = (
    <>
      <ExternalLink size={15} aria-hidden="true" />
      <span>{label}</span>
    </>
  );

  if (normalizedUrl.kind === 'internal') {
    return (
      <Link to={normalizedUrl.href} state={navigationState} className={className} data-knowledge-leaf="source-link">
        {content}
      </Link>
    );
  }

  return (
    <a href={normalizedUrl.href} target="_blank" rel="noopener noreferrer" className={className} data-knowledge-leaf="source-link">
      {content}
    </a>
  );
}

export function knowledgeSourceInternalArticles(source: KnowledgeArticleSource): Array<{
  slug: string;
  title: string;
  href: string;
}> {
  const seenSlugs = new Set<string>();
  return (source.internal_articles ?? []).flatMap((article) => {
    const slug = typeof article.slug === 'string' ? article.slug : '';
    const title = typeof article.title === 'string' ? article.title.trim() : '';
    const normalizedUrl = normalizeKnowledgeSourceUrl(article.url);
    if (
      !/^[a-z0-9-]+$/.test(slug)
      || !title
      || seenSlugs.has(slug)
      || normalizedUrl?.kind !== 'internal'
      || normalizedUrl.href !== `/wissen/${slug}`
    ) {
      return [];
    }
    seenSlugs.add(slug);
    return [{ slug, title, href: normalizedUrl.href }];
  });
}

export function KnowledgeSourceInternalArticleLinks({
  source,
  className = 'source-internal-links mt-2 flex flex-col gap-1 pl-6',
  navigationState,
}: {
  source: KnowledgeArticleSource;
  className?: string;
  navigationState?: Props['navigationState'];
}): ReactNode {
  const links = knowledgeSourceInternalArticles(source);
  if (links.length === 0) return null;

  return (
    <div
      className={className}
      data-internal-source-articles="true"
      data-projection-additive-navigation="true"
    >
      {links.map((article) => (
        <Link
          key={article.slug}
          to={article.href}
          state={navigationState}
          className="source-internal-link text-sm font-bold text-blue-700 hover:text-blue-900"
          data-knowledge-leaf="internal-article-link"
        >
          Einordnung lesen: {article.title}
        </Link>
      ))}
    </div>
  );
}

function renderTable(block: Extract<KnowledgeMarkdownBlock, { type: 'table' }>, key: string): ReactNode {
  return (
    <div key={key} className="tbl-wrap" data-knowledge-table-presentation="data_table">
      <table className="nice">
        <thead>
          <tr>
            {block.headers.map((header, index) => (
              <th key={`${header}-${index}`} scope="col" data-knowledge-leaf="table-cell">{renderKnowledgeInlineMarkdown(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {block.headers.map((_, cellIndex) => (
                <td key={cellIndex} className={cellIndex === 0 ? 'key' : undefined} data-knowledge-leaf="table-cell">
                  {renderKnowledgeInlineMarkdown(row[cellIndex] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="nice-mobile">
        {block.rows.map((row, rowIndex) => (
          <section key={rowIndex} className="nice-mobile-card">
            <h3>{renderKnowledgeInlineMarkdown(row[0] ?? `Eintrag ${rowIndex + 1}`)}</h3>
            {block.headers.slice(1).map((header, headerIndex) => (
              <p key={`${header}-${headerIndex}`}>
                <strong>{renderKnowledgeInlineMarkdown(header)}</strong>
                <span>{renderKnowledgeInlineMarkdown(row[headerIndex + 1] ?? '')}</span>
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function renderFoodGrid(block: Extract<KnowledgeMarkdownBlock, { type: 'table' }>, key: string): ReactNode {
  return (
    <div
      key={key}
      className="food-grid"
      role="table"
      aria-label="Lebensmittelübersicht"
      data-knowledge-table-presentation="food_grid"
    >
      <div role="row" className="sr-only" data-knowledge-table-header-row="true">
        {block.headers.map((header, headerIndex) => (
          <span key={`${header}-${headerIndex}`} role="columnheader" data-knowledge-column-index={headerIndex}>
            {renderKnowledgeInlineMarkdown(header)}
          </span>
        ))}
      </div>
      {block.rows.map((row, rowIndex) => (
        <section key={rowIndex} className="food-card" role="row" data-knowledge-table-row="true">
          <span className="ic pflz" aria-hidden="true">{String(rowIndex + 1).padStart(2, '0')}</span>
          {block.headers.map((header, cellIndex) => {
            const value = row[cellIndex] ?? '';
            const sharedProps = {
              role: 'cell',
              'data-knowledge-leaf': 'table-cell',
              'data-knowledge-column-index': cellIndex,
              'aria-label': `${header}: ${value}`,
            } as const;
            if (cellIndex === 0) {
              return <span key={cellIndex} className="food-card-label" {...sharedProps}>{renderKnowledgeInlineMarkdown(value)}</span>;
            }
            if (cellIndex === 1) {
              return <h4 key={cellIndex} {...sharedProps}>{renderKnowledgeInlineMarkdown(value)}</h4>;
            }
            return <p key={cellIndex} {...sharedProps}>{renderKnowledgeInlineMarkdown(value)}</p>;
          })}
        </section>
      ))}
    </div>
  );
}

function isFoodOverviewTable(block: Extract<KnowledgeMarkdownBlock, { type: 'table' }>): boolean {
  if (block.headers.length < 3) return false;
  const [groupHeader, exampleHeader] = block.headers.map((header) => header.trim().toLowerCase());
  return /(lebensmittel|nahrungs|quellen?)(gruppe|kategorie)?/.test(groupHeader)
    && /(beispiel|lebensmittel|vorkommen)/.test(exampleHeader);
}

function renderList(block: Extract<KnowledgeMarkdownBlock, { type: 'list' }>, key: string): ReactNode {
  const ListTag = block.ordered ? 'ol' : 'ul';
  return (
    <ListTag key={key}>
      {block.items.map((item, index) => (
        <li key={`${item}-${index}`} data-knowledge-leaf="list-item">{renderKnowledgeInlineMarkdown(item)}</li>
      ))}
    </ListTag>
  );
}

function figureClassForSection(sectionTitle: string): string {
  if (/wie der körper\b.*\b(nutzt|verarbeitet|aufnimmt|umwandelt)/i.test(sectionTitle)) return 'figure flow';
  if (/zu wenig|mangel/i.test(sectionTitle)) return 'figure timeline';
  if (/zu viel/i.test(sectionTitle)) return 'figure mini-grid';
  return 'figure';
}

function renderBlock(block: KnowledgeMarkdownBlock, key: string, sectionTitle: string): ReactNode {
  if (block.type === 'paragraph') {
    return <p key={key} data-knowledge-leaf="paragraph">{renderKnowledgeInlineMarkdown(block.text)}</p>;
  }

  if (block.type === 'heading' && block.level === 3) {
    return <h3 key={key} data-knowledge-leaf="subheading">{renderKnowledgeInlineMarkdown(block.text)}</h3>;
  }

  if (block.type === 'list') return renderList(block, key);
  if (block.type === 'table') {
    return isFoodOverviewTable(block) ? renderFoodGrid(block, key) : renderTable(block, key);
  }

  if (block.type === 'image') {
    return (
      <figure key={key} className={figureClassForSection(sectionTitle)} data-knowledge-leaf="figure">
        <img src={block.src} alt={knowledgeInlineMarkdownToText(block.alt)} loading="lazy" data-knowledge-leaf="image" />
        {block.caption && <figcaption data-knowledge-leaf="caption">{renderKnowledgeInlineMarkdown(block.caption)}</figcaption>}
      </figure>
    );
  }

  return null;
}

function collectFaqItems(blocks: KnowledgeMarkdownBlock[], sectionId: string): FaqItem[] {
  const items: FaqItem[] = [];
  const usedIds = new Set<string>();
  let active: FaqItem | null = null;

  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 3) {
      active = {
        id: allocateSectionId(`${sectionId}-frage-${knowledgeInlineMarkdownToText(block.text)}`, usedIds),
        question: block.text,
        answer: [],
      };
      items.push(active);
      continue;
    }

    active?.answer.push(block);
  }

  return items;
}

function FaqSection({ section, number, controlNamespace }: { section: Section; number: string; controlNamespace: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  const location = useLocation();
  const faqItems = useMemo(() => collectFaqItems(section.blocks, section.id), [section.blocks, section.id]);

  useEffect(() => {
    let cancelLayout: (() => void) | undefined;
    const openHashQuestion = (hash: string) => {
      const index = faqItems.findIndex((item) => item.id === decodeArticleHash(hash));
      if (index < 0) return;
      setOpenIndex(index);
      cancelLayout?.();
      cancelLayout = afterArticleLayout(() => {
        const question = document.getElementById(faqItems[index].id);
        question?.focus({ preventScroll: true });
        question?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
      });
    };
    openHashQuestion(location.hash);
    const onHashChange = () => openHashQuestion(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      cancelLayout?.();
    };
  }, [faqItems, location.hash]);

  const copyQuestionLink = async (id: string) => {
    const url = `${window.location.origin}${location.pathname}#${id}`;
    setCopyMessage('');
    setCopyFallback('');
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Link zur Frage kopiert.');
    } catch {
      setCopyFallback(url);
      setCopyMessage('Markiere den Link und kopiere ihn.');
    }
  };

  return (
    <section key={section.id} id={section.id} data-testid={`knowledge-magazine-section-${section.id}`}>
      <div className="sec-head"><span className="num">{number}</span><h2>{renderKnowledgeInlineMarkdown(section.title)}</h2></div>
      <div className="faq">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;
          const triggerId = item.id;
          const panelId = `${controlNamespace}:${section.id}:faq:${index}:panel`;

          return (
          <div key={`${item.question}-${index}`} className={`faq-item${isOpen ? ' is-open' : ''}`}>
            <h3 className="faq-heading"><button
              id={triggerId}
              type="button"
              className="faq-q"
              data-knowledge-leaf="faq-question"
              data-knowledge-disclosure="trigger"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => {
                setOpenIndex((current) => (current === index ? null : index));
                setCopyMessage('');
                setCopyFallback('');
              }}
            >
              <span>{renderKnowledgeInlineMarkdown(item.question)}</span>
              <span className="pm" aria-hidden="true"><Plus size={16} /></span>
            </button></h3>
            <div
              id={panelId}
              className="faq-a"
              data-knowledge-disclosure="panel"
              role="region"
              aria-labelledby={triggerId}
              hidden={!isOpen}
            >
              <div className="faq-a__in">
                {item.answer.map((block, blockIndex) => renderBlock(block, `${section.id}-faq-${index}-${blockIndex}`, section.title))}
                <div className="faq-link-action" data-projection-additive-navigation="true">
                  <button type="button" onClick={() => void copyQuestionLink(item.id)}>
                    <Copy size={15} aria-hidden="true" /> Link zur Frage kopieren
                  </button>
                  {isOpen && <span role="status">{copyMessage}</span>}
                  {isOpen && copyFallback && <input aria-label="Link zu dieser Frage" readOnly value={copyFallback} onFocus={(event) => event.currentTarget.select()} />}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}

function renderCompareSection(section: Section, number: string): ReactNode {
  const groups: Array<{ title: string; blocks: KnowledgeMarkdownBlock[] }> = [];
  let active: { title: string; blocks: KnowledgeMarkdownBlock[] } | null = null;

  for (const block of section.blocks) {
    if (block.type === 'heading' && block.level === 3) {
      active = { title: block.text, blocks: [] };
      groups.push(active);
      continue;
    }
    active?.blocks.push(block);
  }

  return (
    <section key={section.id} id={section.id} data-testid={`knowledge-magazine-section-${section.id}`}>
      <div className="sec-head"><span className="num">{number}</span><h2>{renderKnowledgeInlineMarkdown(section.title)}</h2></div>
      <div className="compare">
        {groups.map((group, index) => (
          <div key={`${group.title}-${index}`} className={`cmp ${index === 0 ? 'is-tier' : 'is-pflz'}`}>
            <h3>{renderKnowledgeInlineMarkdown(group.title)}</h3>
            {group.blocks.map((block, blockIndex) => renderBlock(block, `${section.id}-compare-${index}-${blockIndex}`, section.title))}
          </div>
        ))}
      </div>
    </section>
  );
}

function renderSection(section: Section, number: string, controlNamespace: string): ReactNode {
  const structuralTitle = knowledgeInlineMarkdownToText(section.title).trim();
  const sectionClassName = /^fazit$/i.test(structuralTitle) ? 'fazit' : undefined;
  if (/^häufige fragen$/i.test(structuralTitle)) return <FaqSection key={section.id} section={section} number={number} controlNamespace={controlNamespace} />;
  if (/^häufige verwechslungen$/i.test(structuralTitle)) return renderCompareSection(section, number);
  if (section.controlType) {
    return (
      <section
        key={section.id}
        id={section.id}
        className={`callout ${section.controlType === 'merkkasten' ? 'green' : 'legal'}`}
        data-testid={`knowledge-magazine-section-${section.id}`}
        data-knowledge-control-block={section.controlType}
      >
        <h2 className="callout-title" data-knowledge-leaf="control-heading">{renderKnowledgeInlineMarkdown(section.title)}</h2>
        <div className="callout-body">
          {section.blocks.map((block, blockIndex) => renderBlock(block, `${section.id}-${blockIndex}`, section.title))}
        </div>
      </section>
    );
  }

  return (
    <section key={section.id} id={section.id} className={sectionClassName} data-testid={`knowledge-magazine-section-${section.id}`}>
      <div className="sec-head"><span className="num">{number}</span><h2>{renderKnowledgeInlineMarkdown(section.title)}</h2></div>
      {section.blocks.map((block, blockIndex) => renderBlock(block, `${section.id}-${blockIndex}`, section.title))}
    </section>
  );
}

export function KnowledgeMagazineArticle({ article, reviewedDate, heroActions, editorialInfo, navigationState }: Props) {
  const [sourceListOpen, setSourceListOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 900px)').matches));
  const activeSectionIdRef = useRef('');
  const location = useLocation();
  const navigate = useNavigate();
  const articleDomId = useMemo(() => slugifyHeading(article.slug) || 'knowledge-article', [article.slug]);
  const controlNamespace = `knowledge-control:${articleDomId}`;
  const visibleSources = useMemo(() => deduplicateKnowledgeSources(article.sources.filter(isRenderableKnowledgeSource)), [article.sources]);
  const sourceAnchorIds = useMemo(() => {
    const usedIds = new Set<string>();
    return visibleSources.map((source) => allocateSectionId(`quelle-${source.source_id || source.label}`, usedIds));
  }, [visibleSources]);
  const { leadBlocks, takeaways, sections: bodySections } = useMemo(
    () => splitMagazineBody(article.body, { skipBodySourceSections: visibleSources.length > 0 }),
    [article.body, visibleSources.length],
  );
  const sections = useMemo(
    () => mergeStoredConclusion(bodySections, article.conclusion),
    [article.conclusion, bodySections],
  );
  const tocSections = useMemo(() => sections.filter((section) => !section.controlType && !isTemplateControlHeading(section.title)), [sections]);
  const tocLinks = useMemo<TocLink[]>(() => {
    const links: TocLink[] = [];

    if (takeaways.length > 0) {
      links.push({ id: 'ueberblick', title: 'Auf einen Blick' });
    }

    for (const section of tocSections) {
      links.push({ id: section.id, title: section.title });
    }

    if (visibleSources.length > 0) {
      links.push({ id: 'quellen', title: 'Quellen' });
    }

    return links;
  }, [visibleSources.length, takeaways.length, tocSections]);
  const ingredientNames = article.ingredients?.map((ingredient) => ingredient.name).filter(Boolean) ?? [];
  const readingMinutes = useMemo(
    () => calculateKnowledgeReadingMinutes(article.body, article.conclusion),
    [article.body, article.conclusion],
  );
  const ingredientChipLabel = `Wirkstoff: ${ingredientNames.join(', ') || 'Wissensartikel'}`;
  const takeawayContextLinks = useMemo(() => {
    const evidence = tocSections.find((section) => /forschung|studien|evidenz|datenlage/i.test(knowledgeInlineMarkdownToText(section.title)));
    const uncertainty = tocSections.find((section) => /nicht beantwortet|unbeantwortet|offene fragen|unsicher|grenzen|was (?:ist|bleibt) (?:noch )?offen/i.test(knowledgeInlineMarkdownToText(section.title)));
    return [evidence, uncertainty].filter((section, index, entries): section is Section => Boolean(section) && entries.indexOf(section) === index);
  }, [tocSections]);

  const visibleSectionIds = useMemo(() => tocLinks.map((link) => link.id), [tocLinks]);
  const sourceToggleId = `${controlNamespace}:sources:toggle`;
  const sourcePanelId = `${controlNamespace}:sources:panel`;
  const sourceDescriptionId = `${controlNamespace}:sources:description`;
  const tocToggleId = `${controlNamespace}:toc:toggle`;
  const tocPanelId = `${controlNamespace}:toc:panel`;
  const articleTopId = `${articleDomId}-anfang`;

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 900px)');
    if (!media) return;
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let cancelLayout: (() => void) | undefined;
    const openSourceHash = (hash: string) => {
      const target = decodeArticleHash(hash);
      if ((target === 'quellen' && visibleSources.length > 0) || sourceAnchorIds.includes(target)) {
        setSourceListOpen(true);
        cancelLayout?.();
        cancelLayout = afterArticleLayout(() => document.getElementById(target)?.scrollIntoView?.({ block: 'start', behavior: 'auto' }));
      }
    };
    openSourceHash(location.hash);
    const onHashChange = () => openSourceHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      cancelLayout?.();
    };
  }, [location.hash, visibleSources.length, sourceAnchorIds]);

  const followSectionLink = (id: string, event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate({ hash: `#${id}`, search: location.search }, { state: navigationState ?? location.state });
    setMobileTocOpen(false);
    if (id === 'quellen') setSourceListOpen(true);
    afterArticleLayout(() => {
      const section = document.getElementById(id);
      const focusTarget = id === 'quellen'
        ? document.getElementById(sourceToggleId)
        : section?.querySelector<HTMLElement>('h2') ?? section;
      if (focusTarget && focusTarget.tagName !== 'BUTTON') focusTarget.tabIndex = -1;
      focusTarget?.focus({ preventScroll: true });
      section?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    });
  };

  const goToTop = () => {
    setMobileTocOpen(false);
    document.getElementById(articleTopId)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  const setActiveSectionIdSafe = useCallback((nextSectionId: string) => {
    if (activeSectionIdRef.current === nextSectionId) return;
    activeSectionIdRef.current = nextSectionId;
    setActiveSectionId(nextSectionId);
  }, []);

  const sectionIsVisible = useCallback((id: string) => {
    const hasSection = visibleSectionIds.includes(id);
    return hasSection && document.getElementById(id);
  }, [visibleSectionIds]);

  const getHashSection = useCallback((): string => {
    const hash = location.hash || '';
    if (!hash) {
      return '';
    }

    try {
      const normalizedHash = decodeURIComponent(hash.slice(1));
      return sectionIsVisible(normalizedHash) ? normalizedHash : '';
    } catch {
      return '';
    }
  }, [sectionIsVisible, location.hash]);

  const resolveSectionFromScroll = useCallback(() => {
    if (visibleSectionIds.length === 0) return '';

    const sectionsInDom = visibleSectionIds
      .map((sectionId) => ({ sectionId, element: document.getElementById(sectionId) }))
      .filter((entry): entry is { sectionId: string; element: HTMLElement } => entry.element !== null);

    if (sectionsInDom.length === 0) return '';

    const measurableSections = sectionsInDom
      .map((section) => ({ ...section, bounds: section.element.getBoundingClientRect() }))
      .filter(({ bounds }) => (
        bounds.width !== 0
        || bounds.height !== 0
        || bounds.top !== 0
        || bounds.right !== 0
        || bounds.bottom !== 0
        || bounds.left !== 0
      ));

    if (measurableSections.length === 0) return '';

    const markerOffset = 140;
    let currentSectionId = measurableSections[0].sectionId;

    for (const section of measurableSections) {
      if (section.bounds.top <= markerOffset) {
        currentSectionId = section.sectionId;
      }
    }

    return currentSectionId;
  }, [visibleSectionIds]);

  const updateActiveSection = useCallback(() => {
    const nextActive = resolveSectionFromScroll();
    if (nextActive) {
      setActiveSectionIdSafe(nextActive);
      return;
    }

    const hashSection = getHashSection();
    if (hashSection) {
      setActiveSectionIdSafe(hashSection);
      return;
    }

    if (visibleSectionIds[0]) {
      setActiveSectionIdSafe(visibleSectionIds[0]);
    }
  }, [getHashSection, resolveSectionFromScroll, setActiveSectionIdSafe, visibleSectionIds]);

  const updateActiveFromHash = useCallback(() => {
    const hashSection = getHashSection();
    if (hashSection) {
      setActiveSectionIdSafe(hashSection);
      return;
    }

    if (!activeSectionIdRef.current) {
      updateActiveSection();
    }
  }, [getHashSection, setActiveSectionIdSafe, updateActiveSection]);

  useEffect(() => {
    let animationFrameId: number | null = null;
    const hasAnimationFrame = typeof window.requestAnimationFrame === 'function';

    const requestFrame = (callback: FrameRequestCallback): number => (
      hasAnimationFrame
        ? window.requestAnimationFrame(callback)
        : window.setTimeout(() => callback(performance.now()), 0)
    );
    const cancelFrame = (frameId: number) => {
      if (hasAnimationFrame && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frameId);
      } else {
        window.clearTimeout(frameId);
      }
    };

    const updateProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setReadingProgress(scrollable > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollable) * 100)) : 0);
    };

    const updateViewportState = () => {
      if (tocLinks.length > 0) updateActiveSection();
      updateProgress();
    };

    const scheduleViewportUpdate = () => {
      if (animationFrameId !== null) return;
      animationFrameId = requestFrame(() => {
        animationFrameId = null;
        updateViewportState();
      });
    };

    const initializeActiveSection = () => {
      if (tocLinks.length === 0) {
        activeSectionIdRef.current = '';
        setActiveSectionId('');
        return;
      }

      const hashSection = getHashSection();
      if (hashSection) {
        setActiveSectionIdSafe(hashSection);
        return;
      }

      if (!activeSectionIdRef.current && sectionIsVisible('ueberblick')) {
        setActiveSectionIdSafe('ueberblick');
        return;
      }

      setActiveSectionIdSafe(tocLinks[0].id);
    };

    const onHashChange = () => {
      updateActiveFromHash();
      scheduleViewportUpdate();
    };
    initializeActiveSection();
    scheduleViewportUpdate();

    window.addEventListener('scroll', scheduleViewportUpdate, { passive: true });
    window.addEventListener('resize', scheduleViewportUpdate);
    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('scroll', scheduleViewportUpdate);
      window.removeEventListener('resize', scheduleViewportUpdate);
      window.removeEventListener('hashchange', onHashChange);
      if (animationFrameId !== null) cancelFrame(animationFrameId);
    };
  }, [getHashSection, location.hash, sectionIsVisible, setActiveSectionIdSafe, tocLinks, updateActiveFromHash, updateActiveSection]);

  return (
    <>
    <div className="knowledge-magazine-progress-track" aria-hidden="true">
      <div className="progress-bar" style={{ width: `${readingProgress}%` }} />
    </div>

    <article
      data-testid="knowledge-magazine-article"
      data-template="magazine"
      data-ui-contract="knowledge-magazine-ui.v2"
      className="knowledge-magazine card"
    >
      <header data-testid="knowledge-magazine-hero" className="hero">
        <span className="eyebrow" data-knowledge-ui="eyebrow">Wissen</span>
        <h1 id={articleTopId} tabIndex={-1}>{renderKnowledgeInlineMarkdown(article.title)}</h1>
        <p className="dek" data-knowledge-ui="dek" data-knowledge-leaf="dek">{renderKnowledgeInlineMarkdown(article.summary)}</p>
        <div className="hero-meta">
          <span className="chip"><CheckCircle size={15} aria-hidden="true" /> <span data-knowledge-ui="ingredient-chip">{ingredientChipLabel}</span></span>
          {reviewedDate && <span className="meta-item"><CheckCircle size={16} aria-hidden="true" /> <span data-knowledge-ui="reviewed-date">Geprüft am {reviewedDate}</span></span>}
          <span className="meta-item"><Clock size={16} aria-hidden="true" /> <span data-knowledge-ui="reading-time">{knowledgeReadingTimeLabel(readingMinutes)}</span></span>
        </div>
        {editorialInfo}
        {heroActions}
      </header>

      <div className="layout">
        <aside className="toc knowledge-article-toc" aria-label="Inhaltsverzeichnis">
          <div className="toc__title" data-knowledge-ui="toc-title">Auf dieser Seite</div>
          <div className="toc-mobile-bar">
            <button id={tocToggleId} type="button" aria-expanded={mobileTocOpen} aria-controls={tocPanelId} onClick={() => setMobileTocOpen((open) => !open)}>
              Inhaltsübersicht <ChevronDown size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={goToTop}><ArrowUp size={16} aria-hidden="true" /> Nach oben</button>
          </div>
          <ol id={tocPanelId} aria-labelledby={tocToggleId} hidden={isMobile && !mobileTocOpen} data-knowledge-leaf="toc-list">
            {tocLinks.map((link) => {
              const isActive = link.id === activeSectionId;
              return (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    aria-label={knowledgeInlineMarkdownToText(link.title)}
                    aria-current={isActive ? 'true' : undefined}
                    className={isActive ? 'is-active' : undefined}
                    data-knowledge-leaf="toc-link"
                    onClick={(event) => followSectionLink(link.id, event)}
                  >
                    {renderKnowledgeInlineMarkdown(link.title)}
                  </a>
                </li>
              );
            })}
          </ol>
          <button type="button" className="toc-back-to-top" onClick={goToTop}><ArrowUp size={16} aria-hidden="true" /> Nach oben</button>
        </aside>

        <div className="content">
          {leadBlocks.length > 0 && (
            <section className="lead">
              {leadBlocks.map((block, index) => renderBlock(block, `lead-${index}`, 'Lead'))}
            </section>
          )}

          {takeaways.length > 0 && (
            <section id="ueberblick">
            <div className="takeaways">
              <h2><Lightbulb size={24} aria-hidden="true" /> Auf einen Blick</h2>
              <ul>
                {takeaways.map((item, index) => (
                  <li key={`${item}-${index}`} data-knowledge-leaf="list-item"><CheckCircle size={21} aria-hidden="true" /> <span>{renderKnowledgeInlineMarkdown(item)}</span></li>
                ))}
              </ul>
              {(takeawayContextLinks.length > 0 || visibleSources.length > 0) && (
                <div className="takeaway-context" data-projection-additive-navigation="true">
                  <span>Zum Einordnen der Kurzfassung:</span>
                  {takeawayContextLinks.map((section) => <a key={section.id} href={`#${section.id}`} onClick={(event) => followSectionLink(section.id, event)}>{knowledgeInlineMarkdownToText(section.title)}</a>)}
                  {visibleSources.length > 0 && <a href="#quellen" onClick={(event) => followSectionLink('quellen', event)}>Quellen ansehen</a>}
                </div>
              )}
            </div>
            </section>
          )}

          {sections.map((section) => {
            const sectionIndex = tocSections.findIndex((tocSection) => tocSection.id === section.id);
            const number = sectionIndex >= 0 ? String(sectionIndex + 1).padStart(2, '0') : '00';
            return renderSection(section, number, controlNamespace);
          })}

          {visibleSources.length > 0 && (
            <section id="quellen">
            <div className={`sources${sourceListOpen ? ' is-open' : ''}`}>
              <h2 className="sources-heading"><button
                id={sourceToggleId}
                type="button"
                className={`src-toggle${sourceListOpen ? ' is-open' : ''}`}
                data-knowledge-disclosure="trigger"
                aria-expanded={sourceListOpen}
                aria-controls={sourcePanelId}
                aria-describedby={sourceDescriptionId}
                onClick={() => setSourceListOpen((current) => !current)}
              >
                <span data-knowledge-ui="sources-label">Quellen</span>
                <span className="cnt"><span data-knowledge-ui="sources-count">{knowledgeSourceCountLabel(visibleSources.length)}</span> <ChevronDown className="chev" size={18} aria-hidden="true" /></span>
              </button></h2>
              <p id={sourceDescriptionId} className="sources-explanation" data-projection-additive-navigation="true">
                {visibleSources.every((source) => normalizeKnowledgeSourceUrl(source.url)?.kind === 'internal')
                  ? 'Die Quellen öffnen Studienartikel mit Ergebnissen, Grenzen und Links zu den Originalquellen.'
                  : 'Hier findest du die verwendeten Quellen. Verlinkte Studienartikel erklären ihre Ergebnisse und Grenzen.'}
              </p>
              <div
                id={sourcePanelId}
                className="src-list"
                data-knowledge-disclosure="panel"
                role="region"
                aria-labelledby={sourceToggleId}
                hidden={!sourceListOpen}
              >
                <div className="src-list__in">
                {visibleSources.map((source, index) => (
                  <div
                    key={sourceAnchorIds[index]}
                    id={sourceAnchorIds[index]}
                    data-source-id={source.source_id}
                  >
                    {renderSourceLink(source, navigationState)}
                  </div>
                ))}
                </div>
              </div>
            </div>
            </section>
          )}
        </div>
      </div>
    </article>
    </>
  );
}
