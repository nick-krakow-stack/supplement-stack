import { readFileSync } from 'node:fs';

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const stackWorkspace = readFileSync('frontend/src/components/StackWorkspace.tsx', 'utf8');
const productCard = readFileSync('frontend/src/components/ProductCard.tsx', 'utf8');
const registerPage = readFileSync('frontend/src/pages/RegisterPage.tsx', 'utf8');
const administratorKnowledgePage = readFileSync('frontend/src/pages/administrator/AdministratorKnowledgePage.tsx', 'utf8');

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
  /productViewMode === 'list' && \(/.test(stackWorkspace) && /Produkt als kompakte Zeile hinzufuegen/.test(stackWorkspace),
  'List view must render a compact add row at the end',
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
