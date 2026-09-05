import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  knowledgeInlineMarkdownToText,
  normalizeKnowledgeInlineLink,
  tokenizeKnowledgeInlineMarkdown,
} from '../../../functions/lib/knowledge-inline-markdown.mjs';
import type { KnowledgeInlineMarkdownToken } from '../../../functions/lib/knowledge-inline-markdown.mjs';

export { knowledgeInlineMarkdownToText };

import { isKnowledgeSourceHeading, parseKnowledgeMarkdown } from '../../../functions/lib/knowledge-markdown-blocks.mjs';
import type { KnowledgeMarkdownBlock } from '../../../functions/lib/knowledge-markdown-blocks.mjs';

export { isKnowledgeSourceHeading, parseKnowledgeMarkdown };
export type { KnowledgeMarkdownBlock };

type Props = {
  markdown: string;
};

export function renderKnowledgeInlineMarkdown(text: string): ReactNode[] {
  const renderTokens = (tokens: KnowledgeInlineMarkdownToken[], keyPrefix: string): ReactNode[] => tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.type === 'text') return token.value;
    if (token.type === 'strong') return <strong key={key}>{renderTokens(token.children, key)}</strong>;
    if (token.type === 'emphasis') return <em key={key}>{renderTokens(token.children, key)}</em>;

    const normalizedLink = normalizeKnowledgeInlineLink(token.href);
    const label = renderTokens(token.children, key);
    const className = 'font-bold text-blue-700 underline-offset-4 hover:text-blue-900 hover:underline';

    if (normalizedLink?.kind === 'internal') {
      return (
        <Link key={key} to={normalizedLink.href} className={className} data-knowledge-leaf="link">
          {label}
        </Link>
      );
    }
    if (normalizedLink?.kind === 'external') {
      return (
        <a key={key} href={normalizedLink.href} target="_blank" rel="noopener noreferrer" className={className} data-knowledge-leaf="link">
          {label}
        </a>
      );
    }
    if (normalizedLink?.kind === 'hash') {
      return (
        <a key={key} href={normalizedLink.href} className={className} data-knowledge-leaf="link">
          {label}
        </a>
      );
    }
    return label;
  });

  return renderTokens(tokenizeKnowledgeInlineMarkdown(text), 'inline');
}

function renderHeading(block: Extract<KnowledgeMarkdownBlock, { type: 'heading' }>, index: number): ReactNode {
  if (block.level === 1) {
    return (
      <h1 key={index} className="mt-8 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
        {renderKnowledgeInlineMarkdown(block.text)}
      </h1>
    );
  }

  if (block.level === 2) {
    return (
      <h2 key={index} className="mt-8 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
        {renderKnowledgeInlineMarkdown(block.text)}
      </h2>
    );
  }

  return (
    <h3 key={index} className="mt-6 text-lg font-black tracking-tight text-slate-900">
      {renderKnowledgeInlineMarkdown(block.text)}
    </h3>
  );
}

export function renderKnowledgeMarkdownBlock(block: KnowledgeMarkdownBlock, index: number): ReactNode {
  if (block.type === 'heading') return renderHeading(block, index);

  if (block.type === 'paragraph') {
    return (
      <p key={index} className="whitespace-pre-line text-[15px] font-medium leading-7 text-slate-700">
        {renderKnowledgeInlineMarkdown(block.text)}
      </p>
    );
  }

  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag
        key={index}
        className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-6 text-[15px] font-medium leading-7 text-slate-700`}
      >
        {block.items.map((item, itemIndex) => (
          <li key={`${item}-${itemIndex}`}>{renderKnowledgeInlineMarkdown(item)}</li>
        ))}
      </ListTag>
    );
  }

  if (block.type === 'image') {
    return (
      <figure
        key={index}
        className="w-full max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:p-3"
      >
        <img src={block.src} alt={knowledgeInlineMarkdownToText(block.alt)} className="block h-auto w-full rounded-md object-contain" loading="lazy" />
        {block.caption && <figcaption className="mt-2 text-xs font-medium text-slate-500">{renderKnowledgeInlineMarkdown(block.caption)}</figcaption>}
      </figure>
    );
  }

  const sourceIndexes = block.headers
    .map((header, headerIndex) => (isKnowledgeSourceHeading(header) ? headerIndex : -1))
    .filter((headerIndex) => headerIndex >= 0);
  const visibleHeaders = block.headers
    .map((header, headerIndex) => ({ header, headerIndex }))
    .filter(({ headerIndex }) => !sourceIndexes.includes(headerIndex));
  const sourceValues = Array.from(
    new Set(
      block.rows
        .flatMap((row) => sourceIndexes.map((sourceIndex) => row[sourceIndex] ?? ''))
        .map((source) => source.trim())
        .filter(Boolean),
    ),
  );

  return (
    <div key={index} className="space-y-3" data-knowledge-table-presentation="data_table">
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
            <tr>
              {visibleHeaders.map(({ header, headerIndex }) => (
                <th key={`${header}-${headerIndex}`} scope="col" className="whitespace-nowrap px-4 py-3">
                  {renderKnowledgeInlineMarkdown(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {visibleHeaders.map(({ headerIndex }) => (
                  <td key={headerIndex} className="min-w-40 px-4 py-3 align-top font-medium leading-6">
                    {renderKnowledgeInlineMarkdown(row[headerIndex] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden" data-projection-duplicate="true">
        {block.rows.map((row, rowIndex) => {
          const titleCell = row[visibleHeaders[0]?.headerIndex ?? 0] ?? `Eintrag ${rowIndex + 1}`;
          const detailHeaders = visibleHeaders.slice(1);

          return (
            <section
              key={`${titleCell}-${rowIndex}`}
              data-testid="knowledge-table-mobile-card"
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h3 className="text-base font-black leading-6 text-slate-950">{renderKnowledgeInlineMarkdown(titleCell)}</h3>
              <dl className="mt-3 space-y-3">
                {detailHeaders.map(({ header, headerIndex }) => (
                  <div key={`${header}-${headerIndex}`} className="grid grid-cols-[7rem_1fr] gap-3 border-t border-slate-100 pt-3">
                    <dt className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                      {renderKnowledgeInlineMarkdown(header)}
                    </dt>
                    <dd className="text-sm font-semibold leading-6 text-slate-700">
                      {renderKnowledgeInlineMarkdown(row[headerIndex] ?? '')}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>

      {sourceValues.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Quellen zu dieser Tabelle</p>
          <ul className="mt-2 space-y-1 text-sm font-semibold leading-6 text-slate-700">
            {sourceValues.map((source) => (
              <li key={source}>{renderKnowledgeInlineMarkdown(source)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function KnowledgeMarkdownRenderer({ markdown }: Props) {
  const blocks = parseKnowledgeMarkdown(markdown);

  return (
    <div className="space-y-4">
      {blocks.map(renderKnowledgeMarkdownBlock)}
    </div>
  );
}
