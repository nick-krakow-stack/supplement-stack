// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import KnowledgeArticlePage from "./KnowledgeArticlePage";
import KnowledgeOverviewPage from "./KnowledgeOverviewPage";

function stubKnowledgeFetch(articles: Array<Record<string, unknown>>) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ articles, total: articles.length }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Aktuelle URL">{`${location.pathname}${location.search}`}</output>;
}

describe("KnowledgeOverviewPage", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    delete window.__knowledgeOverviewRequest;
    vi.unstubAllGlobals();
  });

  it("renders the listed cards in 10 categories and matches published articles to cards", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          articles: [
            {
              slug: "vitamin-d",
              title: "Vitamin D: Warum Sonne, Knochen und Calcium zusammengehört",
              summary: "Langer Artikeltitel darf nicht als Kartentitel erscheinen.",
              reviewed_at: "2026-06-02T14:45:00Z",
              updated_at: "2026-06-03T08:00:00Z",
              sources_count: 16,
              ingredients: [{ ingredient_id: 1, name: "Vitamin D" }],
              ingredient_ids: [1],
            },
            {
              slug: "mct-oel",
              title: "MCT-Öl",
              reviewed_at: "2026-06-02T14:45:00Z",
              updated_at: "2026-06-03T08:00:00Z",
              sources_count: 4,
              ingredients: [{ ingredient_id: 99, name: "MCT-Öl" }],
              ingredient_ids: [99],
            },
            {
              slug: "creatin",
              title: "Creatin",
              summary: "Phytolastische Form und Speicherwirkung.",
              reviewed_at: "2026-06-02T14:45:00Z",
              updated_at: "2026-06-03T08:00:00Z",
              sources_count: 4,
              ingredients: [{ ingredient_id: 100, name: "Creatin" }],
              ingredient_ids: [100],
            },
            {
              slug: "rhodiola-rosea",
              title: "Rhodiola rosea",
              summary: "Anpassung bei Stress und Tagesmüdigkeit.",
              reviewed_at: "2026-06-02T14:45:00Z",
              updated_at: "2026-06-03T08:00:00Z",
              sources_count: 4,
              ingredients: [{ ingredient_id: 101, name: "Rhodiola rosea" }],
              ingredient_ids: [101],
            },
            {
              slug: "gruen-tee-egcg",
              title: "EGCG",
              summary: "Grüner Tee und Polyphenole.",
              reviewed_at: "2026-06-02T14:45:00Z",
              updated_at: "2026-06-03T08:00:00Z",
              sources_count: 4,
              ingredients: [{ ingredient_id: 102, name: "EGCG" }],
              ingredient_ids: [102],
            },
          ],
          total: 5,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: /Alles über Vitamine/i })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [fetchUrl, fetchOptions] = fetchMock.mock.calls[0];
    expect(String(fetchUrl)).toMatch(/\/api\/knowledge$/);
    expect(fetchOptions).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));

    const stats = Array.from(document.querySelectorAll(".knowledge-overview .db-stat")).map((stat) =>
      stat.textContent?.replace(/\s+/g, ""),
    );
    expect(stats).toEqual(["89Wirkstoffe", "10Kategorien", "5ausführlicheArtikel"]);
    expect(screen.getByRole("button", { name: /Alle\s*89/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Vitamine\s*15/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Spurenelemente\s*7/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Aminosäuren\s*&\s*Proteine\s*16/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sonstige\s*9/ })).toBeTruthy();

    const vitamins = screen.getByTestId("knowledge-category-vitamine");
    const vitaminDLink = within(vitamins).getByRole("link", { name: /Vitamin D/ });
    expect(vitaminDLink.getAttribute("href")).toBe("/wissen/vitamin-d");
    expect(within(vitamins).queryByText("Vitamin D: Warum Sonne, Knochen und Calcium zusammengehört")).toBeNull();
    expect(within(vitaminDLink).getByText("fettlöslich")).toBeTruthy();
    expect(within(vitaminDLink).getByText("Artikel lesen")).toBeTruthy();

    const proteins = screen.getByTestId("knowledge-category-aminosaeuren_proteine");
    const kreatinLink = within(proteins).getByRole("link", { name: /Kreatin/ });
    expect(kreatinLink.getAttribute("href")).toBe("/wissen/creatin");

    const herbs = screen.getByTestId("knowledge-category-pflanzenstoffe_extrakte");
    expect(within(herbs).getByRole("link", { name: /Grüner Tee/ })).toBeTruthy();

    const fats = screen.getByTestId("knowledge-category-fettsaeuren");
    const mctCard = within(fats).getByRole("link", { name: /MCT-Öl/ });
    expect(mctCard.getAttribute("href")).toBe("/wissen/mct-oel");

    expect(document.body.textContent).not.toContain(["Artikel", "da"].join(" "));
  });

  it("supports required synonyms and parenthetical names when mapping published articles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            articles: [
              {
                slug: "weihrauch",
                title: "Boswellia",
                summary: "Harzextrakt aus dem Weihrauch-Baum.",
                reviewed_at: "2026-06-02T14:45:00Z",
                updated_at: "2026-06-01T08:00:00Z",
                sources_count: 3,
                ingredients: [{ ingredient_id: 2, name: "Weihrauch" }],
                ingredient_ids: [2],
              },
              {
                slug: "hericium",
                title: "Hericium erinaceus",
                summary: "Löwenmähne als Pilzart.",
                reviewed_at: "2026-06-02T14:45:00Z",
                updated_at: "2026-06-01T08:00:00Z",
                sources_count: 5,
                ingredients: [{ ingredient_id: 3, name: "Löwenmähne" }],
                ingredient_ids: [3],
              },
              {
                slug: "silymarin",
                title: "Silymarin",
                summary: "Mariendistelsekret, bekannt als Mariendistel.",
                reviewed_at: "2026-06-02T14:45:00Z",
                updated_at: "2026-06-01T08:00:00Z",
                sources_count: 2,
                ingredients: [{ ingredient_id: 4, name: "Silymarin" }],
                ingredient_ids: [4],
              },
            ],
            total: 3,
          }),
      }),
    );

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const healPills = await screen.findByTestId("knowledge-category-heilpilze");
    expect(within(healPills).getByRole("link", { name: /Löwenmähne/ }).getAttribute("href")).toBe("/wissen/hericium");

    const plantCards = screen.getByTestId("knowledge-category-pflanzenstoffe_extrakte");
    expect(within(plantCards).getByRole("link", { name: /Mariendistel/ }).getAttribute("href")).toBe("/wissen/silymarin");

    const boswel = screen.getByTestId("knowledge-category-pflanzenstoffe_extrakte");
    expect(within(boswel).getByRole("link", { name: /Boswellia/ }).getAttribute("href")).toBe("/wissen/weihrauch");
  });

  it("keeps unfinished cards visible as disabled coming-soon cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ articles: [], total: 0 }),
      }),
    );

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const vitaminACard = await screen.findByText("Vitamin A");
    const card = vitaminACard.closest(".nutri");

    expect(card?.classList.contains("coming")).toBe(true);
    expect(card?.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByText("Bald").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Vitamin A/ })).toBeNull();

    const zeolithCard = screen.getByText("Zeolith").closest(".nutri");
    expect(zeolithCard?.classList.contains("coming")).toBe(true);
    expect(zeolithCard?.getAttribute("aria-disabled")).toBe("true");
    expect(within(zeolithCard as HTMLElement).getByText("Bald")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Zeolith/ })).toBeNull();
  });

  it("shows DGE and study badges from recommendation coverage on ready and coming-soon cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            articles: [
              {
                slug: "vitamin-d",
                title: "Vitamin D",
                summary: "Sonne und Knochen.",
                reviewed_at: "2026-06-02T14:45:00Z",
                updated_at: "2026-06-03T08:00:00Z",
                sources_count: 8,
                ingredients: [{ ingredient_id: 11, name: "Vitamin D" }],
                ingredient_ids: [11],
              },
            ],
            nutrient_statuses: [
              { ingredient_id: 11, name: "Vitamin D", has_dge: true, has_studies: true },
              { ingredient_id: 12, name: "Vitamin B1", has_dge: true, has_studies: false },
            ],
            total: 1,
          }),
      }),
    );

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const vitaminDLink = await screen.findByRole("link", { name: /Vitamin D/ });
    expect(within(vitaminDLink).getByText("DGE")).toBeTruthy();
    expect(within(vitaminDLink).getByText("Studien")).toBeTruthy();
    expect(within(vitaminDLink).queryByText("Bald")).toBeNull();

    const vitaminB1Card = screen.getByText("Vitamin B1").closest(".nutri");
    expect(vitaminB1Card).toBeTruthy();
    expect(within(vitaminB1Card as HTMLElement).getByText("Bald")).toBeTruthy();
    expect(within(vitaminB1Card as HTMLElement).getByText("DGE")).toBeTruthy();
    expect(within(vitaminB1Card as HTMLElement).queryByText("Studien")).toBeNull();
  });

  it("shows study badges from nutrient statuses for published single-study coverage without study dose values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            articles: [
              {
                slug: "eisen",
                title: "Eisen",
                summary: "Spurenelementartikel",
                reviewed_at: "2026-06-13T14:45:00Z",
                updated_at: "2026-06-13T14:45:00Z",
                sources_count: 25,
                ingredients: [{ ingredient_id: 45, name: "Eisen" }],
                ingredient_ids: [45],
              },
              {
                slug: "kupfer",
                title: "Kupfer",
                summary: "Spurenelementartikel",
                reviewed_at: "2026-06-19T14:45:00Z",
                updated_at: "2026-06-19T14:45:00Z",
                sources_count: 26,
                ingredients: [{ ingredient_id: 46, name: "Kupfer" }],
                ingredient_ids: [46],
              },
              {
                slug: "magnesium",
                title: "Magnesium",
                summary: "Mineralstoffartikel",
                reviewed_at: "2026-06-04T14:45:00Z",
                updated_at: "2026-06-04T14:45:00Z",
                sources_count: 3,
                ingredients: [{ ingredient_id: 3, name: "Magnesium bisglycinat" }],
                ingredient_ids: [3],
              },
            ],
            nutrient_statuses: [
              { ingredient_id: "3", name: "Mg coverage", has_dge: false, has_studies: true },
              { ingredient_id: 3, name: "Magnesium", has_dge: true, has_studies: false },
              { ingredient_id: 45, name: "Eisen", has_dge: true, has_studies: true },
              { ingredient_id: 46, name: "Kupfer", has_dge: true, has_studies: true },
            ],
            total: 3,
          }),
      }),
    );

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const traceElements = await screen.findByTestId("knowledge-category-spurenelemente");
    const eisenCard = within(traceElements).getByRole("link", { name: /Eisen/ });
    const kupferCard = within(traceElements).getByRole("link", { name: /Kupfer/ });
    const minerals = screen.getByTestId("knowledge-category-mineralstoffe");
    const magnesiumCard = within(minerals).getByRole("link", { name: /Magnesium/ });

    expect(within(magnesiumCard).getByText("Studien")).toBeTruthy();
    expect(within(magnesiumCard).getByText("DGE")).toBeTruthy();
    expect(within(eisenCard).getByText("Studien")).toBeTruthy();
    expect(within(eisenCard).getByText("DGE")).toBeTruthy();
    expect(within(kupferCard).getByText("Studien")).toBeTruthy();
    expect(within(kupferCard).getByText("DGE")).toBeTruthy();
  });

  it("keeps Krillöl and Omega-3 cards mapped to their own ingredient articles and badges", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            articles: [
              {
                slug: "krilloel",
                title: "Krillöl: Was die rote Omega-3-Quelle wirklich ausmacht",
                summary: "Krillöl-Hauptartikel",
                reviewed_at: "2026-07-10T11:55:13Z",
                updated_at: "2026-07-10T11:55:13Z",
                sources_count: 13,
                ingredients: [{ ingredient_id: 114, name: "Krillöl" }],
                ingredient_ids: [114],
              },
              {
                slug: "omega-3",
                title: "Omega-3: Warum Zellhüllen, Herz und Gehirn davon abhängen",
                summary: "Omega-3-Hauptartikel",
                reviewed_at: "2026-07-08T18:28:47Z",
                updated_at: "2026-07-08T18:28:47Z",
                sources_count: 34,
                ingredients: [{ ingredient_id: 10, name: "Omega-3" }],
                ingredient_ids: [10],
              },
            ],
            nutrient_statuses: [
              { ingredient_id: 10, name: "Omega-3", has_dge: true, has_studies: true },
              { ingredient_id: 114, name: "Krillöl", has_dge: false, has_studies: true },
            ],
            total: 2,
          }),
      }),
    );

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const fats = await screen.findByTestId("knowledge-category-fettsaeuren");
    const omega3Card = within(fats).getByRole("link", { name: /^ω3\s+Omega-3/ });
    const krilloelCard = within(fats).getByRole("link", { name: /^Krill\s+Krill/ });

    expect(omega3Card.getAttribute("href")).toBe("/wissen/omega-3");
    expect(within(omega3Card).getByText("Studien")).toBeTruthy();
    expect(within(omega3Card).getByText("DGE")).toBeTruthy();
    expect(krilloelCard.getAttribute("href")).toBe("/wissen/krilloel");
    expect(within(krilloelCard).getByText("Studien")).toBeTruthy();
    expect(within(krilloelCard).queryByText("DGE")).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: /suchen/i }), { target: { value: "krilloel" } });
    expect(screen.getByRole("link", { name: /^Krill\s+Krill/ }).getAttribute("href")).toBe("/wissen/krilloel?q=krilloel");
    expect(screen.queryByRole("link", { name: /^ω3\s+Omega-3/ })).toBeNull();
  });

  it("searches nutrient descriptions and aliases from the template", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            articles: [],
            total: 0,
          }),
      }),
    );

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    await screen.findByText("Vitamin A");
    fireEvent.change(screen.getByLabelText("Wirkstoff suchen"), { target: { value: "Polysaccharide" } });
    expect(screen.getByText("Beta-Glucane")).toBeTruthy();
    expect(screen.queryByText("Vitamin D")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Suche löschen/ }));
    fireEvent.change(screen.getByLabelText("Wirkstoff suchen"), { target: { value: "Creatin" } });
    expect(screen.getByText("Kreatin")).toBeTruthy();
    expect(screen.queryByText("Kollagen")).toBeNull();
  });

  it("does not match a nutrient only because summary mentions it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            articles: [
              {
                slug: "chiasamen",
                title: "Chiasamen als Samenquelle",
                summary: "Auch Omega-3 und MCT-Öl werden in diesem Kontext diskutiert.",
                reviewed_at: "2026-06-02T14:45:00Z",
                updated_at: "2026-06-01T08:00:00Z",
                sources_count: 3,
                ingredients: [{ ingredient_id: 4, name: "Chiasamen" }],
                ingredient_ids: [4],
              },
            ],
            total: 1,
          }),
      }),
    );

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const vitaminACard = await screen.findByText("Vitamin A");
    const vitaminsGrid = vitaminACard.closest(".cat-block");
    expect(vitaminsGrid?.querySelector(".nutri.is-ready")).toBeNull();
    const omega3Link = screen.queryByRole("link", { name: /Omega-3/ });
    expect(omega3Link).toBeNull();
  });

  it("renders the template cards while the API is still loading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Wissensdatenbank wird geladen")).toBeNull();
    expect(screen.getByText("Vitamin A")).toBeTruthy();
    expect(screen.getByText("Vitamin B1")).toBeTruthy();
  });

  it("renders exactly every active ingredient supplied by the central overview", async () => {
    const nutrientStatuses = Array.from({ length: 92 }, (_, index) => ({
      ingredient_id: index + 1,
      name: `Zentraler Wirkstoff ${index + 1}`,
      category: index % 2 === 0 ? "other" : "mineral",
      description: `Zentraler Kurztext ${index + 1}`,
      has_dge: false,
      has_studies: false,
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ articles: [], nutrient_statuses: nutrientStatuses, total: 0 }),
    }));

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Zentraler Wirkstoff 92")).toBeTruthy();
    expect(document.querySelectorAll(".knowledge-overview .nutri")).toHaveLength(92);
    expect(Array.from(document.querySelectorAll(".knowledge-overview .db-stat"))[0].textContent?.replace(/\s+/g, ""))
      .toBe("92Wirkstoffe");
    expect(screen.getByText("Zentraler Kurztext 1")).toBeTruthy();
  });

  it("shows one understandable error with retry and does not add a false empty state", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("interne technische Nachricht"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          articles: [],
          nutrient_statuses: [{
            ingredient_id: 1,
            name: "Wieder geladen",
            category: "other",
            description: "Zentrale Beschreibung",
            has_dge: false,
            has_studies: false,
          }],
          total: 0,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("Die Wissensdatenbank konnte gerade nicht geladen werden");
    expect(error.textContent).not.toContain("interne technische Nachricht");
    expect(screen.queryByRole("heading", { name: "Nichts gefunden" })).toBeNull();
    expect(document.querySelectorAll(".knowledge-overview .nutri")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Alle\s*89/ })).toBeNull();
    const errorStats = Array.from(document.querySelectorAll(".knowledge-overview .db-stat")).map((stat) =>
      stat.textContent?.replace(/\s+/g, ""),
    );
    expect(errorStats).toEqual([
      "–Wirkstoffezurzeitnichtverfügbar",
      "10Kategorien",
      "–Artikelzurzeitnichtverfügbar",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Wieder geladen")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.querySelectorAll(".knowledge-overview .nutri")).toHaveLength(1);
    expect(Array.from(document.querySelectorAll(".knowledge-overview .db-stat"))[0].textContent?.replace(/\s+/g, ""))
      .toBe("1Wirkstoffe");
  });

  it("reuses the HTML-started overview request instead of starting a second fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.__knowledgeOverviewRequest = Promise.resolve(new Response(JSON.stringify({
      articles: [{
        slug: "vitamin-a",
        title: "Vitamin A",
        summary: "Vitamin-A-Artikel",
        sources_count: 2,
        ingredients: [{ ingredient_id: 1, name: "Vitamin A", sort_order: 0 }],
        ingredient_ids: [1],
      }],
      nutrient_statuses: [],
      total: 1,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /Vitamin A/ })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consumes the HTML-started request once and fetches again after a remount", async () => {
    const fetchMock = stubKnowledgeFetch([]);
    window.__knowledgeOverviewRequest = Promise.resolve(new Response(JSON.stringify({
      articles: [],
      nutrient_statuses: [],
      total: 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const first = render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );
    await screen.findByText("Vitamin A");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.__knowledgeOverviewRequest).toBeUndefined();

    first.unmount();
    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("does not expose session-cached article state during a cfcheck readback", () => {
    window.sessionStorage.setItem("knowledge-overview.v1", JSON.stringify({
      cached_at: Date.now(),
      payload: {
        articles: [{
          slug: "vitamin-a",
          title: "Vitamin A",
          sources_count: 2,
          ingredients: [{ ingredient_id: 1, name: "Vitamin A", sort_order: 0 }],
          ingredient_ids: [1],
        }],
        nutrient_statuses: [],
        total: 1,
      },
    }));
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));

    render(
      <MemoryRouter initialEntries={["/wissen?cfcheck=sha256%3Areadback"]}>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /Vitamin A/ })).toBeNull();
    expect(screen.getByText("Vitamin A")).toBeTruthy();
  });

  it("initializes category and search from URL search params", async () => {
    stubKnowledgeFetch([]);

    render(
      <MemoryRouter initialEntries={["/wissen?category=mineralstoffe&q=magnesium"]}>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("magnesium")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Mineralstoffe\s*4/ }).className).toContain("is-active");
    expect(screen.queryByTestId("knowledge-category-vitamine")).toBeNull();
    expect(screen.getByTestId("knowledge-category-mineralstoffe")).toBeTruthy();
  });

  it("adds the current category and search params to ready article links", async () => {
    stubKnowledgeFetch([
      {
        slug: "magnesium",
        title: "Magnesium",
        summary: "Mineralstoffartikel",
        reviewed_at: "2026-06-02T14:45:00Z",
        updated_at: "2026-06-03T08:00:00Z",
        sources_count: 6,
        ingredients: [{ ingredient_id: 3, name: "Magnesium" }],
        ingredient_ids: [3],
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/wissen?category=mineralstoffe&q=magnesium"]}>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const minerals = await screen.findByTestId("knowledge-category-mineralstoffe");
    const magnesiumLink = within(minerals).getByRole("link", { name: /Magnesium/ });
    expect(magnesiumLink.getAttribute("href")).toBe("/wissen/magnesium?category=mineralstoffe&q=magnesium");
  });

  it("propagates cfcheck to the API and keeps it across overview navigation", async () => {
    const fetchMock = stubKnowledgeFetch([
      {
        slug: "magnesium",
        title: "Magnesium",
        summary: "Mineralstoffartikel",
        sources_count: 6,
        ingredients: [{ ingredient_id: 3, name: "Magnesium" }],
        ingredient_ids: [3],
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/wissen?category=mineralstoffe&q=magnesium&cfcheck=sha256%3Aabc123"]}>
        <Routes>
          <Route
            path="/wissen"
            element={
              <>
                <KnowledgeOverviewPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const minerals = await screen.findByTestId("knowledge-category-mineralstoffe");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/knowledge\?cfcheck=sha256%3Aabc123$/);
    expect(within(minerals).getByRole("link", { name: /Magnesium/ }).getAttribute("href"))
      .toBe("/wissen/magnesium?category=mineralstoffe&q=magnesium&cfcheck=sha256%3Aabc123");

    fireEvent.click(screen.getByRole("button", { name: /Suche/ }));
    expect(screen.getByLabelText("Aktuelle URL").textContent)
      .toBe("/wissen?category=mineralstoffe&cfcheck=sha256%3Aabc123");
  });

  it("prefetches a ready article when its card is approached", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/api/knowledge/magnesium")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            article: {
              slug: "magnesium",
              title: "Magnesium",
              summary: "Mineralstoffartikel",
              body: "Vollständiger Artikel",
              sources: [],
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          articles: [{
            slug: "magnesium",
            title: "Magnesium",
            summary: "Mineralstoffartikel",
            sources_count: 6,
            ingredients: [{ ingredient_id: 3, name: "Magnesium" }],
            ingredient_ids: [3],
          }],
          nutrient_statuses: [],
          total: 1,
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <KnowledgeOverviewPage />
      </MemoryRouter>,
    );

    const minerals = await screen.findByTestId("knowledge-category-mineralstoffe");
    fireEvent.pointerEnter(within(minerals).getByRole("link", { name: /Magnesium/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/api\/knowledge\/magnesium$/);
    expect(JSON.parse(window.sessionStorage.getItem("knowledge-article.v1:magnesium") ?? "{}"))
      .toMatchObject({
        cached_at: expect.any(Number),
        article: { slug: "magnesium", body: "Vollständiger Artikel" },
      });
  });

  it("removes q when clearing search while keeping the selected category in the URL", async () => {
    stubKnowledgeFetch([]);

    render(
      <MemoryRouter initialEntries={["/wissen?category=mineralstoffe&q=magnesium"]}>
        <Routes>
          <Route
            path="/wissen"
            element={
              <>
                <KnowledgeOverviewPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByDisplayValue("magnesium");
    fireEvent.click(screen.getByRole("button", { name: /Suche/ }));

    expect(screen.getByLabelText("Aktuelle URL").textContent).toBe("/wissen?category=mineralstoffe");
    expect((screen.getByRole("textbox", { name: /suchen/i }) as HTMLInputElement).value).toBe("");
  });

  it("keeps overview search params on the article back link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            article: {
              slug: "magnesium",
              title: "Magnesium",
              summary: "Mineralstoffartikel",
              body: "Artikeltext",
              sources: [],
            },
          }),
      }),
    );

    render(
      <MemoryRouter initialEntries={["/wissen/magnesium?category=mineralstoffe&q=magnesium"]}>
        <Routes>
          <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const backLink = await screen.findByRole("link", { name: /Zur/ });
    expect(backLink.getAttribute("href")).toBe("/wissen?category=mineralstoffe&q=magnesium");
  });
});
