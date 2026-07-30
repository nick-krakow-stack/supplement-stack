import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiPath } from '../api/base';
import type { KnowledgeArticleOverviewItem, KnowledgeNutrientStatus } from '../types';

type KnowledgeOverviewResponse = {
  articles: KnowledgeArticleOverviewItem[];
  nutrient_statuses?: KnowledgeNutrientStatus[];
  total?: number;
};

declare global {
  interface Window {
    __knowledgeOverviewRequest?: Promise<Response>;
  }
}

const OVERVIEW_SESSION_CACHE_KEY = 'knowledge-overview.v1';
const OVERVIEW_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedKnowledgeOverview = {
  cached_at: number;
  payload: KnowledgeOverviewResponse;
};

function readCachedKnowledgeOverview(): KnowledgeOverviewResponse | null {
  try {
    const raw = window.sessionStorage.getItem(OVERVIEW_SESSION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedKnowledgeOverview;
    if (!Number.isFinite(cached.cached_at) || Date.now() - cached.cached_at > OVERVIEW_SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(OVERVIEW_SESSION_CACHE_KEY);
      return null;
    }
    return cached.payload && Array.isArray(cached.payload.articles) ? cached.payload : null;
  } catch {
    return null;
  }
}

function writeCachedKnowledgeOverview(payload: KnowledgeOverviewResponse): void {
  try {
    window.sessionStorage.setItem(OVERVIEW_SESSION_CACHE_KEY, JSON.stringify({ cached_at: Date.now(), payload }));
  } catch {
    // The overview remains fully functional when storage is unavailable.
  }
}

type CategoryKey =
  | 'vitamine'
  | 'mineralstoffe'
  | 'spurenelemente'
  | 'aminosaeuren_proteine'
  | 'fettsaeuren'
  | 'pflanzenstoffe_extrakte'
  | 'heilpilze'
  | 'enzyme'
  | 'probiotika'
  | 'sonstige';

type Solubility = 'fat' | 'water';

type CategoryConfig = {
  key: CategoryKey;
  label: string;
  cssClass: string;
  icon: IconKey;
  description: string;
};

type NutrientTemplate = {
  category: CategoryKey;
  name: string;
  abbr: string;
  icon: IconKey;
  description: string;
  solubility?: Solubility;
  aliases?: string[];
};

type NutrientCard = NutrientTemplate & {
  article: KnowledgeArticleOverviewItem | null;
  status: KnowledgeNutrientStatus | null;
};

type IconKey = keyof typeof ICON_PATHS;

const ICON_PATHS = {
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  drop: '<path d="M12 3c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12Z"/>',
  bone: '<path d="M12 2a4 4 0 0 1 4 4c0 3-2 4-2 6s2 3 2 6a4 4 0 0 1-8 0c0-3 2-4 2-6s-2-3-2-6a4 4 0 0 1 4-4Z"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
  leaf: '<path d="M5 19c5-2 9-6 11-11 1 5-2 12-8 12-2 0-3-1-3-1Z"/><path d="M16 8c1-2 3-3 3-3"/>',
  heart: '<path d="M19 5a5 5 0 0 0-7 0l-0 0-0-0a5 5 0 0 0-7 7l7 7 7-7a5 5 0 0 0 0-7Z"/>',
  brain: '<path d="M12 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 0 3 3 0 0 0 2-5 3 3 0 0 0-2-5 3 3 0 0 0-3-3Z"/><path d="M12 4v16"/>',
  muscle: '<path d="M4 7c4-3 12-3 16 0 1 4-1 9-5 10-1 .3-2 1-3 2-1-1-2-1.7-3-2-4-1-6-6-5-10Z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 16h10"/>',
  atom: '<circle cx="12" cy="12" r="2"/><path d="M12 2a14 6 0 0 0 0 20 14 6 0 0 0 0-20Z" transform="rotate(60 12 12)"/><path d="M12 2a14 6 0 0 0 0 20 14 6 0 0 0 0-20Z" transform="rotate(-60 12 12)"/>',
  wave: '<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  blood: '<path d="M12 3c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12Z"/><path d="M12 17a2 2 0 0 0 2-2"/>',
  pulse: '<path d="M2 12h4l2-6 4 12 2-6h6"/>',
  spark: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  sprout: '<path d="M12 22V11M12 11C12 7 9 4 4 4c0 4 3 7 8 7ZM12 13c0-4 3-7 8-7 0 4-3 7-8 7Z"/>',
  fish: '<path d="M3 12c4-5 11-5 15 0-4 5-11 5-15 0Z"/><path d="M18 12c1.5-1.5 3-1.5 3-1.5s0 3-3 1.5ZM8 11h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
} as const;

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'vitamine',
    label: 'Vitamine',
    cssClass: 'c-vit',
    icon: 'spark',
    description: 'Stoffe, die der Körper braucht, aber kaum selbst herstellen kann',
  },
  {
    key: 'mineralstoffe',
    label: 'Mineralstoffe',
    cssClass: 'c-min',
    icon: 'atom',
    description: 'Mengenelemente - der Körper braucht sie in größeren Mengen',
  },
  {
    key: 'spurenelemente',
    label: 'Spurenelemente',
    cssClass: 'c-spur',
    icon: 'flask',
    description: 'Mineralstoffe, von denen nur winzige Mengen nötig sind',
  },
  {
    key: 'aminosaeuren_proteine',
    label: 'Aminosäuren & Proteine',
    cssClass: 'c-amino-protein',
    icon: 'muscle',
    description: 'Bausteine aus Eiweiß für Training, Regeneration und Stoffwechsel',
  },
  {
    key: 'fettsaeuren',
    label: 'Fettsäuren',
    cssClass: 'c-fett',
    icon: 'fish',
    description: 'Bausteine von Fetten - manche sind lebensnotwendig',
  },
  {
    key: 'pflanzenstoffe_extrakte',
    label: 'Pflanzenstoffe & Extrakte',
    cssClass: 'c-pflz-extrakt',
    icon: 'sprout',
    description: 'Sekundäre Pflanzenstoffe aus Heilpflanzen und Extrakten',
  },
  {
    key: 'heilpilze',
    label: 'Heilpilze',
    cssClass: 'c-heilpilz',
    icon: 'leaf',
    description: 'Heilpilze und funktionale Pilzextrakte',
  },
  {
    key: 'enzyme',
    label: 'Enzyme',
    cssClass: 'c-enzyme',
    icon: 'flask',
    description: 'Enzyme für Verdauung und Stoffwechselprozesse',
  },
  {
    key: 'probiotika',
    label: 'Probiotika',
    cssClass: 'c-probiotika',
    icon: 'heart',
    description: 'Nützliche Mikroorganismen und ihre Anwendungen',
  },
  {
    key: 'sonstige',
    label: 'Sonstige',
    cssClass: 'c-sonstige',
    icon: 'wave',
    description: 'Weitere wichtige Wirkstoffgruppen außerhalb der Hauptkategorien',
  },
];

const NUTRIENTS: NutrientTemplate[] = [
  { category: 'vitamine', name: 'Vitamin A', abbr: 'A', icon: 'eye', solubility: 'fat', description: 'Wichtig für Augen, Haut, Schleimhäute und Abwehr.' },
  { category: 'vitamine', name: 'Vitamin B1', abbr: 'B1', icon: 'bolt', solubility: 'water', description: 'Hilft bei der Energiegewinnung.', aliases: ['Thiamin'] },
  { category: 'vitamine', name: 'Vitamin B2', abbr: 'B2', icon: 'bolt', solubility: 'water', description: 'Wichtig für den Stoffwechsel.', aliases: ['Riboflavin'] },
  { category: 'vitamine', name: 'Vitamin B3', abbr: 'B3', icon: 'bolt', solubility: 'water', description: 'Beteiligt an Redoxreaktionen und Energie.', aliases: ['Niacin'] },
  { category: 'vitamine', name: 'Vitamin B5', abbr: 'B5', icon: 'bolt', solubility: 'water', description: 'Bedeutend für Coenzym-A und Energieprozesse.', aliases: ['Pantothensäure'] },
  { category: 'vitamine', name: 'Vitamin B6', abbr: 'B6', icon: 'pulse', solubility: 'water', description: 'Wichtig für Proteinstoffwechsel und Nerven.' },
  { category: 'vitamine', name: 'Vitamin B7', abbr: 'B7', icon: 'spark', solubility: 'water', description: 'Beteiligt bei Haut, Haaren und Hautschutz.', aliases: ['Biotin'] },
  { category: 'vitamine', name: 'Vitamin B9', abbr: 'B9', icon: 'sprout', solubility: 'water', description: 'Bedeutend für Zellteilung und Schwangerschaft.', aliases: ['Folsäure', 'Folat'] },
  { category: 'vitamine', name: 'Vitamin B12', abbr: 'B12', icon: 'blood', solubility: 'water', description: 'Unterstützt Blutbildung und Nervenfunktion.' },
  { category: 'vitamine', name: 'Vitamin C', abbr: 'C', icon: 'shield', solubility: 'water', description: 'Schützt Zellen und unterstützt die Immunfunktion.' },
  { category: 'vitamine', name: 'Vitamin D', abbr: 'D', icon: 'sun', solubility: 'fat', description: 'Wichtig für Knochen und den Calciumstoffwechsel.' },
  { category: 'vitamine', name: 'Vitamin E', abbr: 'E', icon: 'drop', solubility: 'fat', description: 'Unterstützt den Zellschutz vor oxidativem Stress.' },
  { category: 'vitamine', name: 'Vitamin K', abbr: 'K', icon: 'leaf', solubility: 'fat', description: 'Bedeutend für Blutgerinnung und Knochenstoffwechsel.' },
  { category: 'vitamine', name: 'Cholin', abbr: 'Cho', icon: 'atom', solubility: 'water', description: 'Beteiligt an Leberstoffwechsel und Gehirnfunktionen.' },
  { category: 'vitamine', name: 'Inositol', abbr: 'Ins', icon: 'atom', solubility: 'water', description: 'Spielt im Zellstoffwechsel und Stresskontext eine Rolle.' },

  { category: 'mineralstoffe', name: 'Calcium', abbr: 'Ca', icon: 'bone', description: 'Baustoff für Knochen und Zähne.' },
  { category: 'mineralstoffe', name: 'Kalium', abbr: 'K', icon: 'heart', description: 'Regelt Nerven- und Herzfunktionen.' },
  { category: 'mineralstoffe', name: 'Magnesium', abbr: 'Mg', icon: 'muscle', description: 'Wichtig für Muskeln, Nerven und Schlafqualität.' },
  { category: 'mineralstoffe', name: 'Elektrolyte', abbr: 'Elektrolyte', icon: 'wave', description: 'Spielen für den Wasser- und Ionenhaushalt zusammen.' },

  { category: 'spurenelemente', name: 'Chrom', abbr: 'Cr', icon: 'spark', description: 'Wird bei der Glukosestoffwechsellage diskutiert.' },
  { category: 'spurenelemente', name: 'Eisen', abbr: 'Fe', icon: 'blood', description: 'Zentrale Rolle beim Sauerstofftransport im Körper.' },
  { category: 'spurenelemente', name: 'Jod', abbr: 'I', icon: 'spark', description: 'Wichtig für eine reguläre Schilddrüsenfunktion.', aliases: ['Iod'] },
  { category: 'spurenelemente', name: 'Selen', abbr: 'Se', icon: 'drop', description: 'Bedeutet als Cofaktor im antioxidativen Bereich.' },
  { category: 'spurenelemente', name: 'Kupfer', abbr: 'Cu', icon: 'flask', description: 'Beteiligt an antioxidativen Enzymwegen.' },
  { category: 'spurenelemente', name: 'Mangan', abbr: 'Mn', icon: 'atom', description: 'Mitbeteiligt an verschiedenen Enzymkaskaden.' },
  { category: 'spurenelemente', name: 'Zink', abbr: 'Zn', icon: 'pulse', description: 'Unterstützt Immunsystem, Haut und Wundheilung.' },

  { category: 'aminosaeuren_proteine', name: 'BCAA', abbr: 'BCAA', icon: 'muscle', description: 'Verzweigtkettige Aminosäuren aus Sportkontexten.' },
  { category: 'aminosaeuren_proteine', name: 'Beta-Alanin', abbr: 'ßA', icon: 'muscle', description: 'Wird oft im Bereich Leistungs- und Ausdauertraining genutzt.', aliases: ['Beta Alanin'] },
  { category: 'aminosaeuren_proteine', name: 'Glycin', abbr: 'Gly', icon: 'heart', description: 'Kleines Baustein-Eiweißmolekül mit Schlaf- und Regenerationsbezug.' },
  { category: 'aminosaeuren_proteine', name: 'Glutathion', abbr: 'GSH', icon: 'spark', description: 'Tripeptid mit Bedeutung im antioxidativen Schutz.' },
  { category: 'aminosaeuren_proteine', name: 'Kollagen', abbr: 'Klg', icon: 'bone', description: 'Bietet strukturelle Bausteine für Haut und Bindegewebe.' },
  { category: 'aminosaeuren_proteine', name: 'Kreatin', abbr: 'Creat', icon: 'muscle', description: 'Erhöht kurzfristig die Kraftverfügbarkeit.', aliases: ['Creatin'] },
  { category: 'aminosaeuren_proteine', name: 'L-Arginin', abbr: 'L-Arg', icon: 'pulse', description: 'Aminosäure mit vaskulärer Relevanz.' },
  { category: 'aminosaeuren_proteine', name: 'L-Carnitin', abbr: 'L-Car', icon: 'wave', description: 'Transportiert Fettsäuren in energieerzeugende Prozesse.' },
  { category: 'aminosaeuren_proteine', name: 'L-Citrullin', abbr: 'L-Cit', icon: 'pulse', description: 'Wirkt im Harnstoffzyklus und Kreislaufregulation.' },
  { category: 'aminosaeuren_proteine', name: 'L-Glutamin', abbr: 'L-Glu', icon: 'heart', description: 'Rolle in Darm- und Belastungsregulationen wird diskutiert.' },
  { category: 'aminosaeuren_proteine', name: 'L-Theanin', abbr: 'L-The', icon: 'brain', description: 'Aminosäure-ähnlicher Stoff für Fokus und Ausgeglichenheit.' },
  { category: 'aminosaeuren_proteine', name: 'L-Tryptophan', abbr: 'L-Trp', icon: 'brain', description: 'Serotonin-assoziierte Aminosäure im Fokus.' },
  { category: 'aminosaeuren_proteine', name: 'L-Tyrosin', abbr: 'L-Tyr', icon: 'brain', description: 'Vorstufe mehrerer Botenstoffe im Stresskontext.' },
  { category: 'aminosaeuren_proteine', name: 'Taurin', abbr: 'Tau', icon: 'drop', description: 'Wirkt bei Hydratation und Herz-Kreislauffokus.' },
  { category: 'aminosaeuren_proteine', name: '5-HTP', abbr: '5-HTP', icon: 'leaf', description: 'Aminoäquivalent mit Relevanz im Serotoninstoffwechsel.' },
  { category: 'aminosaeuren_proteine', name: 'GABA', abbr: 'GABA', icon: 'pulse', description: 'Wirkstoff im Nervensystem mit beruhigender Diskussion.' },

  { category: 'fettsaeuren', name: 'Omega-3', abbr: 'ω3', icon: 'fish', description: 'Entzündungsmodulierende Fettsäuren.', aliases: ['Omega 3'] },
  { category: 'fettsaeuren', name: 'MCT-Öl', abbr: 'MCT', icon: 'drop', description: 'Mittelkettige Triglyzeride für schnelle Energie.' },
  { category: 'fettsaeuren', name: 'Krillöl', abbr: 'Krill', icon: 'fish', description: 'Quelle für langkettige Omega-3-Verbindungen.' },

  { category: 'pflanzenstoffe_extrakte', name: 'Ashwagandha', abbr: 'Asha', icon: 'sprout', description: 'Adaptogener Pflanzenstoff aus dem Ayurveda-Kontext.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Baldrian', abbr: 'Bald', icon: 'leaf', description: 'Traditionell für Abend- und Entspannungsrituale genutzt.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Berberin', abbr: 'Berb', icon: 'leaf', description: 'Pflanzlicher Stoffstoff mit Stoffwechsel-Bezug.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Boswellia (Weihrauch)', abbr: 'Bos', icon: 'sprout', description: 'Extrakt mit klassischer und moderner Anwendung.', aliases: ['Boswellia', 'Weihrauch'] },
  { category: 'pflanzenstoffe_extrakte', name: 'Brennnessel', abbr: 'Br', icon: 'sprout', description: 'Pflanze mit historisch häufiger Nutzung im Alltag.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Chlorella', abbr: 'Chl', icon: 'sprout', description: 'Mikroalge mit möglichem Mikronährstoff-Fokus.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Curcumin', abbr: 'Cur', icon: 'sprout', description: 'Hauptinhaltsstoff von Kurkuma, oft antioxidativ diskutiert.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Ginkgo', abbr: 'Gink', icon: 'sprout', description: 'Traditionell genutzter Pflanzenstoff mit Durchblutungsschwerpunkt.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Ginseng', abbr: 'Gins', icon: 'sprout', description: 'Adaptogener Pflanzenstoff mit Leistungsbezug.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Grapefruitkernextrakt', abbr: 'GSE', icon: 'sprout', description: 'Extrakt aus Fruchtkernanteilen mit Inhaltsstoffdiskussionen.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Grüner Tee (EGCG)', abbr: 'EGCG', icon: 'sprout', description: 'Getränke- und Extraktbezug mit Polyphenolfokus.', aliases: ['EGCG', 'Grüner Tee'] },
  { category: 'pflanzenstoffe_extrakte', name: 'Maca', abbr: 'Maca', icon: 'leaf', description: 'Samtartige Wurzel aus Andenregionen mit Energiefokus.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Mariendistel (Silymarin)', abbr: 'MS', icon: 'leaf', description: 'Traditionelle Leberbegleitwirkung im Fokus.', aliases: ['Mariendistel', 'Silymarin'] },
  { category: 'pflanzenstoffe_extrakte', name: 'Mönchspfeffer', abbr: 'Mö', icon: 'leaf', description: 'Pflanzenstoff mit Fokus im hormonellen Kontext.' },
  { category: 'pflanzenstoffe_extrakte', name: 'OPC', abbr: 'OPC', icon: 'sprout', description: 'Polyphenolische Fraktion, oft aus Traubenkernen.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Pfefferminz', abbr: 'Pfeff', icon: 'leaf', description: 'Pflanzenbestandteil mit unterstützendem Einsatzbereich.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Quercetin', abbr: 'Quer', icon: 'leaf', description: 'Flavonoid mit Wirkung auf Entzündung und Reizschutz.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Resveratrol', abbr: 'Res', icon: 'leaf', description: 'Polyphenol vor allem in Weintraubenteilen besprochen.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Rhodiola Rosea', abbr: 'Rho', icon: 'sprout', description: 'Pflanzenadaptogen mit Stress- und Ermüdungsbezug.', aliases: ['Rhodiola rosea'] },
  { category: 'pflanzenstoffe_extrakte', name: 'Sägepalme', abbr: 'Säg', icon: 'leaf', description: 'Wichtiger Kontext in Prostata- und Harnwegsdebatten.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Schwarzkümmelöl', abbr: 'SK', icon: 'drop', description: 'Öl mit traditionellen Wirkungsdebatten.' },
  { category: 'pflanzenstoffe_extrakte', name: 'Spirulina', abbr: 'Spi', icon: 'sprout', description: 'Mikroalgenprodukt mit Nährstoff- und Farbstoffbezug.' },

  { category: 'heilpilze', name: 'Reishi', abbr: 'Rei', icon: 'leaf', description: 'Reishi-Pilz im Kontext von Stress und Immunmodulation.' },
  { category: 'heilpilze', name: 'Cordyceps', abbr: 'Cor', icon: 'leaf', description: 'Pilz mit möglichem Ausdauer- und Energiebezug.' },
  { category: 'heilpilze', name: 'Löwenmähne (Hericium)', abbr: 'Löw', icon: 'leaf', description: 'Pilz mit Nervengesundheits-Fokus.', aliases: ['Hericium'] },
  { category: 'heilpilze', name: 'Chaga', abbr: 'Cha', icon: 'leaf', description: 'Spezifischer Pilz für antioxidative Diskussionen.' },
  { category: 'heilpilze', name: 'Maitake', abbr: 'Mai', icon: 'leaf', description: 'Pilz mit möglicher Immunfokuslage.' },
  { category: 'heilpilze', name: 'Shiitake', abbr: 'Shi', icon: 'leaf', description: 'Bekannte Speisepilzart mit Ergänzungsbezug.' },
  { category: 'heilpilze', name: 'Birkenporling', abbr: 'Bir', icon: 'leaf', description: 'Klassischer Heilpilz aus nordischer Waldtradition.' },
  { category: 'heilpilze', name: 'Zunderschwamm', abbr: 'Zun', icon: 'leaf', description: 'Wird in traditionellen Pilzkontexten eingesetzt.' },

  { category: 'enzyme', name: 'Bromelain', abbr: 'Brom', icon: 'flask', description: 'Enzym mit Fokus auf Verdauungsprozesse.' },
  { category: 'enzyme', name: 'Papain', abbr: 'Pap', icon: 'flask', description: 'Proteinspaltendes Enzym aus Papaya-Frucht.' },
  { category: 'enzyme', name: 'Laktase', abbr: 'Lakt', icon: 'flask', description: 'Verdaut Laktose im Sinne der Intoleranzhilfe.' },

  { category: 'probiotika', name: 'Probiotika', abbr: 'Pro', icon: 'heart', description: 'Mischungen lebender nützlicher Keime.' },
  { category: 'probiotika', name: 'Saccharomyces boulardii', abbr: 'SB', icon: 'heart', description: 'Hefebasierter Probiotika-Stamm für den Darmbereich.' },

  { category: 'sonstige', name: 'Glucosamin', abbr: 'Glu', icon: 'bone', description: 'Wird häufig im Gelenk- und Knorpelkontext genutzt.' },
  { category: 'sonstige', name: 'Chondroitin', abbr: 'Chon', icon: 'bone', description: 'Komponente im Kontext von Gelenkunterstützung.' },
  { category: 'sonstige', name: 'Hyaluronsäure', abbr: 'HA', icon: 'drop', description: 'Unterstützt Bindegewebe und Feuchtigkeit im Organismus.' },
  { category: 'sonstige', name: 'MSM', abbr: 'MSM', icon: 'spark', description: 'Organische Schwefelverbindung mit Gelenkkontext.' },
  { category: 'sonstige', name: 'Alpha-Liponsäure', abbr: 'ALA', icon: 'spark', description: 'Enzymatisch relevante antioxidative Verbindung.' },
  { category: 'sonstige', name: 'Coenzym Q10', abbr: 'CoQ10', icon: 'atom', description: 'An der mitochondrialen Energieerzeugung beteiligt.' },
  { category: 'sonstige', name: 'Melatonin', abbr: 'Mel', icon: 'spark', description: 'Beteiligt am Schlaf- und Rhythmusrhythmus.' },
  { category: 'sonstige', name: 'Beta-Glucane', abbr: 'B-Glc', icon: 'leaf', description: 'Polysaccharide mit Fokus auf Immunantworten.' },
  { category: 'sonstige', name: 'Zeolith', abbr: 'Zeo', icon: 'atom', description: 'Silikatmineral, bei dem Bindung im Verdauungstrakt diskutiert wird.' },
];

const CATEGORY_KEYS = new Set<CategoryKey>(CATEGORIES.map((category) => category.key));

function isCategoryKey(value: string | null): value is CategoryKey {
  return value !== null && CATEGORY_KEYS.has(value as CategoryKey);
}

function getActiveCategory(searchParams: URLSearchParams): CategoryKey | 'all' {
  const category = searchParams.get('category');
  return isCategoryKey(category) ? category : 'all';
}

function getSearchQuery(searchParams: URLSearchParams): string {
  return searchParams.get('q') ?? '';
}

function getCacheCheck(searchParams: URLSearchParams): string | null {
  return searchParams.has('cfcheck') ? searchParams.get('cfcheck') ?? '' : null;
}

function buildOverviewSearch(category: CategoryKey | 'all', query: string, cacheCheck: string | null = null): string {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();

  if (category !== 'all') params.set('category', category);
  if (trimmedQuery) params.set('q', query);
  if (cacheCheck !== null) params.set('cfcheck', cacheCheck);

  const search = params.toString();
  return search ? `?${search}` : '';
}

function SvgIcon({ icon, className }: { icon: IconKey; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[icon] }}
    />
  );
}

function normalizeText(value: string): string {
  return value
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ẞ/g, 'SS')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('de-DE');
}

function normalizeSearchText(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
  return normalizeSearchText(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildMatchTerms(value: string): string[] {
  const terms = new Set<string>();
  const normalizedValue = normalizeSearchText(value);
  if (normalizedValue) terms.add(normalizedValue);

  const withoutParentheses = normalizeSearchText(value.replace(/\([^)]*\)/g, ' '));
  if (withoutParentheses) terms.add(withoutParentheses);

  const innerMatches = Array.from(value.matchAll(/\(([^)]*)\)/g), (match) => normalizeSearchText(match[1]));
  innerMatches.forEach((match) => {
    if (match) terms.add(match);
  });

  return [...terms];
}

function extractMatchTerms(nutrient: NutrientTemplate): string[] {
  const terms = new Set<string>();
  [nutrient.name, ...(nutrient.aliases ?? [])].forEach((entry) => {
    buildMatchTerms(entry).forEach((term) => {
      if (term) terms.add(term);
    });
  });

  return [...terms];
}

function hasNormalizedWordBoundaryMatch(haystack: string, needle: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`).test(` ${haystack} `);
}

function ingredientMatchesNutrient(article: KnowledgeArticleOverviewItem, nutrient: NutrientTemplate): boolean {
  const nutrientTerms = extractMatchTerms(nutrient);

  return (article.ingredients ?? []).some((ingredient) => {
    const ingredientName = normalizeSearchText(ingredient.name ?? '');
    if (!ingredientName) return false;

    return nutrientTerms.some((term) => {
      const normalizedSlug = slugify(term);
      return (
        ingredientName === term ||
        slugify(ingredientName) === normalizedSlug ||
        hasNormalizedWordBoundaryMatch(ingredientName, term)
      );
    });
  });
}

function toPositiveInteger(value: unknown): number | null {
  const numericValue = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function articleMatchesNutrient(article: KnowledgeArticleOverviewItem, nutrient: NutrientTemplate): boolean {
  const articleSlug = slugify(article.slug);
  const articleTitle = normalizeSearchText(article.title);
  const nutrientTerms = extractMatchTerms(nutrient);
  const hasIngredientMetadata = (article.ingredients ?? []).length > 0;

  if (ingredientMatchesNutrient(article, nutrient)) return true;

  const matchesArticleSlug = nutrientTerms.some((term) => {
    const normalizedSlug = slugify(term);
    return (
      articleSlug === normalizedSlug ||
      articleSlug.startsWith(`${normalizedSlug}-`)
    );
  });
  if (matchesArticleSlug) return true;
  if (hasIngredientMetadata) return false;

  return nutrientTerms.some((term) => {
    return (
      articleTitle === term ||
      hasNormalizedWordBoundaryMatch(articleTitle, term)
    );
  });
}

function statusMatchesNutrient(status: KnowledgeNutrientStatus, nutrient: NutrientTemplate): boolean {
  const statusName = normalizeSearchText(status.name ?? '');
  if (!statusName) return false;
  const nutrientTerms = extractMatchTerms(nutrient);

  return nutrientTerms.some((term) => {
    const normalizedSlug = slugify(term);
    return statusName === term || slugify(statusName) === normalizedSlug;
  });
}

function articleIngredientIdsForNutrient(article: KnowledgeArticleOverviewItem, nutrient: NutrientTemplate): Set<number> {
  const matchingIds = new Set<number>();
  const nutrientTerms = extractMatchTerms(nutrient);

  for (const ingredient of article.ingredients ?? []) {
    const ingredientId = toPositiveInteger(ingredient.ingredient_id);
    if (ingredientId === null) continue;

    const ingredientName = normalizeSearchText(ingredient.name ?? '');
    const matchesNutrient = nutrientTerms.some((term) => {
      const normalizedSlug = slugify(term);
      return (
        ingredientName === term ||
        slugify(ingredientName) === normalizedSlug ||
        hasNormalizedWordBoundaryMatch(ingredientName, term)
      );
    });

    if (matchesNutrient) matchingIds.add(ingredientId);
  }

  if (matchingIds.size === 0 && article.ingredient_ids?.length === 1) {
    const [ingredientId] = article.ingredient_ids;
    const normalizedIngredientId = toPositiveInteger(ingredientId);
    if (normalizedIngredientId !== null) matchingIds.add(normalizedIngredientId);
  }

  return matchingIds;
}

function mergeNutrientStatuses(statuses: KnowledgeNutrientStatus[]): KnowledgeNutrientStatus | null {
  if (statuses.length === 0) return null;

  return statuses.reduce<KnowledgeNutrientStatus>(
    (merged, status) => ({
      ingredient_id: merged.ingredient_id,
      name: merged.name ?? status.name ?? null,
      has_dge: Boolean(merged.has_dge || status.has_dge),
      has_studies: Boolean(merged.has_studies || status.has_studies),
    }),
    {
      ingredient_id: statuses[0].ingredient_id,
      name: statuses[0].name ?? null,
      has_dge: false,
      has_studies: false,
    },
  );
}

function cardIngredientIds(card: NutrientCard): number[] {
  const ids = new Set<number>();
  const add = (value: unknown) => {
    const ingredientId = toPositiveInteger(value);
    if (ingredientId !== null) ids.add(ingredientId);
  };

  add(card.status?.ingredient_id);
  card.article?.ingredient_ids?.forEach(add);
  card.article?.ingredients?.forEach((ingredient) => add(ingredient.ingredient_id));
  return [...ids].sort((left, right) => left - right);
}

function nutrientSearchText(nutrient: NutrientTemplate, category: CategoryConfig): string {
  return [
    nutrient.name,
    nutrient.abbr,
    nutrient.description,
    category.label,
    category.description,
    ...(nutrient.aliases ?? []),
  ].join(' ');
}

function solubilityLabel(solubility?: Solubility): string | null {
  if (solubility === 'fat') return 'fettlöslich';
  if (solubility === 'water') return 'wasserlöslich';
  return null;
}

function readyArticleLabel(count: number): string {
  if (count === 1) return 'ausführlicher Artikel';
  return 'ausführliche Artikel';
}

function buildNutrientCards(
  articles: KnowledgeArticleOverviewItem[],
  nutrientStatuses: KnowledgeNutrientStatus[],
): NutrientCard[] {
  const usedSlugs = new Set<string>();

  return NUTRIENTS.map((nutrient) => {
    const article = articles.find((candidate) => {
      if (usedSlugs.has(candidate.slug)) return false;
      return articleMatchesNutrient(candidate, nutrient);
    }) ?? null;

    if (article) usedSlugs.add(article.slug);
    const articleIngredientIds = article ? articleIngredientIdsForNutrient(article, nutrient) : new Set<number>();
    const matchingStatuses = nutrientStatuses.filter((candidate) => {
      const candidateIngredientId = toPositiveInteger(candidate.ingredient_id);
      return (
        (candidateIngredientId !== null && articleIngredientIds.has(candidateIngredientId)) ||
        statusMatchesNutrient(candidate, nutrient)
      );
    });
    const status = mergeNutrientStatuses(matchingStatuses);
    return { ...nutrient, article, status };
  });
}

function CoverageBadges({ card }: { card: NutrientCard }) {
  return (
    <div className="nutri__tags" aria-label={`${card.name} Bearbeitungsstand`}>
      {!card.article && <span className="tag-soon">Bald</span>}
      {card.status?.has_studies && <span className="tag-data tag-data--studies">Studien</span>}
      {card.status?.has_dge && <span className="tag-data tag-data--dge">DGE</span>}
    </div>
  );
}

function ComingCard({ card }: { card: NutrientCard }) {
  const solubility = solubilityLabel(card.solubility);
  const ingredientIds = cardIngredientIds(card);

  return (
    <div
      className="nutri coming"
      data-ingredient-ids={ingredientIds.length > 0 ? ingredientIds.join(' ') : undefined}
      data-name={normalizeSearchText(nutrientSearchText(card, CATEGORIES.find((category) => category.key === card.category) ?? CATEGORIES[0]))}
      data-cat={card.category}
      role="button"
      tabIndex={0}
      aria-disabled="true"
    >
      <CardBody card={card} solubility={solubility} />
      <div className="nutri__foot">
        <CoverageBadges card={card} />
      </div>
    </div>
  );
}

function ReadyCard({ card, search }: { card: NutrientCard & { article: KnowledgeArticleOverviewItem }; search: string }) {
  const solubility = solubilityLabel(card.solubility);
  const ingredientIds = cardIngredientIds(card);
  const prefetchArticle = () => {
    if (new URLSearchParams(search).has('cfcheck')) return;
    void Promise.all([
      import('./KnowledgeArticlePage'),
      import('../lib/knowledgeArticleClient').then(({ prefetchKnowledgeArticle }) => (
        prefetchKnowledgeArticle(
          card.article.slug,
          apiPath(`/knowledge/${encodeURIComponent(card.article.slug)}`),
        )
      )),
    ]).catch(() => undefined);
  };

  return (
    <Link
      className="nutri is-ready"
      to={`/wissen/${card.article.slug}${search}`}
      data-name={normalizeSearchText(card.name)}
      data-cat={card.category}
      data-ingredient-ids={ingredientIds.length > 0 ? ingredientIds.join(' ') : undefined}
      onFocus={prefetchArticle}
      onPointerEnter={prefetchArticle}
      onTouchStart={prefetchArticle}
    >
      <CardBody card={card} solubility={solubility} />
      <div className="nutri__foot">
        <CoverageBadges card={card} />
        <span className="nutri__go">
          Artikel lesen
          <SvgIcon icon="arrow" />
        </span>
      </div>
    </Link>
  );
}

function CardBody({ card, solubility }: { card: NutrientCard; solubility: string | null }) {
  return (
    <>
      <div className="nutri__top">
        <span className="nutri__ic">
          <SvgIcon icon={card.icon} />
        </span>
        <span className="nutri__abbr">{card.abbr}</span>
      </div>
      <h3>{card.name}</h3>
      <p>{card.description}</p>
      {solubility && (
        <div className="nutri__sol">
          <span className={`tag-sm ${card.solubility}`}>{solubility}</span>
        </div>
      )}
    </>
  );
}

export default function KnowledgeOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = getSearchQuery(searchParams);
  const activeCategory = getActiveCategory(searchParams);
  const cacheCheck = getCacheCheck(searchParams);
  const [overview, setOverview] = useState<KnowledgeOverviewResponse>(() => (
    cacheCheck === null ? readCachedKnowledgeOverview() ?? { articles: [] } : { articles: [] }
  ));
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError('');
    if (cacheCheck !== null) setOverview({ articles: [] });

    const endpoint = apiPath(`/knowledge${cacheCheck === null ? '' : `?cfcheck=${encodeURIComponent(cacheCheck)}`}`);
    const bootstrapRequest = cacheCheck === null ? window.__knowledgeOverviewRequest : undefined;
    if (bootstrapRequest) delete window.__knowledgeOverviewRequest;
    const request = bootstrapRequest
      ? bootstrapRequest.then((response) => response.clone())
      : fetch(endpoint, { signal: controller.signal, headers: { Accept: 'application/json' } });
    request
      .then((response) => {
        if (!response.ok) throw new Error('Die Wissensdatenbank konnte nicht geladen werden.');
        return response.json() as Promise<KnowledgeOverviewResponse>;
      })
      .then((data) => {
        if (!active) return;
        const normalized = {
          ...data,
          articles: data.articles ?? [],
          nutrient_statuses: data.nutrient_statuses ?? [],
        };
        setOverview(normalized);
        writeCachedKnowledgeOverview(normalized);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Die Wissensdatenbank konnte nicht geladen werden.');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [cacheCheck]);

  const cards = useMemo(
    () => buildNutrientCards(overview.articles, overview.nutrient_statuses ?? []),
    [overview],
  );
  const readyCount = cards.filter((card) => card.article).length;
  const normalizedQuery = normalizeSearchText(query);
  const hasQuery = query.trim().length > 0;
  const articleSearch = buildOverviewSearch(activeCategory, query, cacheCheck);

  const updateOverviewSearch = (nextCategory: CategoryKey | 'all', nextQuery: string) => {
    setSearchParams(buildOverviewSearch(nextCategory, nextQuery, cacheCheck), { replace: true });
  };

  const groupedCards = useMemo(() => {
    return CATEGORIES.map((category) => {
      const categoryCards = cards.filter((card) => {
        if (card.category !== category.key) return false;
        if (activeCategory !== 'all' && activeCategory !== category.key) return false;
        if (!normalizedQuery) return true;
        return normalizeSearchText(nutrientSearchText(card, category)).includes(normalizedQuery);
      });

      return { category, cards: categoryCards };
    });
  }, [activeCategory, cards, normalizedQuery]);

  const visibleCount = groupedCards.reduce((sum, group) => sum + group.cards.length, 0);

  return (
    <div className="knowledge-overview">
      <section className="db-hero">
        <div className="db-hero__in">
          <span className="eyebrow">Wissensdatenbank</span>
          <h1>Alles über Vitamine, Mineralstoffe &amp; Co. - einfach erklärt</h1>
          <p className="dek">
            Schlag nach, was ein Nährstoff im Körper macht, wo er drinsteckt und worauf du achten solltest.
            Verständlich erklärt, mit Quellen.
          </p>

          <div className={`db-search${hasQuery ? ' has-text' : ''}`}>
            <SvgIcon icon="search" className="mag" />
            <input
              type="text"
              value={query}
              onChange={(event) => updateOverviewSearch(activeCategory, event.target.value)}
              placeholder="Nährstoff suchen - z. B. Vitamin D, Magnesium, Eisen ..."
              autoComplete="off"
              aria-label="Nährstoff suchen"
            />
            <button type="button" className="clear" onClick={() => updateOverviewSearch(activeCategory, '')} aria-label="Suche löschen">
              <SvgIcon icon="x" />
            </button>
          </div>

          <div className="db-stats">
            <div className="db-stat">
              <b>{NUTRIENTS.length}</b>
              <span>Nährstoffe</span>
            </div>
            <div className="db-stat">
              <b>{CATEGORIES.length}</b>
              <span>Kategorien</span>
            </div>
            <div className="db-stat">
              <b>{readyCount}</b>
              <span>{readyArticleLabel(readyCount)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="filter-bar" aria-label="Wissensdatenbank filtern">
        <div className="filter-bar__in">
          <button
            type="button"
            className={`filter-pill${activeCategory === 'all' ? ' is-active' : ''}`}
            onClick={() => updateOverviewSearch('all', query)}
          >
            Alle
            <span className="ct">{NUTRIENTS.length}</span>
          </button>
          {CATEGORIES.map((category) => {
            const count = NUTRIENTS.filter((nutrient) => nutrient.category === category.key).length;
            return (
              <button
                key={category.key}
                type="button"
                className={`filter-pill ${category.cssClass}${activeCategory === category.key ? ' is-active' : ''}`}
                onClick={() => updateOverviewSearch(category.key, query)}
              >
                <span className="dot" aria-hidden="true" />
                {category.label}
                <span className="ct">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="db-body">
        {error && (
          <div className="db-state db-state--error">
            <SvgIcon icon="search" />
            <h2>Laden fehlgeschlagen</h2>
            <p>{error}</p>
          </div>
        )}

        {visibleCount === 0 && (
          <div className="db-empty show">
            <SvgIcon icon="search" />
            <h2>Nichts gefunden</h2>
            <p>Versuch einen anderen Suchbegriff oder eine andere Kategorie.</p>
          </div>
        )}

        {groupedCards.map(({ category, cards: categoryCards }) => {
          if (categoryCards.length === 0) return null;

          return (
            <section
              key={category.key}
              className={`cat-block ${category.cssClass}`}
              data-testid={`knowledge-category-${category.key}`}
            >
              <header className="cat-head">
                <span className="cat-head__ic">
                  <SvgIcon icon={category.icon} />
                </span>
                <div>
                  <h2>{category.label}</h2>
                  <p className="sub">{category.description}</p>
                </div>
                <span className="meta">{categoryCards.length} Einträge</span>
              </header>

              <div className="card-grid">
                {categoryCards.map((card) =>
                  card.article ? (
                    <ReadyCard key={card.name} card={card as NutrientCard & { article: KnowledgeArticleOverviewItem }} search={articleSearch} />
                  ) : (
                    <ComingCard key={card.name} card={card} />
                  ),
                )}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
