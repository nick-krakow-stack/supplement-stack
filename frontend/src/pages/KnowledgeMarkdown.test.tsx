// @vitest-environment jsdom
import {
  act,
  fireEvent,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KnowledgeArticlePage, { knowledgeSeoTimestamps } from "./KnowledgeArticlePage";
import {
  KnowledgeMagazineArticle,
  normalizeKnowledgeSourceUrl,
} from "./KnowledgeMagazineArticle";
import {
  KnowledgeMarkdownRenderer,
  knowledgeInlineMarkdownToText,
  parseKnowledgeMarkdown,
} from "./KnowledgeMarkdown";
const markdown = [
  "# Vitamin A",
  "",
  "![Vitamin A Struktur](https://example.com/va-structure.png)",
  "*Schematische Darstellung der Vitamin-A-Struktur.*",
  "",
  "Ein kurzer Einstieg mit [internem Link](/wissen/retinol) und [externer Quelle](https://example.com/source).",
  "",
  "## Mengen und Sicherheit",
  "",
  "- Retinol wird direkt genutzt.",
  "- Beta-Carotin muss umgewandelt werden.",
  "",
  "1. Quellen prüfen",
  "2. Einordnung lesen",
  "",
  "| Bereich | Einordnung |",
  "| --- | --- |",
  "| Sicherheit | [Details](/wissen/vitamin-a-sicherheit) |",
].join("\n");

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function knowledgeResponse(article: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ article }),
  };
}

function BrowserBackControl() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Browser-Zurück simulieren</button>;
}

describe("KnowledgeMarkdown", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    delete window.__knowledgeArticleBootstrap;
    vi.unstubAllGlobals();
  });
  it("uses the server-provided article immediately without a duplicate request", () => {
    const bootstrapArticle = {
      slug: "vitamin-a",
      title: "Vitamin A sofort sichtbar",
      summary: "Zusammenfassung",
      body: "Direkt bereitgestellter Artikeltext",
      sources: [],
    };
    window.__knowledgeArticleBootstrap = { article: bootstrapArticle };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Vitamin A sofort sichtbar" })).toBeTruthy();
    expect(screen.queryByText("Artikel wird geladen …")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("selects the public template only from article_layer", () => {
    const mainArticle = {
      slug: "hauptartikel-ohne-marker",
      title: "Hauptartikel ohne Marker",
      summary: "Die Datenebene entscheidet.",
      article_layer: "main_article" as const,
      body: [
        "## Auf einen Blick",
        "",
        "- Erster Punkt",
        "- Zweiter Punkt",
        "- Dritter Punkt",
        "",
        "## Fazit",
        "",
        "Der Hauptartikel bleibt im Magazinlayout.",
      ].join("\n"),
      sources: [],
    };
    window.__knowledgeArticleBootstrap = { article: mainArticle };
    const { unmount } = render(
      <MemoryRouter initialEntries={["/wissen/hauptartikel-ohne-marker"]}>
        <Routes><Route path="/wissen/:slug" element={<KnowledgeArticlePage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("knowledge-magazine-article")).toBeTruthy();
    expect(screen.queryByTestId("knowledge-study-article")).toBeNull();
    unmount();

    const studyArticle = {
      slug: "studie-mit-marker",
      title: "Studie mit versehentlichem Marker",
      summary: "Die Studienebene bleibt maßgeblich.",
      article_layer: "single_study" as const,
      body: [
        "<!-- knowledge-template:magazine -->",
        "",
        "## Einordnung",
        "",
        "Der Marker darf das Layout nicht wechseln.",
        "",
        "## Fazit",
        "",
        "Die Studienansicht bleibt aktiv.",
      ].join("\n"),
      sources: [],
    };
    window.__knowledgeArticleBootstrap = { article: studyArticle };
    render(
      <MemoryRouter initialEntries={["/wissen/studie-mit-marker"]}>
        <Routes><Route path="/wissen/:slug" element={<KnowledgeArticlePage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("knowledge-study-article")).toBeTruthy();
    expect(screen.queryByTestId("knowledge-magazine-article")).toBeNull();
    expect(screen.queryByText("<!-- knowledge-template:magazine -->")).toBeNull();
  });
  it("resets a newly pushed article to the top without overriding hash or POP navigation", async () => {
    const scrollToMock = vi.fn();
    vi.stubGlobal("scrollTo", scrollToMock);
    window.__knowledgeArticleBootstrap = {
      article: {
        slug: "scroll-test",
        title: "Scroll-Test",
        summary: "Scroll-Verhalten",
        article_layer: "single_study",
        body: "## Einordnung\n\nText.\n\n## Fazit\n\nFazit.",
        sources: [],
      },
    };

    render(
      <MemoryRouter initialEntries={["/wissen"]}>
        <BrowserBackControl />
        <Link to="/wissen/scroll-test#fazit">Hash im selben Artikel</Link>
        <Routes>
          <Route path="/wissen" element={<Link to="/wissen/scroll-test">Artikel öffnen</Link>} />
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Artikel öffnen" }));
    await screen.findByRole("heading", { level: 1, name: "Scroll-Test" });
    expect(scrollToMock).toHaveBeenCalledTimes(1);
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });

    fireEvent.click(screen.getByRole("link", { name: "Hash im selben Artikel" }));
    expect(scrollToMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Browser-Zurück simulieren" }));
    expect(scrollToMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Browser-Zurück simulieren" }));
    await screen.findByRole("link", { name: "Artikel öffnen" });
    expect(scrollToMock).toHaveBeenCalledTimes(1);
  });
  it("parses headings, paragraphs, lists, and simple tables", () => {
    const blocks = parseKnowledgeMarkdown(markdown);
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "image",
      "paragraph",
      "heading",
      "list",
      "list",
      "table",
    ]);
    expect(blocks[0]).toMatchObject({ level: 1, text: "Vitamin A" });
    expect(blocks[1]).toMatchObject({
      type: "image",
      alt: "Vitamin A Struktur",
      src: "https://example.com/va-structure.png",
      caption: "Schematische Darstellung der Vitamin-A-Struktur.",
    });
    expect(blocks[2]).toMatchObject({
      text: "Ein kurzer Einstieg mit [internem Link](/wissen/retinol) und [externer Quelle](https://example.com/source).",
    });
    expect(blocks[4]).toMatchObject({
      ordered: false,
      items: [
        "Retinol wird direkt genutzt.",
        "Beta-Carotin muss umgewandelt werden.",
      ],
    });
    expect(blocks[5]).toMatchObject({
      ordered: true,
      items: ["Quellen prüfen", "Einordnung lesen"],
    });
    expect(blocks[6]).toMatchObject({
      headers: ["Bereich", "Einordnung"],
      rows: [["Sicherheit", "[Details](/wissen/vitamin-a-sicherheit)"]],
    });
  });
  it("renders supported inline emphasis safely and keeps unsupported syntax literal", () => {
    const { container } = render(
      <MemoryRouter>
        <KnowledgeMarkdownRenderer markdown={[
          "# **Starker Titel**",
          "",
          "## **Struktur**",
          "",
          "Ein **wichtiger Absatz** mit **[internem Link](/wissen/intern)**, [**externer Quelle**](https://example.com/source) und [Sprungziel](#fazit).",
          "",
          "- **Wichtiger Listenpunkt**",
          "",
          "| **Kopf** | Wert |",
          "| --- | --- |",
          "| Zelle | **Einordnung** |",
          "",
          "Nicht geschlossen: **bleibt literal.",
          "Triple bleibt literal: ***nicht unterstützt***.",
          "Code bleibt literal: `**kein Fett**`.",
          "Maskiert: [\\*literal\\*](/wissen/literal).",
          "Unsicher: [nicht anklicken](javascript:alert(1)), [auch nicht](data:text/html,hi), [protokollrelativ](//example.com) und [mit Zugangsdaten](https://user:pass@example.com).",
        ].join("\n")} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Starker Titel" }).querySelector("strong")?.textContent).toBe("Starker Titel");
    expect(screen.getByRole("heading", { level: 2, name: "Struktur" }).querySelector("strong")?.textContent).toBe("Struktur");
    expect(screen.getByRole("link", { name: "internem Link" }).getAttribute("href")).toBe("/wissen/intern");
    expect(screen.getByRole("link", { name: "externer Quelle" }).getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: "Sprungziel" }).getAttribute("href")).toBe("#fazit");
    expect(screen.getByRole("link", { name: "*literal*" }).getAttribute("href")).toBe("/wissen/literal");
    expect(screen.queryByRole("link", { name: "nicht anklicken" })).toBeNull();
    expect(screen.queryByRole("link", { name: "auch nicht" })).toBeNull();
    expect(screen.queryByRole("link", { name: "protokollrelativ" })).toBeNull();
    expect(screen.queryByRole("link", { name: "mit Zugangsdaten" })).toBeNull();
    expect(container.querySelectorAll("strong").length).toBeGreaterThanOrEqual(7);
    expect(container.textContent).not.toContain("**wichtiger Absatz**");
    expect(container.textContent).toContain("Nicht geschlossen: **bleibt literal.");
    expect(container.textContent).toContain("Triple bleibt literal: ***nicht unterstützt***.");
    expect(container.textContent).toContain("Code bleibt literal: `**kein Fett**`.");
    expect(knowledgeInlineMarkdownToText("Vor **Fett** und *kursiv* mit [**Link**](/wissen/test).")).toBe("Vor Fett und kursiv mit Link.");
  });
  it("uses marker-free heading text for every magazine structural decision and TOC label", () => {
    render(
      <MemoryRouter>
        <KnowledgeMagazineArticle
          reviewedDate={null}
          article={{
            slug: "formatierte-struktur",
            title: "**Formatierter Hauptartikel**",
            summary: "Eine **klare Einordnung**.",
            article_layer: "main_article",
            body: [
              "<!-- knowledge-template:magazine -->",
              "",
              "## **Auf einen Blick**",
              "",
              "- **Erster Punkt**",
              "- Zweiter Punkt",
              "- Dritter Punkt",
              "",
              "## **Häufige Fragen**",
              "",
              "### **Was ist wichtig?**",
              "",
              "Eine **klare Antwort**.",
              "",
              "## **Häufige Verwechslungen**",
              "",
              "### **Begriff A**",
              "",
              "Eine Einordnung.",
              "",
              "## **Merkkasten**",
              "",
              "Ein Merksatz.",
              "",
              "## **Rechtlicher Hinweis**",
              "",
              "Ein Hinweis.",
              "",
              "## **Fazit**",
              "",
              "Ein **klares Fazit**.",
              "",
              "## **Quellen**",
              "",
              "Dieser Body-Quellenblock wird durch die gebundene Quelle ersetzt.",
            ].join("\n"),
            sources: [{ source_id: "source-1", label: "Institution (2026). Quelle.", url: "https://example.com/source" }],
          }}
        />
      </MemoryRouter>,
    );

    const article = screen.getByTestId("knowledge-magazine-article");
    expect(article.textContent).not.toContain("**");
    expect(screen.getByRole("button", { name: "Was ist wichtig?" })).toBeTruthy();
    expect(screen.getByTestId("knowledge-magazine-section-haufige-verwechslungen").querySelector(".compare")).toBeTruthy();
    expect(screen.getByTestId("knowledge-magazine-section-merkkasten").getAttribute("data-knowledge-control-block")).toBe("merkkasten");
    expect(screen.getByTestId("knowledge-magazine-section-rechtlicher-hinweis").getAttribute("data-knowledge-control-block")).toBe("legal_notice");
    expect(screen.getByTestId("knowledge-magazine-section-fazit").classList.contains("fazit")).toBe(true);
    const toc = screen.getByLabelText("Inhaltsverzeichnis");
    expect(within(toc).getByRole("link", { name: "Häufige Fragen" }).getAttribute("href")).toBe("#haufige-fragen");
    expect(within(toc).queryByRole("link", { name: "Merkkasten" })).toBeNull();
    expect(within(toc).queryByRole("link", { name: "Rechtlicher Hinweis" })).toBeNull();
  });
  it("renders internal links without a blank target and external links with a blank target", () => {
    render(
      <MemoryRouter>
        {" "}
        <KnowledgeMarkdownRenderer markdown={markdown} />{" "}
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Vitamin A" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Mengen und Sicherheit" }),
    ).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    const internalLink = screen.getByRole("link", { name: "internem Link" });
    expect(internalLink?.getAttribute("href")).toBe("/wissen/retinol");
    expect(internalLink?.getAttribute("target")).toBeNull();
    const tableInternalLink = screen.getAllByRole("link", {
      name: "Details",
    })[0];
    expect(tableInternalLink?.getAttribute("href")).toBe(
      "/wissen/vitamin-a-sicherheit",
    );
    expect(tableInternalLink?.getAttribute("target")).toBeNull();
    const externalLink = screen.getByRole("link", { name: "externer Quelle" });
    expect(externalLink?.getAttribute("href")).toBe(
      "https://example.com/source",
    );
    expect(externalLink?.getAttribute("target")).toBe("_blank");
  });
  it("normalizes only safe internal knowledge and absolute HTTP source URLs", () => {
    expect(normalizeKnowledgeSourceUrl("/wissen/vitamin-a?ansicht=kurz#quellen")).toEqual({
      kind: "internal",
      href: "/wissen/vitamin-a?ansicht=kurz#quellen",
    });
    expect(normalizeKnowledgeSourceUrl("https://example.com/source")).toEqual({
      kind: "external",
      href: "https://example.com/source",
    });
    expect(normalizeKnowledgeSourceUrl("http://legacy.example.org/source")).toEqual({
      kind: "external",
      href: "http://legacy.example.org/source",
    });

    for (const blockedUrl of [
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "//example.com/source",
      " /wissen/vitamin-a",
      "https://example.com/source ",
      "https://example.com/\nsource",
      "\u00a0https://example.com/source",
      "java\u200bscript:alert(1)",
      "https://user:password@example.com/source",
      "https:example.com/source",
      "/wissen/../administrator",
      "/anderer-interner-pfad",
      "nicht einmal eine URL",
    ]) {
      expect(normalizeKnowledgeSourceUrl(blockedUrl), blockedUrl).toBeNull();
    }
  });
  it("renders internal article source links through router navigation and external sources in a new tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            article: {
              slug: "vitamin-a",
              title: "Vitamin A",
              summary: "Zusammenfassung",
              body: "Artikeltext",
              sources: [
                {
                  label: "Interne Einzelstudie",
                  url: "/wissen/vitamin-a-studie",
                },
                {
                  label: "Externe Quelle",
                  url: "https://example.com/source",
                  internal_articles: [
                    {
                      slug: "externe-quelle-eingeordnet",
                      title: "Externe Quelle eingeordnet",
                      url: "/wissen/externe-quelle-eingeordnet",
                    },
                  ],
                },
                { label: "Legacy-HTTP-Quelle", url: "http://legacy.example.org/source" },
                { label: "JavaScript-Quelle", url: "javascript:alert(1)" },
                { label: "Data-Quelle", url: "data:text/html,unsafe" },
                { label: "Protokoll-relative Quelle", url: "//example.com/source" },
                { label: "Whitespace-Quelle", url: " https://example.com/source" },
                { label: "Ungültige Quelle", url: "keine url" },
              ],
            },
          }),
      }),
    );
    render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );
    const internalSource = (
      await screen.findByText("Interne Einzelstudie")
    ).closest("a");
    expect(internalSource?.getAttribute("href")).toBe(
      "/wissen/vitamin-a-studie",
    );
    expect(internalSource?.getAttribute("target")).toBeNull();
    expect(internalSource?.getAttribute("rel")).toBeNull();
    const externalSource = screen.getByText("Externe Quelle").closest("a");
    expect(externalSource?.getAttribute("href")).toBe(
      "https://example.com/source",
    );
    expect(externalSource?.getAttribute("target")).toBe("_blank");
    expect(externalSource?.getAttribute("rel")).toBe("noopener noreferrer");
    const sourceInterpretation = screen.getByText("Einordnung lesen: Externe Quelle eingeordnet").closest("a");
    expect(sourceInterpretation?.getAttribute("href")).toBe("/wissen/externe-quelle-eingeordnet");
    expect(sourceInterpretation?.getAttribute("target")).toBeNull();
    const legacySource = screen.getByText("Legacy-HTTP-Quelle").closest("a");
    expect(legacySource?.getAttribute("href")).toBe("http://legacy.example.org/source");
    expect(legacySource?.getAttribute("target")).toBe("_blank");

    for (const label of [
      "JavaScript-Quelle",
      "Data-Quelle",
      "Protokoll-relative Quelle",
      "Whitespace-Quelle",
      "Ungültige Quelle",
    ]) {
      const sourceLabel = screen.getByText(label);
      expect(sourceLabel.closest("a"), label).toBeNull();
      expect(sourceLabel.getAttribute("data-invalid-source-url")).toBe("true");
    }
  });
  it("renders markdown image blocks as responsive figures with caption", () => {
    render(
      <MemoryRouter>
        {" "}
        <KnowledgeMarkdownRenderer markdown={markdown} />{" "}
      </MemoryRouter>,
    );
    const image = screen.getAllByRole("img", { name: "Vitamin A Struktur" })[0];
    expect(image.getAttribute("src")).toBe(
      "https://example.com/va-structure.png",
    );
    expect(image.getAttribute("alt")).toBe("Vitamin A Struktur");
    expect(screen.getByText("Schematische Darstellung der Vitamin-A-Struktur.")).toBeTruthy();
    expect(image.closest("figure")?.querySelector("figcaption")?.textContent).not.toBe("Vitamin A Struktur");
    expect(image.closest("figure")).toBeTruthy();
  });
  it("renders internal markdown images", () => {
    const internalImageMarkdown =
      "![Produktetikett](/assets/vitamin-a-label.webp)";
    render(
      <MemoryRouter>
        {" "}
        <KnowledgeMarkdownRenderer markdown={internalImageMarkdown} />{" "}
      </MemoryRouter>,
    );
    const image = screen.getByRole("img", { name: "Produktetikett" });
    expect(image.getAttribute("src")).toBe("/assets/vitamin-a-label.webp");
  });
  it("renders mobile-friendly table cards for each data row", () => {
    render(
      <MemoryRouter>
        {" "}
        <KnowledgeMarkdownRenderer
          markdown={[
            "| Form | Beschreibung | Wichtig für |",
            "| --- | --- | --- |",
            "| Retinol | zentrale Alkoholform von Vitamin A | Transport im Blut |",
            "| Retinylester | Speicherform | Leberbezug |",
          ].join("\n")}
        />{" "}
      </MemoryRouter>,
    );
    const cards = screen.getAllByTestId("knowledge-table-mobile-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("Retinol");
    expect(cards[0].textContent).toContain("Beschreibung");
    expect(cards[0].textContent).toContain(
      "zentrale Alkoholform von Vitamin A",
    );
    expect(cards[0].textContent).toContain("Wichtig für");
    expect(cards[0].textContent).toContain("Transport im Blut");
  });
  it("uses a wide article layout instead of the narrow article column", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              article: {
                slug: "vitamin-a",
                title: "Vitamin A",
                summary: "Zusammenfassung",
                body: "Artikeltext",
                sources: [],
              },
            }),
        }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Vitamin A" });
    const main = container.querySelector("main");
    expect(main?.className).toContain("max-w-6xl");
    expect(main?.className).not.toContain("max-w-3xl");
  });
  it("hides the previous article synchronously while the next route is loading", async () => {
    const zinkResponse = createDeferred<ReturnType<typeof knowledgeResponse>>();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).endsWith("/zink")) return zinkResponse.promise;
        return Promise.resolve(knowledgeResponse({
          slug: "quercetin",
          title: "Quercetin sichtbar",
          summary: "Quercetin-Zusammenfassung",
          body: "Quercetin-Inhalt",
          sources: [],
        }));
      }),
    );

    render(
      <MemoryRouter initialEntries={["/wissen/quercetin"]}>
        <Link to="/wissen/zink">Zum langsamen Zinkartikel</Link>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 1, name: "Quercetin sichtbar" });
    expect(document.title).toBe("Quercetin sichtbar");

    fireEvent.click(screen.getByRole("link", { name: "Zum langsamen Zinkartikel" }));
    expect(screen.queryByRole("heading", { level: 1, name: "Quercetin sichtbar" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Artikel wird geladen …");
    expect(document.title).not.toBe("Quercetin sichtbar");

    await act(async () => {
      zinkResponse.resolve(knowledgeResponse({
        slug: "zink",
        title: "Zink sichtbar",
        summary: "Zink-Zusammenfassung",
        body: "Zink-Inhalt",
        sources: [],
      }));
      await zinkResponse.promise;
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Zink sichtbar" })).toBeTruthy();
  });
  it("ignores a stale response that resolves after a newer route response", async () => {
    const quercetinResponse = createDeferred<ReturnType<typeof knowledgeResponse>>();
    const zinkResponse = createDeferred<ReturnType<typeof knowledgeResponse>>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith("/zink") ? zinkResponse.promise : quercetinResponse.promise
    ));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/wissen/quercetin"]}>
        <Link to="/wissen/zink">Direkt zu Zink</Link>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("link", { name: "Direkt zu Zink" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      zinkResponse.resolve(knowledgeResponse({
        slug: "zink",
        title: "Zink gewinnt das Rennen",
        summary: "Aktuelle Antwort",
        body: "Aktueller Inhalt",
        sources: [],
      }));
      await zinkResponse.promise;
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Zink gewinnt das Rennen" })).toBeTruthy();

    await act(async () => {
      quercetinResponse.resolve(knowledgeResponse({
        slug: "quercetin",
        title: "Verspätetes Quercetin",
        summary: "Veraltete Antwort",
        body: "Veralteter Inhalt",
        sources: [],
      }));
      await quercetinResponse.promise;
    });
    expect(screen.queryByRole("heading", { level: 1, name: "Verspätetes Quercetin" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Zink gewinnt das Rennen" })).toBeTruthy();
    expect(document.title).toBe("Zink gewinnt das Rennen");
  });
  it("rejects an article whose response slug does not match the requested route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(knowledgeResponse({
        slug: "zink",
        title: "Falscher Zinkartikel",
        summary: "Diese Antwort gehört nicht zur Route.",
        body: "Falscher Inhalt",
        sources: [],
      })),
    );

    render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Artikel gerade nicht erreichbar" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1, name: "Falscher Zinkartikel" })).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('script[data-knowledge-article-json-ld="true"]')).toBeNull();
  });
  it("derives create/update SEO timestamps from persisted article times and never emits Modified before Published", () => {
    const article = (timestamps: { reviewed_at?: string; created_at?: string; updated_at?: string }) => ({
      slug: "zeitvertrag",
      title: "Zeitvertrag",
      summary: "Zeitvertrag für den öffentlichen Artikel.",
      body: "Inhalt",
      sources: [],
      ...timestamps,
    });

    expect(knowledgeSeoTimestamps(article({
      reviewed_at: "2026-07-14T10:00:00.000Z",
      created_at: "2026-07-14T10:00:00.000Z",
      updated_at: "2026-07-14T10:00:00.000Z",
    }))).toEqual({
      publishedAt: "2026-07-14T10:00:00.000Z",
      modifiedAt: "2026-07-14T10:00:00.000Z",
    });
    expect(knowledgeSeoTimestamps(article({
      reviewed_at: "2026-07-14T10:00:00.000Z",
      created_at: "2025-01-02 08:30:00",
      updated_at: "2026-07-13T18:00:00.000Z",
    }))).toEqual({
      publishedAt: "2025-01-02T08:30:00.000Z",
      modifiedAt: "2026-07-14T10:00:00.000Z",
    });
    expect(knowledgeSeoTimestamps(article({
      reviewed_at: "2026-07-01T09:00:00.000Z",
      created_at: "2026-08-01T09:00:00.000Z",
      updated_at: "2026-07-01T09:00:00.000Z",
    }))).toEqual({
      publishedAt: "2026-08-01T09:00:00.000Z",
      modifiedAt: "2026-08-01T09:00:00.000Z",
    });
  });
  it("sets article SEO metadata from the current article and restores the previous head on navigation and unmount", async () => {
    const initialTitle = document.title;
    const previousDescription = document.head.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previousDescriptionContent = previousDescription?.getAttribute("content") ?? null;
    const baselineDescription = previousDescription ?? document.createElement("meta");
    if (!previousDescription) {
      baselineDescription.setAttribute("name", "description");
      document.head.append(baselineDescription);
    }
    baselineDescription.setAttribute("content", "Beschreibung der vorherigen Seite.");

    const previousOgTitle = document.head.querySelector<HTMLMetaElement>(
      'meta[property="og:title"]',
    );
    const previousOgTitleContent = previousOgTitle?.getAttribute("content") ?? null;
    const baselineOgTitle = previousOgTitle ?? document.createElement("meta");
    if (!previousOgTitle) {
      baselineOgTitle.setAttribute("property", "og:title");
      document.head.append(baselineOgTitle);
    }
    baselineOgTitle.setAttribute("content", "Vorheriger OpenGraph-Titel");
    const previousRobots = document.head.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    const previousRobotsContent = previousRobots?.getAttribute("content") ?? null;
    document.title = "Vorherige Seite | Supplement Stack";

    const quercetinSummary =
      'Quercetin kompakt: **"klar"** & </script> sicher eingeordnet.';
    const quercetinDescription =
      'Quercetin kompakt: "klar" & </script> sicher eingeordnet.';
    const bodyAssetPath = `/api/r2/knowledge/quercetin/${"a".repeat(64)}.png`;
    const technicalZinkUrl = new URL('/wissen/zink', window.location.origin).href;
    const technicalZinkDescription = 'Technische Zink-Beschreibung aus der freigegebenen SEO-Projektion.';
    const storedTechnicalZinkJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Zink: **technischer** Meta-Titel',
      description: 'Technische **Zink**-Beschreibung aus der freigegebenen SEO-Projektion.',
      mainEntityOfPage: technicalZinkUrl,
      inLanguage: 'de',
    };
    const technicalZinkJsonLd = {
      ...storedTechnicalZinkJsonLd,
      headline: 'Zink: technischer Meta-Titel',
      description: technicalZinkDescription,
    };
    const articles = {
      quercetin: {
        slug: "quercetin",
        title: "Quercetin verständlich erklärt",
        summary: quercetinSummary,
        body: `Ein Artikel über Quercetin.\n\n![Quercetin-Grafik](${bodyAssetPath})`,
        reviewed_at: "2026-07-14T10:00:00.000Z",
        created_at: "2025-01-02 08:30:00",
        updated_at: "2026-07-13T18:00:00.000Z",
        featured_image_url: "/api/r2/knowledge/quercetin/hero.webp",
        sources: [],
      },
      zink: {
        slug: "zink",
        title: "Zink im Überblick",
        summary: "Zink verständlich erklärt: Funktionen, Quellen und Einordnung.",
        body: "Ein Artikel über Zink.",
        reviewed_at: "2026-07-01T09:00:00.000Z",
        created_at: "2026-08-01T09:00:00.000Z",
        updated_at: "2026-07-01T09:00:00.000Z",
        featured_image_url: "data:image/png;base64,unsafe",
        sources: [],
        seo: {
          meta_title: 'Zink: technischer Meta-Titel',
          meta_description: technicalZinkDescription,
          canonical_url: technicalZinkUrl,
          canonical_path: '/wissen/zink',
          robots: 'index,follow',
          indexable: true,
          json_ld: storedTechnicalZinkJsonLd,
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const article = String(input).endsWith("/zink")
          ? articles.zink
          : articles.quercetin;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ article }),
        });
      }),
    );

    const { unmount } = render(
      <MemoryRouter initialEntries={["/wissen/quercetin"]}>
        <Link to="/wissen/zink">Zum Zinkartikel</Link>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", {
      level: 1,
      name: "Quercetin verständlich erklärt",
    });
    const quercetinUrl = new URL(
      "/wissen/quercetin",
      window.location.origin,
    ).href;
    await waitFor(() => {
      expect(document.title).toBe("Quercetin verständlich erklärt");
    });
    expect(baselineDescription.getAttribute("content")).toBe(
      quercetinDescription,
    );
    expect(
      document.head
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content"),
    ).toBe("index,follow");
    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute("href"),
    ).toBe(quercetinUrl);
    expect(baselineOgTitle.getAttribute("content")).toBe(
      "Quercetin verständlich erklärt",
    );
    expect(
      document.head
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content"),
    ).toBe(quercetinDescription);
    expect(
      document.head
        .querySelector('meta[property="og:url"]')
        ?.getAttribute("content"),
    ).toBe(quercetinUrl);
    expect(
      document.head
        .querySelector('meta[property="og:type"]')
        ?.getAttribute("content"),
    ).toBe("article");
    const quercetinImageUrl = new URL(bodyAssetPath, window.location.origin).href;
    expect(
      document.head
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content"),
    ).toBe(quercetinImageUrl);

    const quercetinJsonLdElement = document.head.querySelector<HTMLScriptElement>(
      'script[data-knowledge-article-json-ld="true"]',
    );
    expect(quercetinJsonLdElement?.textContent).not.toContain("</script>");
    const quercetinJsonLd = JSON.parse(
      quercetinJsonLdElement?.textContent ?? "{}",
    ) as Record<string, unknown>;
    expect(quercetinJsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Quercetin verständlich erklärt",
      description: quercetinDescription,
      mainEntityOfPage: quercetinUrl,
      inLanguage: "de",
      datePublished: "2025-01-02T08:30:00.000Z",
      dateModified: "2026-07-14T10:00:00.000Z",
      author: {
        "@type": "Organization",
        "@id": "http://localhost:3000/#organization",
        name: "Supplement Stack",
        url: "http://localhost:3000/",
      },
      publisher: {
        "@type": "Organization",
        "@id": "http://localhost:3000/#organization",
        name: "Supplement Stack",
        url: "http://localhost:3000/",
      },
      image: quercetinImageUrl,
    });
    expect(quercetinJsonLd).not.toHaveProperty("url");

    fireEvent.click(screen.getByRole("link", { name: "Zum Zinkartikel" }));
    await screen.findByRole("heading", { level: 1, name: "Zink im Überblick" });
    const zinkUrl = technicalZinkUrl;
    await waitFor(() => {
      expect(document.title).toBe("Zink: technischer Meta-Titel");
      expect(baselineDescription.getAttribute("content")).toBe(
        technicalZinkDescription,
      );
    });
    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute("href"),
    ).toBe(zinkUrl);
    expect(
      document.head.querySelectorAll(
        'script[data-knowledge-article-json-ld="true"]',
      ),
    ).toHaveLength(1);
    const zinkJsonLd = JSON.parse(
      document.head.querySelector<HTMLScriptElement>(
        'script[data-knowledge-article-json-ld="true"]',
      )?.textContent ?? "{}",
    ) as Record<string, unknown>;
    expect(zinkJsonLd).toEqual(technicalZinkJsonLd);
    expect(zinkJsonLd).not.toHaveProperty("url");
    expect(zinkJsonLd).not.toHaveProperty("image");
    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
    unmount();
    expect(document.title).toBe("Vorherige Seite | Supplement Stack");
    expect(baselineDescription.getAttribute("content")).toBe(
      "Beschreibung der vorherigen Seite.",
    );
    expect(baselineOgTitle.getAttribute("content")).toBe(
      "Vorheriger OpenGraph-Titel",
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(
      document.head.querySelector('meta[property="og:description"]'),
    ).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:type"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
    expect(
      document.head.querySelector(
        'script[data-knowledge-article-json-ld="true"]',
      ),
    ).toBeNull();
    if (previousRobots) {
      expect(previousRobots.getAttribute("content")).toBe(previousRobotsContent);
    } else {
      expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    }

    document.title = initialTitle;
    if (previousDescription) {
      if (previousDescriptionContent === null) {
        previousDescription.removeAttribute("content");
      } else {
        previousDescription.setAttribute("content", previousDescriptionContent);
      }
    } else {
      baselineDescription.remove();
    }
    if (previousOgTitle) {
      if (previousOgTitleContent === null) {
        previousOgTitle.removeAttribute("content");
      } else {
        previousOgTitle.setAttribute("content", previousOgTitleContent);
      }
    } else {
      baselineOgTitle.remove();
    }
  });
  it("renders marked main articles with the magazine template architecture", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              article: {
                slug: "vitamin-a",
                title: "Vitamin A: Warum Augen, Haut und Abwehr es brauchen",
                summary:
                  "Vitamin A einfach erklärt: Formen, Lebensmittel, Aufgaben im Körper und Sicherheit.",
                article_layer: "main_article",
                reviewed_at: "2026-06-02T14:45:00Z",
                body: [
                  "<!-- knowledge-template:magazine -->",
                  "",
                  "Vitamin A ist ein fettlöslicher Nährstoff. Der Körper nimmt ihn zusammen mit Fett aus dem Essen auf.",
                  "",
                  "## Auf einen Blick",
                  "",
                  "- Vitamin A ist nicht nur ein einzelner Stoff, sondern eine Stoffgruppe.",
                  "- Beta-Carotin aus Gemüse ist anders zu bewerten als Retinol.",
                  "",
                  "## Was ist Vitamin A?",
                  "",
                  "Vitamin A ist ein Sammelbegriff. Mehrere verwandte Stoffe übernehmen im Körper ähnliche Aufgaben.",
                  "",
                  "| Form | Wo sie vorkommt | Wichtig zu wissen |",
                  "| --- | --- | --- |",
                  "| Retinol | tierische Lebensmittel | direkt nutzbar |",
                  "| Beta-Carotin | Karotten und grünes Gemüse | pflanzliche Vorstufe |",
                  "",
                  "## Wo steckt Vitamin A drin?",
                  "",
                  "| Lebensmittelgruppe | Beispiele | Einfache Einordnung |",
                  "| --- | --- | --- |",
                  "| Orangefarbenes Gemüse | Karotten, Kürbis | der Körper wandelt nur einen Teil um |",
                  "| Milchprodukte und Ei | Käse, Butter, Eigelb | weniger konzentriert als Leber |",
                  "",
                  "## Häufige Fragen",
                  "",
                  "### Ist Vitamin A gut für die Augen?",
                  "",
                  "Ja, Vitamin A ist fürs Sehen wichtig. Hohe Mengen verbessern die Augen aber nicht automatisch.",
                ].join("\n"),
                sources: [
                  {
                    label: "DGE Referenzwerte Vitamin A",
                    url: "https://example.com/dge-vitamin-a",
                  },
                ],
                ingredients: [{ ingredient_id: 32, name: "Vitamin A" }],
              },
            }),
        }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );
    await screen.findByRole("heading", {
      level: 1,
      name: "Vitamin A: Warum Augen, Haut und Abwehr es brauchen",
    });
    const article = screen.getByTestId("knowledge-magazine-article");
    expect(article.className).toContain("card");
    expect(article.getAttribute("data-template")).toBe("magazine");
    const hero = screen.getByTestId("knowledge-magazine-hero");
    expect(hero.className).toContain("hero");
    expect(hero.querySelector(".dek")?.textContent).toContain(
      "Vitamin A einfach erklärt",
    );
    expect(hero.querySelectorAll(".hero-meta .chip")).toHaveLength(1);
    expect(hero.querySelectorAll(".hero-meta .meta-item")).toHaveLength(2);
    expect(
      container.querySelector(
        ".knowledge-magazine-progress-track .progress-bar",
      ),
    ).toBeTruthy();
    expect(container.querySelector(".lead")?.textContent).toContain(
      "fettlöslicher Nährstoff",
    );
    const toc = container.querySelector(
      'aside.toc[aria-label="Inhaltsverzeichnis"]',
    ) as HTMLElement;
    expect(toc).toBeTruthy();
    expect(toc.className).toContain("toc");
    expect(toc.querySelector(".toc__title")?.textContent).toBe(
      "Auf dieser Seite",
    );
    expect(toc.querySelector("ol")).toBeTruthy();
    expect(
      within(toc)
        .getByRole("link", { name: "Was ist Vitamin A?" })
        .getAttribute("href"),
    ).toBe("#was-ist-vitamin-a");
    expect(
      within(toc)
        .getByRole("link", { name: "Auf einen Blick" })
        .getAttribute("href"),
    ).toBe("#ueberblick");
    const firstSection = screen.getByTestId(
      "knowledge-magazine-section-was-ist-vitamin-a",
    );
    expect(firstSection.querySelector(".sec-head .num")?.textContent).toBe(
      "01",
    );
    expect(firstSection.querySelector(".nice")).toBeTruthy();
    expect(container.querySelector("#ueberblick .takeaways")).toBeTruthy();
    const faqItem = container.querySelector(".faq-item");
    const faqButton = container.querySelector(".faq-item .faq-q");
    expect(faqItem).toBeTruthy();
    expect(faqButton).toBeTruthy();
    expect(faqButton?.getAttribute("aria-expanded")).toBe("false");
    const faqPanelId = faqButton?.getAttribute("aria-controls") ?? "";
    const faqPanel = document.getElementById(faqPanelId) as HTMLElement;
    expect(faqPanelId).not.toBe("");
    expect(faqPanel).toBeTruthy();
    expect(faqPanel.hidden).toBe(true);
    expect(faqPanel.getAttribute("aria-labelledby")).toBe(faqButton?.id);
    expect(container.querySelector(".faq-item .faq-a__in")).toBeTruthy();
    expect(faqItem?.className).not.toContain("is-open");
    fireEvent.click(faqButton as HTMLButtonElement);
    expect(faqButton?.getAttribute("aria-expanded")).toBe("true");
    expect(faqPanel.hidden).toBe(false);
    expect(faqItem?.className).toContain("is-open");
    const sources = container.querySelector(".sources");
    const sourceToggle = container.querySelector(".src-toggle") as HTMLButtonElement;
    expect(sourceToggle?.getAttribute("aria-expanded")).toBe("false");
    const sourcePanelId = sourceToggle?.getAttribute("aria-controls") ?? "";
    const sourcePanel = document.getElementById(sourcePanelId) as HTMLElement;
    expect(sourcePanelId).not.toBe("");
    expect(sourcePanel).toBeTruthy();
    expect(sourcePanel.hidden).toBe(true);
    expect(sourcePanel.getAttribute("aria-labelledby")).toBe(sourceToggle.id);
    expect(screen.queryByRole("link", { name: "DGE Referenzwerte Vitamin A" })).toBeNull();
    expect(sources?.className).not.toContain("is-open");
    fireEvent.click(sourceToggle);
    expect(sourceToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(sourcePanel.hidden).toBe(false);
    expect(screen.getByRole("link", { name: "DGE Referenzwerte Vitamin A" })).toBeTruthy();
    expect(sources?.className).toContain("is-open");
    expect(container.querySelector(".src-list__in")).toBeTruthy();
    expect(
      [...container.querySelectorAll(".src-list a")].some(
        (link) => link.getAttribute("href") === "#",
      ),
    ).toBe(false);
    expect(container.querySelector(".takeaways")?.textContent).toContain(
      "Beta-Carotin aus Gemüse",
    );
    expect(container.querySelector(".food-grid")?.textContent).toContain(
      "Orangefarbenes Gemüse",
    );
    expect(container.querySelector(".faq")?.textContent).toContain(
      "Ist Vitamin A gut für die Augen?",
    );
    expect(container.querySelector(".sources")?.textContent).toContain(
      "DGE Referenzwerte Vitamin A",
    );
    fireEvent.click(sourceToggle);
    expect(sourceToggle.getAttribute("aria-expanded")).toBe("false");
    expect(sourcePanel.hidden).toBe(true);
    expect(screen.queryByRole("link", { name: "DGE Referenzwerte Vitamin A" })).toBeNull();
  });
  it("resets magazine disclosure and progress state when the route article changes", async () => {
    const articles = {
      quercetin: {
        slug: "quercetin",
        title: "Quercetin Magazin",
        summary: "Erster Magazinartikel",
        article_layer: "main_article",
        body: [
          "<!-- knowledge-template:magazine -->",
          "",
          "## Häufige Fragen",
          "",
          "### Erste Frage?",
          "",
          "Erste Antwort.",
        ].join("\n"),
        sources: [{ label: "Quercetin-Quelle", url: "https://example.com/quercetin" }],
      },
      zink: {
        slug: "zink",
        title: "Zink Magazin",
        summary: "Zweiter Magazinartikel",
        article_layer: "main_article",
        body: [
          "<!-- knowledge-template:magazine -->",
          "",
          "## Häufige Fragen",
          "",
          "### Zweite Frage?",
          "",
          "Zweite Antwort.",
        ].join("\n"),
        sources: [{ label: "Zink-Quelle", url: "https://example.com/zink" }],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => Promise.resolve(
        knowledgeResponse(String(input).endsWith("/zink") ? articles.zink : articles.quercetin),
      )),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/quercetin"]}>
        <Link to="/wissen/zink">Zum Zink-Magazin</Link>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 1, name: "Quercetin Magazin" });
    const firstProgressBar = container.querySelector(".knowledge-magazine-progress-track .progress-bar");
    const firstFaqToggle = container.querySelector(".faq-q") as HTMLButtonElement;
    const firstSourceToggle = container.querySelector(".src-toggle") as HTMLButtonElement;
    fireEvent.click(firstFaqToggle);
    fireEvent.click(firstSourceToggle);
    expect(firstFaqToggle.getAttribute("aria-expanded")).toBe("true");
    expect(firstSourceToggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("link", { name: "Zum Zink-Magazin" }));
    await screen.findByRole("heading", { level: 1, name: "Zink Magazin" });
    const nextProgressBar = container.querySelector(".knowledge-magazine-progress-track .progress-bar");
    const nextFaqToggle = container.querySelector(".faq-q") as HTMLButtonElement;
    const nextSourceToggle = container.querySelector(".src-toggle") as HTMLButtonElement;
    expect(nextProgressBar).not.toBe(firstProgressBar);
    expect(nextProgressBar?.getAttribute("style")).toContain("width: 0%");
    expect(nextFaqToggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(nextFaqToggle.getAttribute("aria-controls") ?? "")?.hidden).toBe(true);
    expect(nextSourceToggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(nextSourceToggle.getAttribute("aria-controls") ?? "")?.hidden).toBe(true);
  });
  it("generates non-empty collision-safe TOC IDs", () => {
    const { container } = render(
      <MemoryRouter>
        <KnowledgeMagazineArticle
          reviewedDate={null}
          article={{
            slug: "toc-kollisionen",
            title: "TOC-Kollisionen",
            summary: "Eindeutige Sprungmarken",
            body: [
              "<!-- knowledge-template:magazine -->",
              "",
              "## !!!",
              "",
              "Erster Abschnitt.",
              "",
              "## ???",
              "",
              "Zweiter Abschnitt.",
              "",
              "## Größe",
              "",
              "Dritter Abschnitt.",
              "",
              "## Grosse",
              "",
              "Vierter Abschnitt.",
            ].join("\n"),
            sources: [],
          }}
        />
      </MemoryRouter>,
    );

    const sectionIds = Array.from(container.querySelectorAll(".content > section[data-testid]"))
      .map((section) => section.id);
    expect(sectionIds).toEqual(["abschnitt", "abschnitt-2", "grosse", "grosse-2"]);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(sectionIds.every(Boolean)).toBe(true);
    const tocHrefs = Array.from(container.querySelectorAll("aside.toc a"))
      .map((link) => link.getAttribute("href"));
    expect(tocHrefs).toEqual(sectionIds.map((id) => `#${id}`));
  });
  it("batches repeated viewport measurements into one animation frame", () => {
    let nextFrameId = 1;
    const pendingFrames = new Map<number, FrameRequestCallback>();
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      pendingFrames.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.stubGlobal("cancelAnimationFrame", vi.fn((frameId: number) => pendingFrames.delete(frameId)));

    render(
      <MemoryRouter>
        <KnowledgeMagazineArticle
          reviewedDate={null}
          article={{
            slug: "raf-test",
            title: "Viewport-Test",
            summary: "Gebündelte Messungen",
            body: [
              "<!-- knowledge-template:magazine -->",
              "",
              "## Erster Abschnitt",
              "",
              "Inhalt.",
            ].join("\n"),
            sources: [],
          }}
        />
      </MemoryRouter>,
    );

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    const initialFrame = pendingFrames.entries().next().value as [number, FrameRequestCallback] | undefined;
    expect(initialFrame).toBeTruthy();
    act(() => {
      if (!initialFrame) return;
      pendingFrames.delete(initialFrame[0]);
      initialFrame[1](0);
    });
    requestAnimationFrameMock.mockClear();

    fireEvent.scroll(window);
    fireEvent.scroll(window);
    fireEvent.resize(window);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
  });
  it("renders the stored conclusion once as a numbered magazine section for any substance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            article: {
              slug: "quercetin",
              title: "Quercetin verständlich erklärt",
              summary: "Quercetin in klarer Sprache eingeordnet.",
              article_layer: "main_article",
              conclusion: [
                "Das gespeicherte Quercetin-Fazit bleibt sichtbar.",
                "Hinweis: Diese Informationen ersetzen keine medizinische Beratung.",
              ].join("\n\n"),
              body: [
                "<!-- knowledge-template:magazine -->",
                "",
                "Ein verständlicher Einstieg.",
                "",
                "## Auf einen Blick",
                "",
                "- Quercetin ist ein Pflanzenstoff.",
                "",
                "## Was ist Quercetin?",
                "",
                "Eine allgemein verständliche Einordnung.",
                "",
                "## Wo steckt Quercetin drin?",
                "",
                "| Lebensmittelgruppe | Beispiele | Einordnung |",
                "| --- | --- | --- |",
                "| Gemüse | Zwiebeln | eine mögliche Nahrungsquelle |",
              ].join("\n"),
              sources: [
                {
                  label: "Quercetin-Übersichtsquelle",
                  url: "https://example.com/quercetin-review",
                },
              ],
              ingredients: [{ ingredient_id: 77, name: "Quercetin" }],
            },
          }),
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/quercetin"]}>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", {
      level: 1,
      name: "Quercetin verständlich erklärt",
    });
    expect(
      screen.getAllByRole("heading", { level: 2, name: "Fazit" }),
    ).toHaveLength(1);
    const conclusionSection = screen.getByTestId(
      "knowledge-magazine-section-fazit",
    );
    expect(conclusionSection.querySelector(".sec-head .num")?.textContent).toBe(
      "03",
    );
    expect(
      within(conclusionSection).getAllByText(
        "Das gespeicherte Quercetin-Fazit bleibt sichtbar.",
      ),
    ).toHaveLength(1);
    const toc = container.querySelector(
      'aside.toc[aria-label="Inhaltsverzeichnis"]',
    ) as HTMLElement;
    const conclusionTocLinks = within(toc).getAllByRole("link", {
      name: "Fazit",
    });
    expect(conclusionTocLinks).toHaveLength(1);
    expect(conclusionTocLinks[0].getAttribute("href")).toBe("#fazit");
    expect(container.querySelector(".food-grid")?.textContent).toContain(
      "Zwiebeln",
    );
    expect(screen.getByText("Quercetin-Übersichtsquelle").closest("a")?.getAttribute("href")).toBe(
      "https://example.com/quercetin-review",
    );
    expect(
      screen.getByText(
        "Hinweis: Diese Informationen ersetzen keine medizinische Beratung.",
      ),
    ).toBeTruthy();
  });
  it("replaces a legacy body conclusion without duplicating Fazit or losing the disclaimer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            article: {
              slug: "selen",
              title: "Selen verständlich erklärt",
              summary: "Selen kompakt eingeordnet.",
              article_layer: "main_article",
              conclusion: "Das separat gespeicherte Fazit ist maßgeblich.",
              body: [
                "<!-- knowledge-template:magazine -->",
                "",
                "Ein Lead.",
                "",
                "## Grundlagen",
                "",
                "Ein Abschnitt.",
                "",
                "## Fazit",
                "",
                "Dieses Legacy-Fazit darf nicht zusätzlich erscheinen.",
                "",
                "## Rechtlicher Hinweis",
                "",
                "Der rechtliche Hinweis bleibt erhalten.",
              ].join("\n"),
              sources: [
                {
                  label: "Selen-Quelle",
                  url: "https://example.com/selen",
                },
              ],
              ingredients: [{ ingredient_id: 78, name: "Selen" }],
            },
          }),
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/selen"]}>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", {
      level: 1,
      name: "Selen verständlich erklärt",
    });
    expect(
      screen.getAllByRole("heading", { level: 2, name: "Fazit" }),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(
        '[data-testid="knowledge-magazine-section-fazit"]',
      ),
    ).toHaveLength(1);
    expect(
      screen.getAllByText("Das separat gespeicherte Fazit ist maßgeblich."),
    ).toHaveLength(1);
    expect(
      screen.queryByText("Dieses Legacy-Fazit darf nicht zusätzlich erscheinen."),
    ).toBeNull();
    expect(screen.getByText("Der rechtliche Hinweis bleibt erhalten.")).toBeTruthy();
    const toc = container.querySelector("aside.toc") as HTMLElement;
    expect(within(toc).getAllByRole("link", { name: "Fazit" })).toHaveLength(1);
    expect(screen.getByText("Selen-Quelle")).toBeTruthy();
  });
  it("keeps magazine sticky toc and progress styles aligned with the offline template", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              article: {
                slug: "vitamin-a",
                title: "Vitamin A",
                summary: "Vitamin A einfach erklärt.",
                article_layer: "main_article",
                body: [
                  "<!-- knowledge-template:magazine -->",
                  "",
                  "Ein Lead.",
                  "",
                  "## Was ist Vitamin A?",
                  "",
                  "Ein Abschnitt.",
                  "",
                  "## Häufige Fragen",
                  "",
                  "### Eine Frage?",
                  "",
                  "Eine Antwort.",
                ].join("\n"),
                sources: [
                  {
                    label: "DGE Referenzwerte Vitamin A",
                    url: "https://example.com/dge-vitamin-a",
                  },
                ],
                ingredients: [{ ingredient_id: 32, name: "Vitamin A" }],
              },
            }),
        }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Vitamin A" });
    expect(
      container.querySelector('aside.toc[aria-label="Inhaltsverzeichnis"]'),
    ).toBeTruthy();
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    expect(css).toMatch(
      /\.knowledge-magazine-progress-track\s*\{[^}]*position:\s*sticky;[^}]*top:\s*67px;/s,
    );
    expect(css).toMatch(
      /\.knowledge-magazine\s*\{(?![^}]*overflow:\s*hidden;)[^}]*\}/s,
    );
    expect(css).toMatch(
      /\.knowledge-magazine\s+\.toc\s*\{[^}]*position:\s*sticky;[^}]*top:\s*104px;/s,
    );
    expect(css).toMatch(
      /\.knowledge-magazine\s+\.toc\s+ol\s*\{[^}]*border-left:\s*2px solid var\(--km-line\)/s,
    );
    expect(css).toMatch(
      /\.knowledge-magazine\s+\.toc\s+>\s*ol\s*>\s*li\s*>\s*a\.is-active[\s\S]*color:\s*var\(--km-green-dark\)\s*!important/,
    );
    expect(css).toMatch(
      /\.knowledge-magazine\s+\.toc\s+>\s*ol\s*>\s*li\s*>\s*a\[aria-current=['"]true['"]\][\s\S]*font-weight:\s*800\s*!important/,
    );
    expect(css).toMatch(
      /\.knowledge-magazine\s+\.toc\s+>\s*ol\s*>\s*li\s*>\s*a\.is-active::before[\s\S]*background:\s*var\(--km-green\)\s*!important/,
    );
    expect(css).toMatch(/\[aria-current=['"]true['"]\]/s);
  });
  it("does not render placeholder hash links for magazine article sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            article: {
              slug: "vitamin-a",
              title: "Vitamin A",
                summary: "Vitamin A einfach erklärt.",
                article_layer: "main_article",
                body: [
                "<!-- knowledge-template:magazine -->",
                "",
                "Ein Lead.",
                "",
                "## Was ist Vitamin A?",
                "",
                "Ein Abschnitt.",
                "",
                "## Häufige Fragen",
                "",
                "### Eine Frage?",
                "",
                "Eine Antwort.",
              ].join("\n"),
              sources: [
                { label: "Platzhalter", url: "#" },
                { label: "Unsichere Magazinquelle", url: "javascript:alert(1)" },
                {
                  label: "DGE Referenzwerte Vitamin A",
                  url: "https://example.com/dge-vitamin-a",
                  internal_articles: [
                    {
                      slug: "vitamin-a-studie-eingeordnet",
                      title: "Vitamin-A-Studie eingeordnet",
                      url: "/wissen/vitamin-a-studie-eingeordnet",
                    },
                  ],
                },
              ],
              ingredients: [{ ingredient_id: 32, name: "Vitamin A" }],
            },
          }),
      }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Vitamin A" });
    const sourceLinks = [...container.querySelectorAll(".src-list a.source-link")];
    expect(sourceLinks).toHaveLength(1);
    expect(sourceLinks[0].getAttribute("href")).toBe(
      "https://example.com/dge-vitamin-a",
    );
    expect(sourceLinks[0].getAttribute("target")).toBe("_blank");
    expect(sourceLinks[0].getAttribute("aria-label")).toContain("Originalquelle öffnen");
    const internalArticleLink = container.querySelector('a[href="/wissen/vitamin-a-studie-eingeordnet"]');
    expect(internalArticleLink?.getAttribute("href")).toBe("/wissen/vitamin-a-studie-eingeordnet");
    expect(internalArticleLink?.getAttribute("target")).toBeNull();
    const unsafeSource = screen.getByText("Unsichere Magazinquelle");
    expect(unsafeSource.closest("a")).toBeNull();
    expect(unsafeSource.getAttribute("data-invalid-source-url")).toBe("true");
    expect(container.querySelector(".sources")?.textContent).not.toContain(
      "Platzhalter",
    );
  });
  it("skips body source sections for magazine articles with system sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            article: {
              slug: "vitamin-a",
              title: "Vitamin A",
                summary: "Vitamin A einfach erklärt.",
                article_layer: "main_article",
                body: [
                "<!-- knowledge-template:magazine -->",
                "",
                "Ein Lead.",
                "",
                "## Was ist Vitamin A?",
                "",
                "Ein Abschnitt.",
                "",
                "## Quellen",
                "",
                "- Body-Quellenliste, die nicht doppelt erscheinen darf.",
              ].join("\n"),
              sources: [
                {
                  label: "Systemische Quelle",
                  url: "https://example.com/system-source",
                },
              ],
              ingredients: [{ ingredient_id: 32, name: "Vitamin A" }],
            },
          }),
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 1, name: "Vitamin A" });
    expect(
      container.querySelector(
        '[data-testid="knowledge-magazine-section-quellen"]',
      ),
    ).toBeNull();
    expect(container.querySelector(".content")?.textContent).not.toContain(
      "Body-Quellenliste",
    );
    const toc = container.querySelector(
      'aside.toc[aria-label="Inhaltsverzeichnis"]',
    );
    const sourceTocLinks = within(toc as HTMLElement).getAllByRole("link", {
      name: "Quellen",
    });
    expect(sourceTocLinks).toHaveLength(1);
    expect(sourceTocLinks[0].getAttribute("href")).toBe("#quellen");
    expect(container.querySelector("#quellen .sources")?.textContent).toContain(
      "Systemische Quelle",
    );
  });
  it("sets the active TOC link from URL hash with aria-current and active class", async () => {
    let nextFrameId = 1;
    const pendingFrames = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      pendingFrames.set(frameId, callback);
      return frameId;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((frameId: number) => pendingFrames.delete(frameId)));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              article: {
                slug: "vitamin-a",
                title: "Vitamin A",
                summary: "Vitamin A einfach erklärt.",
                article_layer: "main_article",
                body: [
                  "<!-- knowledge-template:magazine -->",
                  "",
                  "Ein Lead.",
                  "",
                  "## Auf einen Blick",
                  "",
                  "- Vitamin A ist ein fettlöslicher Stoff.",
                  "",
                  "## Was ist Vitamin A?",
                  "",
                  "Absatz.",
                  "",
                  "## Sicherheit",
                  "",
                  "Wichtige Daten.",
                ].join("\n"),
                sources: [
                  {
                    label: "DGE Referenzwerte Vitamin A",
                    url: "https://example.com/dge-vitamin-a",
                  },
                ],
                ingredients: [{ ingredient_id: 32, name: "Vitamin A" }],
              },
            }),
        }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a#sicherheit"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Vitamin A" });
    const activeTocLink = container.querySelector(
      'aside.toc a[aria-current="true"]',
    );
    expect(activeTocLink).toBeTruthy();
    expect(activeTocLink?.getAttribute("href")).toBe("#sicherheit");
    expect(activeTocLink?.className).toContain("is-active");
    expect(activeTocLink?.textContent).toBe("Sicherheit");
    expect(Array.from(container.querySelectorAll(".content > section")).every((section) => {
      const bounds = section.getBoundingClientRect();
      return bounds.width === 0 && bounds.height === 0 && bounds.top === 0 && bounds.bottom === 0;
    })).toBe(true);

    act(() => {
      while (pendingFrames.size > 0) {
        const [frameId, callback] = pendingFrames.entries().next().value as [number, FrameRequestCallback];
        pendingFrames.delete(frameId);
        callback(0);
      }
    });
    const activeAfterDegenerateFrame = container.querySelector('aside.toc a[aria-current="true"]');
    expect(activeAfterDegenerateFrame?.getAttribute("href")).toBe("#sicherheit");
  });
  it("updates active TOC link while scrolling through magazine sections", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              article: {
                slug: "vitamin-a",
                title: "Vitamin A",
                summary: "Vitamin A einfach erklärt.",
                article_layer: "main_article",
                body: [
                  "<!-- knowledge-template:magazine -->",
                  "",
                  "Ein Lead.",
                  "",
                  "## Auf einen Blick",
                  "",
                  "- Wichtige Information.",
                  "",
                  "## Erster Abschnitt",
                  "",
                  "Inhalt.",
                  "",
                  "## Zweiter Abschnitt",
                  "",
                  "Inhalt.",
                ].join("\n"),
                sources: [
                  {
                    label: "DGE Referenzwerte Vitamin A",
                    url: "https://example.com/dge-vitamin-a",
                  },
                ],
                ingredients: [{ ingredient_id: 32, name: "Vitamin A" }],
              },
            }),
        }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Vitamin A" });
    const getBounds = (top: number, height = 180) =>
      ({
        x: 0,
        y: top,
        width: 0,
        height,
        top,
        right: 0,
        bottom: top + height,
        left: 0,
        toJSON: () => ({
          x: 0,
          y: top,
          width: 0,
          height,
          top,
          right: 0,
          bottom: top + height,
          left: 0,
        }),
      }) as DOMRect;
    const sectionOffsets: Record<
      "ueberblick" | "erster-abschnitt" | "zweiter-abschnitt" | "quellen",
      number
    > = {
      ueberblick: 300,
      "erster-abschnitt": 420,
      "zweiter-abschnitt": 620,
      quellen: 800,
    };
    const sectionIds = [
      "ueberblick",
      "erster-abschnitt",
      "zweiter-abschnitt",
      "quellen",
    ] as const;
    sectionIds.forEach((id) => {
      const section = container.querySelector(`#${id}`) as HTMLElement;
      Object.defineProperty(section, "getBoundingClientRect", {
        configurable: true,
        value: () => getBounds(sectionOffsets[id]),
      });
    });
    const setSectionTop = (
      id: "ueberblick" | "erster-abschnitt" | "zweiter-abschnitt" | "quellen",
      top: number,
    ) => {
      sectionOffsets[id] = top;
    };
    const toc = container.querySelector("aside.toc") as HTMLElement;
    const activeHref = (node: HTMLAnchorElement | null) =>
      node?.getAttribute("href");
    setSectionTop("ueberblick", 300);
    setSectionTop("erster-abschnitt", 420);
    setSectionTop("zweiter-abschnitt", 620);
    setSectionTop("quellen", 800);
    fireEvent.scroll(window);
    await waitFor(() => {
      const active = toc.querySelector(
        'a[aria-current="true"]',
      ) as HTMLAnchorElement | null;
      expect(activeHref(active)).toBe("#ueberblick");
    });
    setSectionTop("ueberblick", 180);
    setSectionTop("erster-abschnitt", 80);
    setSectionTop("zweiter-abschnitt", 620);
    setSectionTop("quellen", 810);
    expect(
      container.querySelector("#ueberblick")?.getBoundingClientRect().top,
    ).toBe(180);
    expect(
      container.querySelector("#erster-abschnitt")?.getBoundingClientRect().top,
    ).toBe(80);
    expect(
      container.querySelector("#zweiter-abschnitt")?.getBoundingClientRect()
        .top,
    ).toBe(620);
    fireEvent.scroll(window);
    await waitFor(() => {
      const active = toc.querySelector(
        'a[aria-current="true"]',
      ) as HTMLAnchorElement | null;
      expect(activeHref(active)).toBe("#erster-abschnitt");
    });
    setSectionTop("ueberblick", 210);
    setSectionTop("erster-abschnitt", -20);
    setSectionTop("zweiter-abschnitt", 30);
    setSectionTop("quellen", 650);
    expect(
      container.querySelector("#ueberblick")?.getBoundingClientRect().top,
    ).toBe(210);
    expect(
      container.querySelector("#erster-abschnitt")?.getBoundingClientRect().top,
    ).toBe(-20);
    expect(
      container.querySelector("#zweiter-abschnitt")?.getBoundingClientRect()
        .top,
    ).toBe(30);
    fireEvent.scroll(window);
    await waitFor(() => {
      const active = toc.querySelector(
        'a[aria-current="true"]',
      ) as HTMLAnchorElement | null;
      expect(activeHref(active)).toBe("#zweiter-abschnitt");
    });
  });
  it("handles German magazine headings with umlauts and sharp s", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              article: {
                slug: "vitamin-a",
                title: "Vitamin A",
                summary: "Vitamin A einfach erklärt.",
                article_layer: "main_article",
                reviewed_at: "2026-06-02T14:45:00Z",
                body: [
                  "<!-- knowledge-template:magazine -->",
                  "",
                  "Ein Lead mit echten Umlauten.",
                  "",
                  "## Auf einen Blick",
                  "",
                  "- Der Körper nutzt Vitamin A zusammen mit Fett.",
                  "",
                  "## Wie der Körper Vitamin A nutzt",
                  "",
                  "![So wird Vitamin A im Körper genutzt](/assets/knowledge/vitamin-a-stoffwechsel.svg)",
                  "",
                  "## Was heißt µg RAE?",
                  "",
                  "`µg RAE` ist eine Vergleichseinheit.",
                  "",
                  "## Häufige Fragen",
                  "",
                  "### Ist Vitamin A fürs Sehen wichtig?",
                  "",
                  "Ja, Vitamin A ist fürs Sehen wichtig.",
                ].join("\n"),
                sources: [
                  {
                    label: "DGE Referenzwerte Vitamin A",
                    url: "https://example.com/dge-vitamin-a",
                  },
                ],
                ingredients: [{ ingredient_id: 32, name: "Vitamin A" }],
              },
            }),
        }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a"]}>
        {" "}
        <Routes>
          {" "}
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />{" "}
        </Routes>{" "}
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Vitamin A" });
    expect(screen.getByText("Geprüft am 2. Juni 2026")).toBeTruthy();
    expect(
      screen.getByTestId(
        "knowledge-magazine-section-wie-der-korper-vitamin-a-nutzt",
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId("knowledge-magazine-section-was-heisst-g-rae"),
    ).toBeTruthy();
    expect(
      container.querySelector("figure.flow img")?.getAttribute("alt"),
    ).toBe("So wird Vitamin A im Körper genutzt");
    expect(container.querySelector(".faq .faq-q")?.textContent).toContain(
      "Ist Vitamin A fürs Sehen wichtig?",
    );
  });
  it("renders Stage-2 release UI from the bound ingredient and review date without legacy hero, dose, or product fields", async () => {
    const bodyAssetPath = `/api/r2/knowledge/studie-zink/${"b".repeat(64)}.jpg`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        article: {
          slug: "studie-zink",
          title: "Zinkstudie verständlich eingeordnet",
          summary: "Eine klar begrenzte Einordnung der untersuchten Zinkstudie.",
          article_layer: "single_study",
          reviewed_at: "2026-07-14",
          body: [
            "## Studiendesign",
            "",
            "Die Studie vergleicht zwei Gruppen.",
            "",
            "| Merkmal | Einordnung |",
            "| --- | --- |",
            "| Dauer | Acht Wochen |",
            "",
            `![Gebundene Studiengrafik](${bodyAssetPath})`,
            "",
            "## Fazit",
            "",
            "Die Aussage bleibt auf die Studie begrenzt.",
          ].join("\n"),
          featured_image_url: "/api/r2/knowledge/studie-zink/legacy-hero.jpg",
          featured_image_r2_key: "knowledge/studie-zink/legacy-hero.jpg",
          dose_min: 10,
          dose_max: 20,
          dose_unit: "mg",
          product_note: "Legacy-Produkthinweis darf nicht sichtbar sein.",
          sources: [],
          ingredients: [{ ingredient_id: 17, name: "Zink", sort_order: 0 }],
        },
      }),
    }));

    const { container } = render(
      <MemoryRouter initialEntries={["/wissen/studie-zink"]}>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 1, name: "Zinkstudie verständlich eingeordnet" });
    expect(screen.getByText("Wirkstoff: Zink")).toBeTruthy();
    expect(screen.getByText("Geprüft am 14. Juli 2026")).toBeTruthy();
    expect(screen.queryByText(/Dosisdetails/)).toBeNull();
    expect(screen.queryByText("Legacy-Produkthinweis darf nicht sichtbar sein.")).toBeNull();
    expect(container.querySelector(`img[src="${bodyAssetPath}"]`)).toBeTruthy();
    expect(container.querySelector('img[src*="legacy-hero"]')).toBeNull();
    expect(screen.getByTestId("knowledge-table-mobile-card")).toBeTruthy();
  });
  it("propagates the release cfcheck to the detail API without changing the canonical URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        article: {
          slug: "vitamin-a",
          title: "Vitamin A",
          summary: "Vitamin A verständlich erklärt.",
          body: "Artikeltext",
          sources: [],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/wissen/vitamin-a?cfcheck=sha256%3Arelease-1"]}>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 1, name: "Vitamin A" });
    expect(String(fetchMock.mock.calls[0][0]))
      .toMatch(/\/api\/knowledge\/vitamin-a\?cfcheck=sha256%3Arelease-1$/);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href"))
      .toBe("http://localhost:3000/wissen/vitamin-a");
  });
  it("treats disallowed image URLs as plain text", () => {
    const blockedImageMarkdown = "![JavaScript-Bild](javascript:alert(1) )";
    const blocks = parseKnowledgeMarkdown(blockedImageMarkdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "paragraph",
      text: blockedImageMarkdown,
    });
  });
});
