import { type ReactNode, useEffect, useState } from 'react';

type LegalDocument = {
  slug: string;
  title: string;
  body_md: string;
  updated_at: string | null;
};

type Props = {
  slug: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
};

function markdownBlocks(markdown: string) {
  return markdown
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function renderBlock(block: string, index: number) {
  if (block.startsWith('### ')) {
    return <h3 key={index} className="mt-6 text-lg font-black text-slate-900">{block.slice(4).trim()}</h3>;
  }

  if (block.startsWith('## ')) {
    return <h2 key={index} className="mt-8 text-xl font-black text-slate-900">{block.slice(3).trim()}</h2>;
  }

  if (block.startsWith('# ')) {
    return <h2 key={index} className="mt-8 text-xl font-black text-slate-900">{block.slice(2).trim()}</h2>;
  }

  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((line) => line.startsWith('- '))) {
    return (
      <ul key={index} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
        {lines.map((line, lineIndex) => <li key={lineIndex}>{line.slice(2).trim()}</li>)}
      </ul>
    );
  }

  return (
    <p key={index} className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
      {block}
    </p>
  );
}

export default function LegalDocumentPage({ slug, eyebrow, title, children }: Props) {
  const [document, setDocument] = useState<LegalDocument | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      try {
        const response = await fetch(`/api/legal-documents/${encodeURIComponent(slug)}`, {
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = (await response.json()) as { document?: LegalDocument };
        if (!cancelled && data.document?.body_md?.trim()) {
          setDocument(data.document);
        }
      } catch {
        // Static legal fallback remains the source when the dynamic copy is unavailable.
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!document) {
    return <>{children}</>;
  }

  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-600">{eyebrow}</p>
      <h1 className="mb-6 text-3xl font-black text-slate-900">{document.title || title}</h1>
      <section className="space-y-3">
        {markdownBlocks(document.body_md).map(renderBlock)}
      </section>
    </article>
  );
}
