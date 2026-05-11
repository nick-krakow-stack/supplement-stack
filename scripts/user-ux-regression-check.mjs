import { readFileSync } from 'node:fs';

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const stackWorkspace = readFileSync('frontend/src/components/StackWorkspace.tsx', 'utf8');
const productCard = readFileSync('frontend/src/components/ProductCard.tsx', 'utf8');
const layout = readFileSync('frontend/src/components/Layout.tsx', 'utf8');
const app = readFileSync('frontend/src/App.tsx', 'utf8');
const styles = readFileSync('frontend/src/styles.css', 'utf8');
const registerPage = readFileSync('frontend/src/pages/RegisterPage.tsx', 'utf8');
const administratorKnowledgePage = readFileSync('frontend/src/pages/administrator/AdministratorKnowledgePage.tsx', 'utf8');
const stackCalculations = readFileSync('frontend/src/lib/stackCalculations.ts', 'utf8');
const knowledgeIndexPage = readFileSync('frontend/src/pages/KnowledgeIndexPage.tsx', 'utf8');

const publicStackSources = [
  ['StackWorkspace.tsx', stackWorkspace],
  ['ProductCard.tsx', productCard],
];

for (const [sourceName, source] of publicStackSources) {
  check(
    !/[ÃƒÃ‚Ã¢]|\\u00c3|\\u00e2/.test(source),
    `${sourceName} must not contain mojibake on public stack/demo screens`,
  );
}

check(
  /onChange=\{\(event\) => handleTargetStackChange\(event\.target\.value\)\}/.test(stackWorkspace),
  'Add flow stack selector must re-run the duplicate check when target stack changes',
);

check(
  /onClick=\{\(\) => handleContinueFromDosage\(\)\}/.test(stackWorkspace),
  'Add flow must re-check the selected target stack before loading products',
);

check(
  /warningDetailOpen/.test(productCard) && /setWarningDetailOpen/.test(productCard),
  'Short product warnings need a click/touch detail popover state',
);

check(
  /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setWarningDetailOpen\('card'\);/.test(productCard),
  'Card warning info button must open the in-app detail popover',
);

check(
  /setDemoShareNoticeOpen\(true\)/.test(stackWorkspace) && !/window\.alert\(DEMO_SHARE_NOTICE\)/.test(stackWorkspace),
  'Demo mail/PDF actions must use an in-app modal instead of window.alert',
);

check(
  /productViewMode === 'list' && \(/.test(stackWorkspace)
    && /product-list-add-row/.test(stackWorkspace)
    && !/Produkt als kompakte Zeile hinzufügen|Produkt als kompakte Zeile hinzufÃ¼gen/.test(stackWorkspace),
  'List view must render a simple add row without technical helper copy',
);

check(
  !/Produkt hinzufuegen|hinzufuegen|loeschen|verfuegbar|aendern|ueber|fuer/.test(stackWorkspace),
  'Visible StackWorkspace copy must use German umlauts instead of ASCII transliterations',
);

check(
  /aria-label="Produkt hinzufügen"/.test(stackWorkspace)
    && /title="Produkt hinzufügen"/.test(stackWorkspace)
    && /<strong>Produkt hinzufügen<\/strong>/.test(stackWorkspace),
  'Grid/list add actions must show "Produkt hinzufügen" with umlaut',
);

check(
  /CREATE_STACK_SELECT_VALUE/.test(stackWorkspace)
    && /<option value=\{CREATE_STACK_SELECT_VALUE\}>Stack erstellen<\/option>/.test(stackWorkspace)
    && !/>Stack erstellen<\/button>/.test(stackWorkspace),
  'Stack creation must live in the stack dropdown instead of a separate toolbar button',
);

check(
  /ss-btn-icon-yellow/.test(stackWorkspace)
    && /aria-label="Stack bearbeiten"/.test(stackWorkspace)
    && /aria-label="Stack mailen"/.test(stackWorkspace)
    && /aria-label="Plan drucken\/PDF"/.test(stackWorkspace)
    && /aria-label="Stack löschen"/.test(stackWorkspace),
  'Secondary stack toolbar actions must be icon-only accessible buttons',
);

check(
  /ss-btn-icon-mail/.test(stackWorkspace) && /ss-btn-icon-pdf/.test(stackWorkspace),
  'Stack mail and PDF icons must use distinct requested background color classes',
);

check(
  /IconShareStack/.test(stackWorkspace)
    && /IconImportStack/.test(stackWorkspace)
    && /aria-label="Stack teilen"/.test(stackWorkspace)
    && /aria-label="Stack importieren"/.test(stackWorkspace),
  'Stack toolbar must expose icon actions for JSON share and JSON import',
);

check(
  /stackShareModalOpen/.test(stackWorkspace)
    && /JSON herunterladen/.test(stackWorkspace)
    && /Per Mail versenden/.test(stackWorkspace)
    && /Captcha/.test(stackWorkspace),
  'Stack share action must open a modal with JSON download, mail recipient, and captcha fields',
);

check(
  /stackImportModalOpen/.test(stackWorkspace)
    && /handleImportStackJson/.test(stackWorkspace)
    && /type="file"[\s\S]*?accept="\.json,application\/json"/.test(stackWorkspace),
  'Stack import action must open a modal that accepts pasted or uploaded JSON',
);

check(
  /aria-label="Stack löschen"[\s\S]*?<span className="ss-toolbar-divider"[\s\S]*?Produkt hinzufügen/.test(stackWorkspace)
    && /ss-toolbar-divider/.test(styles),
  'Delete stack icon must sit before the product add button with a vertical divider',
);

check(
  /\{missingLinkAction\}\s*\{buyAction\}\s*\{editAction\}\s*\{deleteAction\}/.test(productCard),
  'Grid product cards must place "Link melden" as the leftmost action',
);

check(
  /Demo-Stack wird beim Neuladen der Seite zurückgesetzt/.test(stackWorkspace)
    && /Kostenlos anmelden/.test(stackWorkspace)
    && /um deinen Stack dauerhaft zu speichern/.test(stackWorkspace),
  'Demo banner must use the approved concise reset/carryover wording',
);

check(
  /draggedProductKey/.test(stackWorkspace)
    && /draggable/.test(stackWorkspace)
    && /reorderActiveProducts/.test(stackWorkspace)
    && /product-sort-item/.test(styles),
  'Stack products must be draggable for manual ordering while the add tile stays separate',
);

check(
  /function productWithIngredientRows/.test(stackWorkspace)
    && /productWithIngredientRows\(\{ \.\.\.product/.test(stackWorkspace),
  'Demo product loading must preserve flat API ingredient potency before stack quantity is applied',
);

check(
  /<span>Übersicht<\/span>/.test(stackWorkspace)
    && !/Supplement Übersicht/.test(stackWorkspace),
  'Product section title must be shortened to "Übersicht"',
);

check(
  /to="\/wissen"[\s\S]*Studien & mehr/.test(layout)
    && /KnowledgeIndexPage/.test(app)
    && /path="\/wissen"/.test(app),
  'Public navigation must include a working "Studien & mehr" knowledge entry',
);

check(
  /Was willst du wissen\?/.test(knowledgeIndexPage)
    && /Woher nehmen wir die Zahlen/.test(knowledgeIndexPage)
    && /Wirkungen und welche Risiken/.test(knowledgeIndexPage),
  'Knowledge index hero must use the approved question headline and explanatory copy',
);

check(
  /POPULAR_TERMS/.test(knowledgeIndexPage)
    && /columns-2/.test(knowledgeIndexPage)
    && /columns-3/.test(knowledgeIndexPage)
    && /Weitere Einträge/.test(knowledgeIndexPage),
  'Knowledge index must show a tag cloud, masonry feature cards, and a remaining-entry list',
);

check(
  /value=\{query\}/.test(knowledgeIndexPage)
    && /setQuery\(event\.target\.value\)/.test(knowledgeIndexPage)
    && /keywords/.test(knowledgeIndexPage),
  'Knowledge index must include search with keyword-backed filtering',
);

check(
  /Trotz sorgfältiger/.test(knowledgeIndexPage)
    && /Quellen/.test(knowledgeIndexPage)
    && /selbst prüfen/.test(knowledgeIndexPage),
  'Knowledge index must include a careful source-interpretation disclaimer',
);

check(
  /className="masonry-item masonry-add-tile"/.test(stackWorkspace)
    && /\.masonry-add-tile\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*15[0-9]px;/.test(styles),
  'Grid plus tile must use the normal tile width and stay lower than product cards',
);

check(
  /const listDose = getListDose\(product, dose\);/.test(productCard)
    && /function getListDose/.test(productCard)
    && /ss-product-card-list-dose/.test(productCard),
  'List product cards must render a dedicated compact dose without ingredient amount parentheses',
);

check(
  /ss-product-card-list-image/.test(productCard)
    && /\.ss-product-card-list-image\s*\{[\s\S]*?width:\s*58px;[\s\S]*?height:\s*58px;/.test(styles),
  'List product images/placeholders must be larger than the old compact 44px size',
);

check(
  /ss-product-card-list-header/.test(productCard)
    && /ss-product-card-list-cost/.test(productCard)
    && /ss-product-card-list-icon-row/.test(productCard),
  'List product cards must use header, combined cost/reach column, and two-icon action row layout',
);

check(
  /\.ss-product-card-list\s*\{[\s\S]*?align-items:\s*center;/.test(styles)
    && /\.ss-product-card-list \.ss-product-card-list-main\s*\{[\s\S]*?align-items:\s*center;/.test(styles)
    && /\.ss-product-card-list \.ss-product-card-actions\s*\{[\s\S]*?align-self:\s*center;/.test(styles),
  'List product card columns must be vertically centered',
);

check(
  /'ml'/.test(stackCalculations) && /'milliliter'/.test(stackCalculations),
  'Product usage calculation must support ml-based oil products',
);

check(
  /transferDemoStacksToAccount/.test(registerPage) && !/products\.length === 0\) continue/.test(registerPage),
  'Demo stack import must use the shared transfer helper and preserve empty demo stacks',
);

check(
  /useSearchParams/.test(administratorKnowledgePage),
  'AdministratorKnowledgePage must use URL search params for deep-link filters',
);

check(
  /useState\(\(\) => searchParams\.get\('status'\) \?\? ''\)/.test(administratorKnowledgePage),
  'AdministratorKnowledgePage must initialize status from the URL',
);

console.log('User UX regression checks passed.');
