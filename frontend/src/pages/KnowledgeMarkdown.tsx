import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type HeadingLevel = 1 | 2 | 3;

export type KnowledgeMarkdownBlock =
  | { type: 'heading'; level: HeadingLevel; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; alt: string; src: string; caption: string | null };

type Props = {
  markdown: string;
};

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\\n/g, '\n').replace(/\r\n?/g, '\n');
}

function headingForLine(line: string): { level: HeadingLevel; text: string } | null {
  const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
  if (!match) return null;
  return {
    level: match[1].length as HeadingLevel,
    text: match[2].trim(),
  };
}

function unorderedListItem(line: string): string | null {
  const match = /^[-*]\s+(.+)$/.exec(line.trim());
  return match ? match[1].trim() : null;
}

function orderedListItem(line: string): string | null {
  const match = /^\d+\.\s+(.+)$/.exec(line.trim());
  return match ? match[1].trim() : null;
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = withoutOuterPipes.split('|').map((cell) => cell.trim());
  return cells.length > 1 ? cells : null;
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line);
  return Boolean(cells?.length && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function parseImageLine(line: string): { alt: string; src: string } | null {
  const trimmed = line.trim();
  const match = /^!\[([^\]\n]*)\]\(([^)]*)\)\s*$/.exec(trimmed);
  if (!match) return null;

  const alt = match[1].trim();
  const src = match[2].trim();
  return { alt, src };
}

function parseItalicCaption(line: string): string | null {
  const match = line.trim().match(/^(?:\*([^*\n]+)\*|_([^_\n]+)_)$/);
  const caption = (match?.[1] ?? match?.[2] ?? '').trim();
  return caption || null;
}

function isAllowedImageSrc(src: string): boolean {
  return /^(https?:\/\/|\/\/|\/|data:image\/)/i.test(src);
}

export function isKnowledgeSourceHeading(header: string): boolean {
  return /^(quellen?|sources?)$/i.test(header.trim());
}

function startsTable(lines: string[], index: number): boolean {
  return Boolean(parseTableRow(lines[index]) && lines[index + 1] && isTableSeparator(lines[index + 1]));
}

function startsNewBlock(lines: string[], index: number): boolean {
  const line = lines[index];
  return Boolean(
    !line.trim()
    || headingForLine(line)
    || parseImageLine(line)
    || unorderedListItem(line)
    || orderedListItem(line)
    || startsTable(lines, index),
  );
}

export function parseKnowledgeMarkdown(markdown: string): KnowledgeMarkdownBlock[] {
  const lines = normalizeMarkdown(markdown).split('\n');
  const blocks: KnowledgeMarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = headingForLine(line);
    if (heading) {
      blocks.push({ type: 'heading', ...heading });
      index += 1;
      continue;
    }

    if (startsTable(lines, index)) {
      const headers = parseTableRow(lines[index]) ?? [];
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const cells = parseTableRow(lines[index]);
        if (!cells || isTableSeparator(lines[index])) break;
        rows.push(cells);
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const unorderedItem = unorderedListItem(line);
    if (unorderedItem) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = unorderedListItem(lines[index]);
        if (!item) break;
        items.push(item);
        index += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    const orderedItem = orderedListItem(line);
    if (orderedItem) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = orderedListItem(lines[index]);
        if (!item) break;
        items.push(item);
        index += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    const image = parseImageLine(line);
    if (image) {
      if (!isAllowedImageSrc(image.src)) {
        blocks.push({ type: 'paragraph', text: line.trim() });
        index += 1;
        continue;
      }

      let nextNonEmptyIndex = index + 1;
      while (nextNonEmptyIndex < lines.length && !lines[nextNonEmptyIndex].trim()) {
        nextNonEmptyIndex += 1;
      }
      const caption = nextNonEmptyIndex < lines.length
        ? parseItalicCaption(lines[nextNonEmptyIndex])
        : null;
      blocks.push({ type: 'image', ...image, caption });
      index = caption ? nextNonEmptyIndex + 1 : index + 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && !startsNewBlock(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
  }

  return blocks;
}

function isInternalKnowledgeLink(href: string): boolean {
  return href.startsWith('/wissen/');
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith('//');
}

export function renderKnowledgeInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const linkPattern = /\[([^\]\n]+)]\(([^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const label = match[1];
    const href = match[2];
    const key = `${href}-${match.index}`;
    const className = 'font-bold text-blue-700 underline-offset-4 hover:text-blue-900 hover:underline';

    if (isInternalKnowledgeLink(href)) {
      nodes.push(
        <Link key={key} to={href} className={className} data-knowledge-leaf="link">
          {label}
        </Link>,
      );
    } else if (isExternalLink(href)) {
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={className} data-knowledge-leaf="link">
          {label}
        </a>,
      );
    } else {
      nodes.push(
        <a key={key} href={href} className={className} data-knowledge-leaf="link">
          {label}
        </a>,
      );
    }

    lastIndex = linkPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : [text];
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
        <img src={block.src} alt={block.alt} className="block h-auto w-full rounded-md object-contain" loading="lazy" />
        {block.caption && <figcaption className="mt-2 text-xs font-medium text-slate-500">{block.caption}</figcaption>}
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
