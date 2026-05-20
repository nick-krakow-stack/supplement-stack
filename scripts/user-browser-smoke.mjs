#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const VIEWPORTS = [
  {
    name: 'desktop',
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
    hasTouch: false,
  },
  {
    name: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
    hasTouch: true,
  },
];

const AUTH_REQUIRED_ROUTES = new Set(['/stacks', '/profile', '/my-products']);

const DEFAULT_TARGETS = [
  { route: '/', authRequired: false },
  { route: '/demo', authRequired: false },
  { route: '/impressum', authRequired: false },
  { route: '/datenschutz', authRequired: false },
  { route: '/agb', authRequired: false },
  { route: '/login', authRequired: false },
  { route: '/register', authRequired: false },
  { route: '/forgot-password', authRequired: false },
  { route: '/stacks', authRequired: true },
  { route: '/profile', authRequired: true },
  { route: '/my-products', authRequired: true },
];

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    console.log(usage());
    process.exit(0);
  }
  if (args.has('--static-route-checks')) {
    runStaticRouteChecks();
    process.exit(0);
  }
}

function usage() {
  return `Public/User browser smoke for the public frontend routes.

Modes:
  - Public mode (default): loads public routes and verifies auth-gated routes remain protected when possible.
  - Auth mode: set USER_QA_EMAIL + USER_QA_PASSWORD or USER_QA_TOKEN to exercise authenticated flow for protected routes.

Optional (public + auth):
  BASE_URL=https://supplementstack.de
  USER_QA_BASE_URL=<base>/api
  USER_QA_API_BASE_URL=<base>/api
  USER_QA_ROUTES=/
  USER_QA_SCREENSHOT_DIR=tmp/user-smoke
  USER_QA_BROWSER_PATH=C:\\Path\\To\\msedge.exe
  USER_QA_HEADFUL=1
  USER_QA_SKIP_API_GUARDS=1

Static regression:
  node scripts/user-browser-smoke.mjs --static-route-checks

Optional (auth mode):
  USER_QA_TOKEN=<jwt>
  USER_QA_EMAIL=user@example.com
  USER_QA_PASSWORD=***

Examples:
  node scripts/user-browser-smoke.mjs
  $env:USER_QA_EMAIL='user@example.com'; $env:USER_QA_PASSWORD='...'; node scripts/user-browser-smoke.mjs
`;
}

function findJsxTags(source, tagName) {
  const tags = [];
  const tagPattern = new RegExp(`<${tagName}\\b`, 'g');
  let match;
  while ((match = tagPattern.exec(source)) !== null) {
    const start = match.index;
    let braceDepth = 0;
    let quote = '';
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      const previous = source[index - 1];
      if (quote) {
        if (char === quote && previous !== '\\') quote = '';
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '{') {
        braceDepth += 1;
        continue;
      }
      if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }
      if (char === '>' && braceDepth === 0) {
        tags.push(source.slice(start, index + 1));
        tagPattern.lastIndex = index + 1;
        break;
      }
    }
  }
  return tags;
}

function hasJsxStringProp(tagSource, propName, expectedValue) {
  return new RegExp(`\\b${propName}\\s*=\\s*(["'])${escapeRegExp(expectedValue)}\\1`).test(tagSource);
}

function hasJsxBooleanLiteralProp(tagSource, propName, expectedValue) {
  return new RegExp(`\\b${propName}\\s*=\\s*\\{\\s*${expectedValue}\\s*\\}`).test(tagSource);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runStaticRouteChecks() {
  const appSource = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'App.tsx'), 'utf8');
  const layoutSource = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'components', 'Layout.tsx'), 'utf8');
  const registerSource = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'pages', 'RegisterPage.tsx'), 'utf8');
  const stackWorkspaceSource = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'components', 'StackWorkspace.tsx'), 'utf8');
  const demoPageSource = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'pages', 'DemoPage.tsx'), 'utf8');
  const productCardSource = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'components', 'ProductCard.tsx'), 'utf8');
  const stylesSource = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'styles.css'), 'utf8');
  const demoRoute = findJsxTags(appSource, 'Route').find((tagSource) => hasJsxStringProp(tagSource, 'path', '/demo'));
  const demoWorkspace = findJsxTags(demoPageSource, 'StackWorkspace').find((tagSource) =>
    hasJsxStringProp(tagSource, 'mode', 'demo')
  );

  if (!demoRoute || !/\belement\s*=\s*\{[\s\S]*<Layout\b[\s\S]*<DemoPage\b[\s\S]*<\/Layout>\s*\}/.test(demoRoute)) {
    throw new Error('Expected /demo to be routed through Layout in frontend/src/App.tsx.');
  }
  if (!demoWorkspace || !hasJsxBooleanLiteralProp(demoWorkspace, 'standaloneHeader', false)) {
    throw new Error('Expected DemoPage to disable StackWorkspace standaloneHeader.');
  }

  assertStaticStackWorkspaceRequirements(stackWorkspaceSource, registerSource, appSource, layoutSource, stylesSource);
  assertProductCardStaticChecks(productCardSource, stylesSource);
  console.log('ok static product-card list/warning layout');

  console.log('ok static route-check /demo layout header');
  console.log('ok static stack workspace owner requirements');
}

function assertSourceIncludes(source, expected, description) {
  if (!source.includes(expected)) {
    throw new Error(`Expected ${description}: ${expected}`);
  }
}

function assertSourceExcludes(source, forbidden, description) {
  if (source.includes(forbidden)) {
    throw new Error(`Unexpected ${description}: ${forbidden}`);
  }
}

function assertSourceMatches(source, pattern, description) {
  if (!pattern.test(source)) {
    throw new Error(`Expected ${description}: ${pattern}`);
  }
}

function extractSourceAfter(source, marker, maxChars = 2000) {
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Expected source marker not found: ${marker}`);
  }
  return source.slice(start, start + maxChars);
}

function assertToolbarSource(stackWorkspaceSource) {
  const startMarker = '<div className="ss-toolbar">';
  const endMarker = '{activeDescription && (';
  const start = stackWorkspaceSource.indexOf(startMarker);
  const end = stackWorkspaceSource.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error('Expected stack workspace toolbar source block.');
  }
  return stackWorkspaceSource.slice(start, end);
}

function assertFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  if (start === -1) {
    throw new Error(`Expected source to contain function ${functionName}.`);
  }
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, nextFunction === -1 ? source.length : nextFunction);
}

function extractCssBlocks(source) {
  const cleaned = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let depth = 0;
  let selectorStart = 0;
  let selectorStack = [];
  let bodyStartStack = [];
  let quote = '';

  const pushRule = (selectorText, bodyStartIndex) => {
    selectorStack.push(selectorText.trim());
    bodyStartStack.push(bodyStartIndex);
    depth += 1;
  };

  const popRule = (closeIndex) => {
    const selector = selectorStack.pop();
    const bodyStart = bodyStartStack.pop();
    if (typeof selector === 'string' && selector.length > 0) {
      rules.push({
        selector,
        body: cleaned.slice(bodyStart, closeIndex),
        ancestors: [...selectorStack],
      });
    }
    depth -= 1;
  };

  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    const next = cleaned[index + 1] ?? '';
    const previous = cleaned[index - 1] ?? '';

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '/' && next === '*') {
      const endComment = cleaned.indexOf('*/', index + 2);
      index = endComment === -1 ? cleaned.length : endComment + 1;
      selectorStart = index + 1;
      continue;
    }

    if (char === '{') {
      const selectorText = cleaned.slice(selectorStart, index).trim();
      pushRule(selectorText, index + 1);
      continue;
    }

    if (char === '}') {
      if (depth > 0) {
        popRule(index);
      }
      selectorStart = index + 1;
      continue;
    }
  }

  return rules;
}

function hasDeclaration(rule, property, value) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const valuePattern = value instanceof RegExp ? value.source : value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?:^|;|\\n)\\s*${escapedProperty}\\s*:\\s*(?:${valuePattern})\\s*(?:;|$|\\n)`,
    'i',
  );
  return pattern.test(rule.body);
}

function hasEditModeMasonryGridOverride(stylesSource, forbiddenDeclaration) {
  const rules = extractCssBlocks(stylesSource).filter((rule) => {
    const selector = rule.selector;
    return selector.includes('.ss-product-layout-edit-active') && selector.includes('.masonry-grid');
  });

  return rules.some((rule) => hasDeclaration(rule, forbiddenDeclaration.property, forbiddenDeclaration.value));
}

function hasEditModeMasonryItemOverride(stylesSource, forbiddenDeclaration) {
  const rules = extractCssBlocks(stylesSource).filter((rule) => {
    const selector = rule.selector;
    return selector.includes('.ss-product-layout-edit-active') && selector.includes('.masonry-item');
  });

  return rules.some((rule) => hasDeclaration(rule, forbiddenDeclaration.property, forbiddenDeclaration.value));
}

function assertMasonryColumnBaseRule(stylesSource, columnsValue) {
  const rules = extractCssBlocks(stylesSource).filter((rule) => (
    rule.selector.includes('.masonry-grid')
    && !rule.selector.includes('.ss-product-layout-edit-active')
  ));

  const matcher = new RegExp(`\\b${columnsValue}\\b`);
  const hasBaseColumnsRule = rules.some((rule) => hasDeclaration(rule, 'columns', matcher));
  if (!hasBaseColumnsRule) {
    throw new Error(`Expected masonry base rule to include columns: ${columnsValue};`);
  }
}

function assertMasonryColumnMediaRule(stylesSource, maxWidth, columnsValue) {
  const rules = extractCssBlocks(stylesSource).filter((rule) => (
    rule.selector.includes('.masonry-grid')
    && !rule.selector.includes('.ss-product-layout-edit-active')
    && rule.ancestors.some((ancestor) => new RegExp(`max-width\\s*:\\s*${maxWidth}px`).test(ancestor))
  ));

  const matcher = new RegExp(`\\b${columnsValue}\\b`);
  const hasMediaColumnsRule = rules.some((rule) => hasDeclaration(rule, 'columns', matcher));
  if (!hasMediaColumnsRule) {
    throw new Error(`Expected masonry media rule to include columns: ${columnsValue} at max-width ${maxWidth}px.`);
  }
}

function assertStaticStackWorkspaceRequirements(stackWorkspaceSource, registerSource, appSource, layoutSource, stylesSource) {
  const toolbarSource = assertToolbarSource(stackWorkspaceSource);

  assertSourceIncludes(stackWorkspaceSource, 'ss-restriction-modal', 'shared demo/auth restriction modal');
  assertSourceIncludes(stackWorkspaceSource, 'Stack mailen ist nur angemeldet', 'mail restriction popup copy');
  assertSourceIncludes(stackWorkspaceSource, 'Plan drucken/PDF ist in der Demo nicht', 'print restriction popup copy');
  assertSourceExcludes(stackWorkspaceSource, 'disabled={isDemo || !activeStack || emailSending}', 'disabled demo mail button');
  assertSourceExcludes(stackWorkspaceSource, 'E-Mail-Versand ist nur angemeldet verf', 'inline demo mail restriction text');

  assertSourceIncludes(
    stackWorkspaceSource,
    'Danke, dass du ein neues Produkt',
    'own-product demo CTA modal copy',
  );
  assertSourceIncludes(stackWorkspaceSource, "navigate('/my-products')", 'authenticated own-product handoff route');

  assertSourceIncludes(stackWorkspaceSource, 'SS_DEMO_STACK_HANDOFF_KEY', 'demo stack handoff storage key');
  assertSourceIncludes(stackWorkspaceSource, 'persistDemoStackHandoff', 'demo stack handoff persistence before registration');
  assertSourceIncludes(stackWorkspaceSource, 'consumePendingDemoStackHandoff', 'authenticated demo handoff consumer');
  assertSourceIncludes(stackWorkspaceSource, 'clearDemoStackHandoff', 'demo handoff cleanup helper');
  assertSourceIncludes(stackWorkspaceSource, 'window.localStorage.removeItem(SS_DEMO_STACK_HANDOFF_KEY)', 'demo handoff localStorage clear after import');
  assertSourceIncludes(stackWorkspaceSource, 'window.sessionStorage.removeItem(SS_DEMO_STACK_HANDOFF_KEY)', 'demo handoff sessionStorage clear after import');
  assertSourceIncludes(stackWorkspaceSource, 'persistStackProducts(', 'demo handoff import through stack product persistence');
  assertSourceIncludes(stackWorkspaceSource, 'importedStack.id,', 'demo handoff import stack-id usage');
  assertSourceIncludes(registerSource, 'SS_DEMO_STACK_HANDOFF_KEY', 'registration demo handoff consumption');
  assertSourceIncludes(registerSource, "demoStackHandoffAvailable ? '/stacks'", 'registration redirect to stacks when demo handoff exists');

  assertSourceIncludes(stackWorkspaceSource, 'Willst du dieses Produkt', 'product delete confirmation copy');
  assertSourceIncludes(stackWorkspaceSource, 'Ja, löschen', 'product delete confirmation action');
  assertSourceIncludes(stackWorkspaceSource, 'Abbrechen', 'product delete cancel action');

  assertSourceIncludes(stackWorkspaceSource, 'Dieser Wirkstoff ist bereits in deinem Stack vorhanden', 'duplicate ingredient modal copy');
  assertSourceIncludes(stackWorkspaceSource, 'Wirkstoffmengen bearbeiten', 'duplicate ingredient edit action');
  assertSourceIncludes(stackWorkspaceSource, 'Produkt ändern', 'duplicate ingredient change product action');
  assertSourceIncludes(stackWorkspaceSource, 'So lassen', 'duplicate ingredient keep action');
  assertSourceIncludes(
    stackWorkspaceSource,
    'Trotzdem weiteres Produkt mit gleichem Wirkstoff hinzufügen',
    'duplicate ingredient intentional add action',
  );
  assertSourceIncludes(stackWorkspaceSource, 'parent_ingredient_id', 'duplicate ingredient parent ingredient handling');

  assertSourceExcludes(stackWorkspaceSource, 'stack-cockpit-kicker', 'old stack cockpit kicker');
  assertSourceExcludes(stackWorkspaceSource, 'aria-label="Stack-Steuerung"', 'workspace-specific stack cockpit section');
  assertSourceExcludes(stackWorkspaceSource, 'className="family-switcher"', 'profile selector in stack top strip');
  assertSourceExcludes(stackWorkspaceSource, 'family-add-btn', 'profile add button in stack top strip');
  assertSourceExcludes(stackWorkspaceSource, 'routine-toggle-btn', 'clock routine toggle in stack top strip');
  assertSourceIncludes(stackWorkspaceSource, 'familyMembers={familyMembers}', 'family profile selector wired into stack edit modal');
  assertSourceIncludes(stackWorkspaceSource, 'onFamilyMemberChange={handleSaveStackFamilyMember}', 'family profile save handler wired into stack edit modal');

  assertSourceIncludes(appSource, 'path="/einnahmeplan"', 'einnahmeplan route');
  assertSourceIncludes(layoutSource, 'to="/einnahmeplan"', 'einnahmeplan nav link');
  assertSourceIncludes(stackWorkspaceSource, "view === 'routine'", 'separate routine overview mode');
  assertSourceIncludes(stackWorkspaceSource, 'ss-routine-page', 'routine overview page classes');

  assertSourceIncludes(stackWorkspaceSource, 'ss-add-product-tile', 'green add-product grid tile');
  assertSourceIncludes(stackWorkspaceSource, "type ProductSortMode = 'az' | 'timing' | 'custom'", 'product sort mode type');
  assertSourceIncludes(stackWorkspaceSource, "type ProductCategoryMode = 'none' | 'timing' | 'custom'", 'product category mode type');
  assertSourceIncludes(stackWorkspaceSource, 'STACK_PRODUCT_SORT_KEY', 'product sort localStorage key');
  assertSourceIncludes(stackWorkspaceSource, 'STACK_PRODUCT_CATEGORY_MODE_KEY', 'product category localStorage key');
  assertSourceIncludes(stackWorkspaceSource, 'loadProductSortMode', 'product sort localStorage loader');
  assertSourceIncludes(stackWorkspaceSource, 'loadProductCategoryMode', 'product category localStorage loader');
  assertSourceIncludes(stackWorkspaceSource, 'compareProductsByName', 'A-Z product sort helper');
  assertSourceIncludes(stackWorkspaceSource, 'compareProductsByCustomOrder', 'custom product sort helper');
  assertSourceIncludes(stackWorkspaceSource, 'sortProductsForDisplay', 'display-only product sort helper');
  assertSourceIncludes(stackWorkspaceSource, 'buildProductSections', 'section-based product rendering helper');
  assertSourceIncludes(stackWorkspaceSource, 'productSections.map((section)', 'section rendering for product overview');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-sections', 'section wrapper class');
  assertSourceExcludes(stackWorkspaceSource, 'ss-product-layout-tools', 'removed per-card layout control wrapper');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-layout-edit-toolbar', 'per-card edit-toolbar wrapper for drag/custom context');
  assertSourceExcludes(stackWorkspaceSource, 'ss-product-sort-handle', 'legacy per-card drag affordance marker');
  assertSourceIncludes(stackWorkspaceSource, 'ss-layout-edit-toggle-btn', 'custom sort edit-mode toggle marker');
  assertSourceIncludes(stackWorkspaceSource, 'isCustomLayoutControlsVisible', 'custom layout controls marker');
  assertSourceIncludes(stackWorkspaceSource, 'showSortLayoutEditToggle', 'sort layout-toggle marker');
  assertSourceIncludes(stackWorkspaceSource, 'showCategoryLayoutEditToggle', 'category layout-toggle marker');
  assertSourceIncludes(stackWorkspaceSource, 'handleToggleProductLayoutEditMode', 'layout edit toggle handler');
  assertSourceExcludes(stackWorkspaceSource, 'draggable={isProductLayoutEditMode}', 'native draggable product layout path removed');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-layout-edit-mode', 'direct edit-mode class marker');
  assertSourceIncludes(stackWorkspaceSource, 'productLayoutPreviewProducts', 'local live product layout preview state');
  assertSourceIncludes(stackWorkspaceSource, 'previewProductLayoutPlacement', 'dragover live layout preview helper');
  assertSourceIncludes(stackWorkspaceSource, 'commitProductLayoutPreview', 'drop-only layout persistence helper');
  assertSourceIncludes(stackWorkspaceSource, 'findProductLayoutDropSlot', 'stable pointer slot helper for product layout drag');
  assertSourceIncludes(stackWorkspaceSource, 'findGridProductLayoutDropSlot', 'separate grid slot detection helper');
  assertSourceIncludes(stackWorkspaceSource, 'findListProductLayoutDropSlot', 'separate list slot detection helper');
  assertSourceIncludes(stackWorkspaceSource, 'buildMasonryItemColumns', 'Masonry-aware grid grouping helper');
  assertSourceIncludes(stackWorkspaceSource, 'pickMasonryColumnForX', 'Masonry-aware pointer-to-column selector helper');
  assertSourceIncludes(stackWorkspaceSource, 'findGridProductLayoutDropSlotFallbackToNearestCenter', 'Masonry-aware nearest-center fallback helper');
  assertSourceIncludes(stackWorkspaceSource, 'acceptProductLayoutDropSlot', 'layout drag hysteresis helper');
  assertSourceIncludes(stackWorkspaceSource, 'lastAcceptedSlot', 'pointer drag state tracks last accepted slot');
  assertSourceIncludes(stackWorkspaceSource, 'productLayoutDropSlotKey', 'repeated slot preview guard');
  assertSourceIncludes(stackWorkspaceSource, 'validateProductLayoutDropAtPoint', 'pointerup must validate current drop endpoint before commit');
  assertSourceIncludes(stackWorkspaceSource, 'clearProductLayoutPreview();', 'invalid pointerup endpoint must cancel stale layout preview');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-layout-edit-active', 'edit-mode overlay scope class');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-layout-edit-overlay', 'edit-mode transparent overlay marker');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-layout-drop-target', 'current product drop target marker');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-layout-drop-before', 'drop-before marker class');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-layout-drop-after', 'drop-after marker class');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-layout-drop-end', 'section-end drop marker class');
  assertSourceIncludes(stackWorkspaceSource, 'handleProductPointerDown', 'pointer/touch layout drag start handler');
  assertSourceIncludes(stackWorkspaceSource, 'handleProductPointerMove', 'pointer/touch live layout preview handler');
  assertSourceIncludes(stackWorkspaceSource, 'handleProductPointerUp', 'pointer/touch final layout persistence handler');
  assertSourceIncludes(stackWorkspaceSource, 'targetSectionProductKeys', 'section drop preview must receive target section product keys');
  assertSourceIncludes(stackWorkspaceSource, 'productLayoutSectionEndIndex', 'section drop must resolve end of target section');
  assertSourceIncludes(stackWorkspaceSource, 'data-product-layout-key', 'stable product layout key attribute for pointer drag targeting');
  assertSourceIncludes(stackWorkspaceSource, 'data-product-section-id', 'stable product section attribute for pointer drag targeting');
  assertSourceIncludes(stackWorkspaceSource, 'setPointerCapture', 'pointer drag capture for touch/mobile reliability');
  assertSourceIncludes(stackWorkspaceSource, 'suppressProductClickRef', 'post-drag click suppression guard');
  assertSourceIncludes(stackWorkspaceSource, 'onClickCapture', 'card click suppression after pointer drag');
  assertSourceIncludes(stackWorkspaceSource, 'cancelProductLayoutAnimations', 'animation cleanup helper');
  assertSourceIncludes(stackWorkspaceSource, 'onPointerCancel', 'pointer cancel cleanup handler');
  assertSourceIncludes(stackWorkspaceSource, 'suppressProductClickRef.current = false;', 'clear/cancel paths must reset click suppression');
  assertSourceExcludes(stackWorkspaceSource, 'const moveProductTo = useCallback', 'legacy immediate product layout persistence helper removed');
  assertSourceExcludes(stackWorkspaceSource, 'const moveProductBefore', 'legacy dragover persistence helper removed');
  assertSourceExcludes(stackWorkspaceSource, 'const moveProductToSectionEnd', 'legacy section-end persistence helper removed');
  assertSourceExcludes(stackWorkspaceSource, 'onDragStart=', 'native product layout drag start path removed');
  assertSourceExcludes(stackWorkspaceSource, 'onDragEnd=', 'native product layout drag end path removed');
  assertSourceExcludes(stackWorkspaceSource, 'onDragOver=', 'native product layout dragover path removed');
  assertSourceExcludes(stackWorkspaceSource, 'onDrop=', 'native product layout drop path removed');
  if (/onDragOver=\{\(event\)\s*=>[\s\S]{0,700}moveProduct(?:Before|ToSectionEnd)/.test(stackWorkspaceSource)) {
    throw new Error('Product layout dragover must update only local preview state, not persist layout moves.');
  }
  assertSourceIncludes(
    stackWorkspaceSource,
    "isInteractiveDragSource(target)",
    'direct drag guard against interactive inner controls',
  );
  assertSourceIncludes(
    stackWorkspaceSource,
    "target.closest('button, a, input, select, textarea, [role=\"button\"], [role=\"link\"], label, summary, [contenteditable=\"true\"], [data-no-drag=\"true\"]')",
    'interactive control selectors excluded from drag start',
  );
  assertSourceIncludes(stackWorkspaceSource, "['morning', 'noon', 'evening', 'flexible']", 'fixed timing sort order');
  assertSourceIncludes(stackWorkspaceSource, 'morning_evening', 'expanded morning/evening timing sort support');
  assertSourceIncludes(stackWorkspaceSource, 'before_breakfast', 'expanded breakfast timing sort support');
  assertSourceIncludes(stackWorkspaceSource, 'with_meal', 'expanded meal timing sort support');
  const sortProductsForDisplaySource = assertFunctionSource(stackWorkspaceSource, 'sortProductsForDisplay');
  assertSourceIncludes(sortProductsForDisplaySource, "if (sortMode === 'az')", 'A-Z branch inside sortProductsForDisplay');
  assertSourceIncludes(sortProductsForDisplaySource, "if (sortMode === 'az') return sorted.sort(compareProductsByName);", 'A-Z sort branch inside sortProductsForDisplay');
  assertSourceIncludes(sortProductsForDisplaySource, "if (sortMode === 'custom') return sorted.sort(compareProductsByCustomOrder);", 'custom sort branch inside sortProductsForDisplay');
  assertSourceIncludes(sortProductsForDisplaySource, 'routineKeyForTiming(a.timing)', 'timing sort a routine key inside sortProductsForDisplay');
  assertSourceIncludes(sortProductsForDisplaySource, 'routineKeyForTiming(b.timing)', 'timing sort b routine key inside sortProductsForDisplay');
  assertSourceIncludes(sortProductsForDisplaySource, 'PRODUCT_TIMING_ORDER.indexOf', 'timing order lookup inside sortProductsForDisplay');
  assertSourceIncludes(sortProductsForDisplaySource, 'return byTiming || compareProductsByName(a, b);', 'secondary name sort inside timing sort');
  assertSourceIncludes(stackWorkspaceSource, 'Tageszeiten', 'timing sort toggle label');
  assertSourceIncludes(stackWorkspaceSource, 'Eigene', 'custom mode labels');
  assertSourceIncludes(stackWorkspaceSource, 'Keine', 'category mode none label');
  assertSourceIncludes(stackWorkspaceSource, 'Unkategorisiert', 'default custom category label');
  assertSourceIncludes(
    stackWorkspaceSource,
    "activeProducts.length > 0 || productCategoryMode === 'custom'",
    'custom category sections visible on empty stack',
  );
  assertSourceIncludes(stackWorkspaceSource, 'createStackCategory', 'authenticated custom category create endpoint usage');
  assertSourceIncludes(stackWorkspaceSource, 'updateStackCategory', 'authenticated custom category rename endpoint usage');
  assertSourceIncludes(stackWorkspaceSource, 'deleteStackCategory', 'authenticated custom category delete endpoint usage');
  assertSourceExcludes(stackWorkspaceSource, 'ss-category-toolbar', 'always-visible custom category toolbar row');
  assertSourceMatches(
    stackWorkspaceSource,
    /productCategoryMode\s*===\s*['"]custom['"][\s\S]{0,220}ss-category-create-btn/,
    'category create control is only shown in custom category mode',
  );
  assertSourceMatches(
    stackWorkspaceSource,
    /onSubmit=\{handleCreateCategory\}|onSubmit=\{\s*handleCreateCategory\s*\}/,
    'category create modal submit path exists',
  );
  assertSourceMatches(
    stackWorkspaceSource,
    /disabled=\{[^}]*loading[^}]*activeStack[^}]*isCategoryActionBusy/,
    'category create control is disabled while creating/loading',
  );
  assertSourceMatches(
    stackWorkspaceSource,
    /openCreateCategoryModal\(\)|\{openCreateCategoryModal\}/,
    'category create modal open path exists',
  );
  assertSourceMatches(
    stackWorkspaceSource,
    /openRenameCategoryModal\(sectionCategory\)/,
    'category rename modal is opened from editable section actions',
  );
  assertSourceIncludes(stackWorkspaceSource, 'sectionCategory && isProductLayoutEditMode && !sectionCategory.is_default', 'non-default section actions are only shown in edit mode');
  const openRenameCategoryModalSource = extractSourceAfter(stackWorkspaceSource, 'const openRenameCategoryModal = useCallback');
  assertSourceMatches(
    openRenameCategoryModalSource,
    /category\.is_default/,
    'rename flow blocks default categories',
  );
  assertSourceMatches(
    openRenameCategoryModalSource,
    /productCategoryMode\s*!==\s*['"]custom['"]/,
    'rename flow checks custom category mode',
  );
  assertSourceMatches(
    openRenameCategoryModalSource,
    /!activeStack/,
    'rename flow checks active stack readiness',
  );
  const handleDeleteCategorySource = extractSourceAfter(stackWorkspaceSource, 'const handleDeleteCategory = useCallback');
  assertSourceMatches(
    handleDeleteCategorySource,
    /category\.is_default/,
    'delete flow blocks default categories',
  );
  assertSourceMatches(
    handleDeleteCategorySource,
    /productCategoryMode\s*!==\s*['"]custom['"]/,
    'delete flow checks custom category mode',
  );
  assertSourceMatches(
    handleDeleteCategorySource,
    /!activeStack/,
    'delete flow checks active stack readiness',
  );
  assertSourceIncludes(stackWorkspaceSource, 'updateStackItemsLayout', 'authenticated custom layout endpoint usage');
  assertSourceIncludes(stackWorkspaceSource, 'missingStackItemId', 'layout persistence guard for missing stack_item_id');
  assertSourceIncludes(stackWorkspaceSource, 'prepareProductsForAuthenticatedImport', 'demo handoff import category remap helper');
  assertSourceIncludes(stackWorkspaceSource, 'categoryIdMap', 'demo handoff local category id map');
  assertSourceIncludes(stackWorkspaceSource, 'const persistedStack = await persistStackProducts(', 'stack persistence response hydration usage');
  assertSourceIncludes(stackWorkspaceSource, 'getPublicIntakeTimings', 'StackWorkspace must load public managed intake timing options');
  assertSourceIncludes(stackWorkspaceSource, 'managedTimingOptions', 'StackWorkspace must store managed intake timing options');
  assertSourceIncludes(stackWorkspaceSource, 'buildIntakeTimingOptions(managedTimingOptions)', 'StackWorkspace edit modal must use managed timing options with fallback');
  assertSourceIncludes(stackWorkspaceSource, 'timingLabelForDisplay(timing, managedTimingOptions)', 'StackWorkspace timing displays must prefer managed labels');
  if (/return INTAKE_TIMING_LABELS\[normalized\] \?\? raw;/.test(stackWorkspaceSource)) {
    throw new Error('StackWorkspace timingLabelForDisplay must not return raw unknown enum-like values.');
  }
  assertSourceIncludes(stackWorkspaceSource, 'humanizeTimingFallback', 'StackWorkspace must humanize unknown timing fallback values');
  assertSourceIncludes(stackWorkspaceSource, 'A-Z', 'alphabetical sort toggle label');
  assertSourceIncludes(stackWorkspaceSource, 'ss-product-title-controls', 'product title controls wrapper');
  const supplementOverviewTitle = `Supplement ${String.fromCharCode(0xdc)}bersicht`;
  assertSourceExcludes(
    stackWorkspaceSource,
    supplementOverviewTitle,
    'StackWorkspace should no longer include the visible product area title',
  );
  assertSourceIncludes(stackWorkspaceSource, 'ss-control-group-label', 'control group heading markers');
  assertSourceIncludes(stackWorkspaceSource, '>Sortierung<', 'Sortierung control label');
  assertSourceIncludes(stackWorkspaceSource, '>Kategorien<', 'Kategorien control label');
  assertSourceIncludes(stackWorkspaceSource, '>Ansicht<', 'Ansicht control label');
  assertSourceIncludes(stylesSource, '.ss-product-sections', 'section layout styles');
  const productSectionsStyles = stylesSource.match(/\.ss-product-sections\s*\{[\s\S]*?\}/)?.[0] ?? '';
  if (/padding-bottom:\s*150px/.test(productSectionsStyles)) {
    throw new Error('Expected .ss-product-sections desktop padding-bottom to avoid duplicate 150px bottom spacing.');
  }
  assertSourceIncludes(stylesSource, '.ss-category-toolbar', 'custom category toolbar styles');
  assertSourceExcludes(stylesSource, '.ss-product-layout-tools', 'legacy per-card layout controls styles removed');
  assertSourceIncludes(stylesSource, '.ss-product-layout-edit-toolbar', 'per-card edit toolbar styles');
  assertSourceExcludes(stylesSource, '.ss-product-sort-handle', 'per-card drag handle styles removed');
  assertSourceIncludes(stylesSource, '.ss-layout-edit-toggle-btn', 'sort-group edit toggle styles');
  assertSourceIncludes(stylesSource, '.ss-control-group', 'control block styles');
  assertSourceIncludes(stylesSource, '.ss-control-group-label', 'control group label styles');
  assertSourceIncludes(stylesSource, '.ss-control-group-row', 'compact sort/group row styles');
  assertSourceIncludes(stylesSource, '.ss-product-list-media-caption', 'list media caption styles');
  const productListCaptionStyles = stylesSource.match(/\.ss-product-list-media-caption\s*\{[\s\S]*?\}/)?.[0] ?? '';
  if (/text-overflow\s*:\s*ellipsis/.test(productListCaptionStyles)) {
    throw new Error('Expected .ss-product-list-media-caption not to use ellipsis truncation.');
  }
  if (/white-space\s*:\s*nowrap/.test(productListCaptionStyles)) {
    throw new Error('Expected .ss-product-list-media-caption to allow timing label wraps.');
  }
  if (!/overflow-wrap\s*:\s*break-word/.test(productListCaptionStyles)) {
    throw new Error('Expected .ss-product-list-media-caption to use non-aggressive word wrapping.');
  }
  if (!/word-break\s*:\s*normal/.test(productListCaptionStyles)) {
    throw new Error('Expected .ss-product-list-media-caption to keep default word-break behavior.');
  }
  if (!/hyphens\s*:\s*auto/.test(productListCaptionStyles)) {
    throw new Error('Expected .ss-product-list-media-caption to enable German-friendly hyphenation.');
  }
  assertSourceIncludes(stylesSource, '.ss-product-timing-label', 'timing labels use shared wrapping helper');
  const timingLabelStyles = stylesSource.match(/\.ss-product-timing-label\s*\{[\s\S]*?\}/)?.[0] ?? '';
  if (!/white-space\s*:\s*normal/.test(timingLabelStyles)) {
    throw new Error('Expected .ss-product-timing-label to use normal white-space.');
  }
  if (!/overflow-wrap\s*:\s*break-word/.test(timingLabelStyles)) {
    throw new Error('Expected .ss-product-timing-label to use non-aggressive word wrapping.');
  }
  if (!/word-break\s*:\s*normal/.test(timingLabelStyles)) {
    throw new Error('Expected .ss-product-timing-label to keep default word-break behavior.');
  }
  if (!/hyphens\s*:\s*auto/.test(timingLabelStyles)) {
    throw new Error('Expected .ss-product-timing-label to enable German-friendly hyphenation.');
  }
  assertSourceIncludes(stylesSource, '.ss-product-layout-editable-item', 'product card edit mode visual styles');
  assertSourceIncludes(stylesSource, '.ss-product-layout-edit-active', 'edit-mode overlay scope styles');
  assertSourceIncludes(stylesSource, '.ss-product-layout-edit-overlay', 'transparent edit-mode overlay styles');
  if (hasEditModeMasonryGridOverride(stylesSource, { property: 'display', value: 'grid' })) {
    throw new Error('Expected edit-mode masonry-grid related rules to avoid display:grid.');
  }
  if (hasEditModeMasonryGridOverride(stylesSource, { property: 'grid-template-columns', value: /.+/ })) {
    throw new Error('Expected edit-mode masonry-grid related rules to avoid grid-template-columns overrides.');
  }
  if (hasEditModeMasonryGridOverride(stylesSource, { property: 'columns', value: 'initial' })) {
    throw new Error('Expected edit-mode masonry-grid related rules to avoid columns:initial.');
  }
  if (hasEditModeMasonryItemOverride(stylesSource, { property: 'break-inside', value: 'auto' })) {
    throw new Error('Expected edit-mode masonry item rule not to force break-inside:auto.');
  }
  assertMasonryColumnBaseRule(stylesSource, 4);
  assertMasonryColumnMediaRule(stylesSource, 1200, 3);
  assertMasonryColumnMediaRule(stylesSource, 768, 2);
  assertMasonryColumnMediaRule(stylesSource, 480, 1);
  assertSourceIncludes(stylesSource, '.ss-product-layout-drop-target', 'drop target visual styles');
  assertSourceIncludes(stylesSource, '.ss-product-layout-drop-before', 'drop-before visual styles');
  assertSourceIncludes(stylesSource, '.ss-product-layout-drop-after', 'drop-after visual styles');
  assertSourceIncludes(stylesSource, '.ss-product-layout-drop-end', 'section-end drop visual styles');
  const dragDropMarkerBlocks = [
    stylesSource.match(/\.ss-product-layout-item-dragging\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-product-layout-item-dragging\s+\.ss-product-layout-edit-overlay\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-product-layout-drop-target:not\(\.ss-product-layout-drop-end\)\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-product-layout-drop-before::before,\s*\.ss-product-layout-drop-after::after\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-product-section\.ss-product-layout-drop-end\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-product-section\.ss-product-layout-drop-end::after\s*\{[\s\S]*?\}/)?.[0] ?? '',
  ];
  for (const block of dragDropMarkerBlocks) {
    if (!/#(?:d97706|f59e0b)|rgba\((?:245,\s*158,\s*11|217,\s*119,\s*6),/.test(block)) {
      throw new Error('Expected drag/drop movement indicator declarations to use gold/amber markers.');
    }
    if (/#(?:2563eb|4338ca)|rgba\((?:37,\s*99,\s*235|67,\s*56,\s*202),/.test(block)) {
      throw new Error('Expected drag/drop movement indicator declarations not to use blue marker colors.');
    }
  }
  const moveModeAccentBlocks = [
    stylesSource.match(/\.ss-product-layout-edit-mode\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-product-layout-edit-mode:hover\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-product-layout-edit-mode\s+\.ss-product-card,\s*\.ss-product-layout-edit-mode\s+\.ss-product-list-row\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-layout-edit-toggle-btn\s*\{[\s\S]*?\}/)?.[0] ?? '',
    stylesSource.match(/\.ss-layout-edit-toggle-btn\.active\s*\{[\s\S]*?\}/)?.[0] ?? '',
  ];
  for (const block of moveModeAccentBlocks) {
    if (!/#(?:d97706|f59e0b|fbbf24|fffbeb)|rgba\((?:245,\s*158,\s*11|217,\s*119,\s*6),/.test(block)) {
      throw new Error('Expected move/edit-mode accents to use gold/amber styling.');
    }
    if (/#(?:818cf8|a5b4fc|4338ca|6366f1|eef2ff|3730a3)|rgba\(99,\s*102,\s*241,/.test(block)) {
      throw new Error('Expected move/edit-mode accent declarations not to use blue/indigo colors.');
    }
  }
  assertSourceMatches(
    stylesSource,
    /\.ss-product-section\.ss-product-layout-drop-end::after\s*\{[\s\S]*?display\s*:\s*block[\s\S]*?width\s*:\s*100%/,
    'section-end drop marker must render as a visible full-width block',
  );
  assertSourceIncludes(stylesSource, 'pointer-events: none', 'edit-mode overlay must not block card controls');
  assertSourceIncludes(stylesSource, 'transform 0.18s ease', 'live reorder animation transition');
  assertSourceIncludes(stackWorkspaceSource, 'if (draggingProductKey === productKey) return;', 'FLIP must skip dragged product item');
  assertSourceIncludes(stylesSource, 'touch-action: none', 'edit-mode touch drag must not be swallowed by browser scroll gestures');
  assertSourceIncludes(stylesSource, '.ss-product-category-select', 'custom category select fallback styles');
  assertSourceIncludes(stackWorkspaceSource, 'stack-cockpit-user', 'stack hero user identity slot');
  assertSourceIncludes(stackWorkspaceSource, 'getUserDisplayName(user)', 'stack user display-name fallback helper');
  assertSourceIncludes(stackWorkspaceSource, "['name', 'display_name', 'full_name']", 'stack user label fallback fields');
  assertSourceExcludes(stackWorkspaceSource, 'Mein Stack', 'old stack hero label fallback');
  assertSourceExcludes(stackWorkspaceSource, 'Stack erstellen', 'separate toolbar create-stack button copy');
  assertSourceExcludes(stackWorkspaceSource, '<IconStackPlus />', 'separate toolbar create-stack icon');
  assertSourceIncludes(stackWorkspaceSource, 'Neuen Stack anlegen', 'create-stack dropdown option');
  assertSourceIncludes(stackWorkspaceSource, 'CREATE_STACK_SELECT_VALUE', 'sentinel value for create-stack dropdown option');
  assertSourceIncludes(stackWorkspaceSource, 'handleStackSelectChange', 'stack dropdown create/select handler');

  assertSourceIncludes(toolbarSource, 'ss-toolbar-icon-action ss-toolbar-icon-action-edit', 'icon-only edit toolbar action');
  assertSourceIncludes(toolbarSource, 'ss-toolbar-icon-action ss-toolbar-icon-action-blue', 'icon-only blue toolbar actions');
  assertSourceIncludes(toolbarSource, 'ss-toolbar-divider', 'visible toolbar divider before add-product action');
  assertSourceIncludes(toolbarSource, 'ss-toolbar-section-divider', 'toolbar-to-section visual separator marker');
  assertSourceExcludes(toolbarSource, 'ss-toolbar-spacer', 'toolbar spacer before add-product action');
  assertSourceExcludes(stylesSource, '.ss-toolbar-primary-action { margin-left: auto; }', 'far-right toolbar add-product margin');
  assertSourceExcludes(stylesSource, '.ss-toolbar-spacer { flex: 1 1 auto;', 'flex spacer pushing add-product action right');
  if (!/ss-toolbar-divider[\s\S]*ss-toolbar-primary-action[\s\S]*Produkt hinzuf/.test(toolbarSource)) {
    throw new Error('Expected toolbar divider to be followed directly by the add-product action.');
  }
  assertSourceIncludes(toolbarSource, 'aria-label={emailActionLabel}', 'dynamic mail aria label');
  assertSourceIncludes(toolbarSource, 'title={emailActionLabel}', 'dynamic mail title');
  assertSourceIncludes(toolbarSource, 'IconPdf', 'PDF icon for print/PDF action');
  assertSourceIncludes(stylesSource, '.ss-toolbar-section-divider', 'toolbar section separator style');
  assertSourceExcludes(toolbarSource, '\n            Stack bearbeiten\n', 'visible edit toolbar text');
  assertSourceExcludes(toolbarSource, "{emailSending ? 'Wird gesendet...' : 'Stack mailen'}", 'visible mail toolbar text');
  assertSourceExcludes(toolbarSource, '\n            Plan drucken/PDF\n', 'visible print toolbar text');
  assertSourceExcludes(toolbarSource, '\n            Stack löschen\n', 'visible delete toolbar text');
}

function assertProductCardStaticChecks(productCardSource, stylesSource) {
  const listActionsStackStyle = stylesSource.match(/\.ss-product-list-actions-stack\s*\{[\s\S]*?\}/)?.[0] ?? '';
  if (listActionsStackStyle && /display\s*:\s*contents/.test(listActionsStackStyle)) {
    throw new Error('QA guard: .ss-product-list-actions-stack must not use display: contents.');
  }

  const listActionsPanelStyle = stylesSource.match(/\.ss-product-list-actions-panel\s*\{[\s\S]*?\}/)?.[0] ?? '';
  if (!listActionsPanelStyle) {
    throw new Error('Expected styles.css to contain .ss-product-list-actions-panel block.');
  }
  if (/display\s*:\s*contents/.test(listActionsPanelStyle)) {
    throw new Error('QA guard: .ss-product-list-actions-panel must not use display: contents.');
  }
  if (!/width:\s*272px/.test(listActionsPanelStyle) || !/flex:\s*0 0 272px/.test(listActionsPanelStyle)) {
    throw new Error('Expected .ss-product-list-actions-panel to keep the widened 272px desktop action panel.');
  }

  const listActionPanelStart = productCardSource.indexOf('<div className="ss-product-list-actions-panel ss-product-list-actions-stack">');
  if (listActionPanelStart === -1) {
    throw new Error('Expected ProductCard.tsx to contain a list actions panel in list view.');
  }
  const listActionArticleEnd = productCardSource.indexOf('</article>', listActionPanelStart);
  if (listActionArticleEnd === -1) {
    throw new Error('Could not locate ProductCard.tsx list row closing tag for actions-panel validation.');
  }

  const listActionPanelSource = productCardSource.slice(listActionPanelStart, listActionArticleEnd);
  const listActionsRowIndex = listActionPanelSource.indexOf('<div className="ss-product-list-actions">');
  if (listActionsRowIndex === -1) {
    throw new Error('Expected list actions row class ss-product-list-actions in ProductCard list row.');
  }

  const beforeActionsRow = listActionPanelSource.slice(0, listActionsRowIndex);
  if (
    /className="ss-product-list-buy"/.test(beforeActionsRow) ||
    /className="ss-product-list-report"/.test(beforeActionsRow)
  ) {
    throw new Error('Expected Buy/Report buttons to render inside ss-product-list-actions.');
  }
  const actionsRowSource = listActionPanelSource.slice(listActionsRowIndex);
  if (!/className="ss-product-list-buy"/.test(actionsRowSource) && !/className="ss-product-list-report"/.test(actionsRowSource)) {
    throw new Error('Expected Buy or Report button inside ss-product-list-actions.');
  }

  const listActionsRowStyle = stylesSource.match(/\.ss-product-list-actions\s*\{[\s\S]*?\}/)?.[0] ?? '';
  if (!listActionsRowStyle.includes('gap: 5px') || !listActionsRowStyle.includes('margin-top: 8px')) {
    throw new Error('Expected compact desktop ss-product-list-actions layout to match actions-row spacing.');
  }
  if (!/flex-wrap:\s*nowrap/.test(listActionsRowStyle)) {
    throw new Error('Expected desktop ss-product-list-actions to keep nowrap spacing.');
  }
  if (/overflow\s*:\s*hidden/.test(listActionsRowStyle)) {
    throw new Error('QA guard: .ss-product-list-actions must not hide overflowing action buttons.');
  }
  if (!/width:\s*100%/.test(listActionsRowStyle) || !/max-width:\s*100%/.test(listActionsRowStyle)) {
    throw new Error('Expected desktop ss-product-list-actions to stay within its panel width.');
  }

  const buyStyle = stylesSource.match(/\.ss-product-list-buy,\s*\.ss-product-list-report,\s*\.ss-product-list-alt\s*\{[\s\S]*?\}/)?.[0] ?? '';
  if (
    !buyStyle.includes('.ss-product-list-buy') ||
    !buyStyle.includes('.ss-product-list-report') ||
    !buyStyle.includes('.ss-product-list-alt')
  ) {
    throw new Error('Expected desktop list row action button rule to cover Buy, Report, and Alternative buttons.');
  }
  if (!/padding:\s*6px 12px/.test(buyStyle) || !/white-space:\s*nowrap/.test(stylesSource.match(/\.ss-product-list-buy[\s\S]*?\{[\s\S]*?\}/)?.[0] ?? '')) {
    throw new Error('Expected ProductCard buy/report/alternative button sizing to match row-based actions style.');
  }
  if (!/flex:\s*0 0 auto/.test(buyStyle)) {
    throw new Error('Expected list row action buttons to avoid desktop flex squeezing.');
  }

  const actionTextStyle = stylesSource.match(/\.ss-product-list-buy span,\s*\.ss-product-list-report span,\s*\.ss-product-list-alt span\s*\{[\s\S]*?\}/)?.[0] ?? '';
  if (
    !actionTextStyle.includes('.ss-product-list-buy span') ||
    !actionTextStyle.includes('.ss-product-list-report span') ||
    !actionTextStyle.includes('.ss-product-list-alt span')
  ) {
    throw new Error('Expected list row Buy/Report/Alt text span rule to cover all action labels.');
  }
  if (/text-overflow\s*:\s*ellipsis/.test(actionTextStyle) || /max-width\s*:/.test(actionTextStyle) || /overflow\s*:\s*hidden/.test(actionTextStyle)) {
    throw new Error('Expected list row Buy/Report text spans to remain fully visible without ellipsis/max-width clipping.');
  }

  const requiredProductCardMarkers = [
    'ss-product-list-media-panel',
    'ss-product-list-content',
    'ss-product-list-main',
    'ss-product-list-price',
    'ss-product-list-actions-stack',
    'ss-product-warning-summary',
    'compactWarnings.map',
    'data-warning-severity',
    'ss-product-warning-severity-',
    'openWarning &&',
    'ModalWrapper onClose',
    'Achtung',
    'title="Produkt entfernen"',
    'ss-product-timing-label',
  ];
  const requiredCodeMarkers = [
    'function getListDoseFallback',
    'function parseCountDoseFromText',
    'function getListCountFallback',
  ];

  for (const marker of requiredProductCardMarkers) {
    if (!productCardSource.includes(marker)) {
      throw new Error(`Expected ProductCard.tsx to contain ${marker}.`);
    }
  }
  for (const marker of requiredCodeMarkers) {
    if (!productCardSource.includes(marker)) {
      throw new Error(`Expected ProductCard.tsx source to include ${marker}.`);
    }
  }

  const listDoseFallbackStart = productCardSource.indexOf('function getListDoseFallback');
  const listDoseFallbackEnd = productCardSource.indexOf('function getProductWarningTitle', listDoseFallbackStart);
  if (listDoseFallbackStart === -1 || listDoseFallbackEnd === -1) {
    throw new Error('Expected getListDoseFallback and subsequent warning-title marker in ProductCard.tsx.');
  }

  const listDoseFallbackSource = productCardSource
    .slice(listDoseFallbackStart, listDoseFallbackEnd);

  if (!/isListMassUnit/.test(listDoseFallbackSource) && !/LIST_MASS_UNITS/.test(listDoseFallbackSource)) {
    throw new Error('Expected getListDoseFallback to reject active mass units (mg/ug/IE) in list fallback logic.');
  }
  if (!/return '\\u2014'/.test(listDoseFallbackSource) && !/getListCountFallback/.test(listDoseFallbackSource)) {
    throw new Error('Expected getListDoseFallback to prefer count-based fallback or dash when dosage mass units are active.');
  }
  if (!/lutschtablette/.test(productCardSource.toLowerCase())) {
    throw new Error('Expected ProductCard.tsx to support lutschtablette as count-form dosage unit.');
  }

  const requiredStyleMarkers = [
    '.ss-product-list-media-panel',
    '.ss-product-list-content',
    '.ss-product-list-main',
    '.ss-product-list-price',
    '.ss-product-timing-label',
    '.ss-product-list-media-caption',
    '.ss-product-warning-severity-danger',
    '.ss-product-warning-severity-caution',
    '.ss-product-warning-severity-info',
  ];

  for (const marker of requiredStyleMarkers) {
    if (!stylesSource.includes(marker)) {
      throw new Error(`Expected styles.css to contain ${marker}.`);
    }
  }

  if (productCardSource.includes('ss-product-warning-detail') || productCardSource.includes('role="tooltip"')) {
    throw new Error('Expected ProductCard.tsx to use modal warning details only, without inline tooltip markup.');
  }

  const germanTimingFunctionSource = productCardSource;
  for (const [rawValue, germanLabel] of [
    ['evening', 'Abends'],
    ['EVENING', 'Abends'],
    ['with_meal', 'Zum Essen'],
    ['before_breakfast', 'Vor dem Frühstück'],
    ['after_breakfast', 'Nach dem Frühstück'],
    ['morning_evening', 'Morgens & Abends'],
    ['flexible', 'Jederzeit'],
  ]) {
    if (!germanTimingFunctionSource.includes(rawValue) || !germanTimingFunctionSource.includes(germanLabel)) {
      throw new Error(`Expected ProductCard timing label mapping ${rawValue} -> ${germanLabel}.`);
    }
  }
  if (/effectiveTiming \? effectiveTiming : timing\.label/.test(productCardSource)) {
    throw new Error('ProductCard.tsx must not render raw effectiveTiming values in stack cards or list captions.');
  }
  assertSourceIncludes(productCardSource, 'timing_label?: string | null', 'ProductCard product type must accept managed timing labels');
  assertSourceIncludes(productCardSource, 'ingredient_timing_label?: string | null', 'ProductCard product type must accept managed ingredient timing labels');
  assertSourceIncludes(productCardSource, 'const effectiveTimingLabel = product.ingredient_timing_label?.trim() || product.timing_label?.trim()', 'ProductCard must prefer managed timing labels before raw timing');
  assertSourceIncludes(productCardSource, 'const timingLabel = getTimingDisplayLabel(effectiveTiming, effectiveTimingLabel)', 'central German timing display label helper must accept managed labels');
  if (/timingKey === 'anytime' \? raw : TIMING_STYLES\[timingKey\]\.label/.test(productCardSource)) {
    throw new Error('ProductCard timing fallback must not return raw unknown enum-like values.');
  }
  assertSourceIncludes(productCardSource, 'humanizeTimingFallback', 'ProductCard must humanize unknown timing fallback values');
  const listRowStyles = Array.from(stylesSource.matchAll(/^\s*\.ss-product-list-row\s*\{[^}]*\}/gm), (match) => match[0]);
  const listRowStyle = listRowStyles[0] ?? '';
  const listMediaPanelStyle = stylesSource.match(/\.ss-product-list-media-panel\s*\{[^}]*\}/)?.[0] ?? '';

  if (!/display:\s*flex;[\s\S]*align-items:\s*stretch;/.test(listRowStyle)) {
    throw new Error('Expected list rows to use the Variante 4 three-panel flex row.');
  }

  if (/grid-template-columns:/.test(listRowStyle)) {
    throw new Error('Product list rows must not use the old four-column grid.');
  }

  if (stylesSource.includes('.ss-product-warning-summary:hover .ss-product-warning-detail')
    || stylesSource.includes('.ss-product-warning-detail.open')) {
    throw new Error('Product warning popover CSS should be replaced by click modals only.');
  }

  if (!/(?:width|flex):\s*(?:92px|0\s+0\s+92px)/.test(listMediaPanelStyle)) {
    throw new Error('Expected a fixed left timing/media panel for Variante 4 list rows.');
  }

  if (!/@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*^\s*\.ss-product-list-row\s*\{[\s\S]*flex-direction:\s*column;/m.test(stylesSource)) {
    throw new Error('Expected list rows to stack below 720px without horizontal overflow.');
  }
}

function normalizeBaseUrl(raw) {
  const value = raw.trim().replace(/\/$/, '');
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    throw new Error(`BASE_URL must start with http:// or https://, got: ${raw}`);
  }
  return value;
}

function routeUrl(baseUrl, route) {
  return `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;
}

function apiUrl(apiBaseUrl, path) {
  return `${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function sessionCookie(baseUrl, token) {
  const url = new URL(baseUrl);
  return {
    name: 'session',
    value: token,
    url: url.origin,
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
  };
}

function isProtectedRoute(route) {
  return AUTH_REQUIRED_ROUTES.has(normalizeRoute(route));
}

function normalizeRoute(route) {
  return route.replace(/\?.*$/, '').replace(/\/+$/, '') || '/';
}

function parseRoutes() {
  const custom = env('USER_QA_ROUTES').trim();
  if (!custom) return DEFAULT_TARGETS.map((target) => ({ ...target }));
  const routeMap = new Map();
  for (const entry of custom.split(',').map((item) => item.trim()).filter(Boolean)) {
    routeMap.set(entry, {
      route: entry,
      authRequired: isProtectedRoute(entry),
    });
  }
  return Array.from(routeMap.values());
}

function hasBlockingText(text) {
  return (
    text.includes('404') ||
    text.includes('Not Found') ||
    text.includes('Serverfehler') ||
    text.includes('Unauthorized') ||
    text.includes('Forbidden')
  );
}

function normalizePath(pathname) {
  if (!pathname) return '/';
  return pathname === '/' ? '/' : pathname.replace(/\/$/, '');
}

function assertRouteState(state, target, isAuthenticated) {
  const route = target.route;
  const actual = normalizePath(state.pathname);
  const expected = normalizePath(normalizeRoute(route));

  if (state.hasBlockingText) {
    throw new Error(`Blocking UI text found for ${route}`);
  }

  if (target.authRequired) {
    if (!isAuthenticated) {
      if (!actual.startsWith('/login') && !actual.startsWith(expected)) {
        throw new Error(`Expected ${route} to be protected when unauthenticated; got ${state.pathname}`);
      }
      return;
    }
    if (!actual.startsWith(expected)) {
      throw new Error(`Expected authenticated route ${expected}, got ${state.pathname}`);
    }
    return;
  }

  if (expected === '/') {
    if (actual !== '/') {
      throw new Error(`Expected home route, got ${state.pathname}`);
    }
    return;
  }

  if (actual.startsWith(expected)) return;

  if (isAuthenticated && (route === '/login' || route === '/register' || route === '/forgot-password')) {
    return;
  }

  if (!isAuthenticated && (route === '/login' || route === '/register' || route === '/forgot-password')) {
    if (!actual.startsWith(route)) {
      throw new Error(`Expected ${route}, got ${state.pathname}`);
    }
  }
}

async function resolveToken(apiBaseUrl) {
  const directToken = env('USER_QA_TOKEN');
  if (directToken) return directToken;

  const email = env('USER_QA_EMAIL');
  const password = env('USER_QA_PASSWORD');
  if (!email || !password) return null;

  const response = await fetch(apiUrl(apiBaseUrl, '/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }
  if (!response.ok || !body?.token) {
    throw new Error(`User login failed (${response.status}): ${body?.error || bodyText}`);
  }
  return body.token;
}

async function verifyUserToken(apiBaseUrl, token) {
  const response = await fetch(apiUrl(apiBaseUrl, '/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`USER token preflight failed (${response.status}): ${bodyText}`);
  }
}

async function runApiChecks(apiBaseUrl, token) {
  if (env('USER_QA_SKIP_API_GUARDS') === '1') return;

  const checks = [{ method: 'GET', path: '/demo/products', expected: 200 }];
  if (token) {
    checks.push({ method: 'GET', path: '/me', expected: 200 });
    checks.push({ method: 'GET', path: '/stacks', expected: 200 });
  } else {
    checks.push({ method: 'GET', path: '/me', expected: 401 });
    checks.push({ method: 'GET', path: '/stacks', expected: 401 });
  }

  for (const check of checks) {
    const response = await fetch(apiUrl(apiBaseUrl, check.path), {
      method: check.method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.status !== check.expected) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `User API check failed: ${check.method} ${check.path} expected ${check.expected}, got ${response.status}${bodyText ? ` (${bodyText.slice(0, 160)})` : ''}`
      );
    }
    console.log(`ok user api-check ${check.method} ${check.path} -> ${response.status}`);
  }
}

async function loadPlaywright() {
  const candidates = [
    join(REPO_ROOT, 'node_modules', 'playwright', 'index.js'),
    join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'index.js'),
    join(REPO_ROOT, 'frontend', 'node_modules', 'playwright', 'index.js'),
    join(REPO_ROOT, 'frontend', 'node_modules', '@playwright', 'test', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }
  return null;
}

function browserCandidates() {
  if (env('USER_QA_BROWSER_PATH')) return [env('USER_QA_BROWSER_PATH')];
  if (process.platform === 'win32') {
    const roots = [
      env('PROGRAMFILES'),
      env('PROGRAMFILES(X86)'),
      env('LOCALAPPDATA'),
    ].filter(Boolean);
    return [
      ...roots.map((root) => join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
      ...roots.map((root) => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')),
    ];
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

function findBrowserExecutable() {
  const candidate = browserCandidates().find((item) => item && existsSync(item));
  if (!candidate) {
    throw new Error('No Chrome/Edge executable found. Set USER_QA_BROWSER_PATH or install Playwright.');
  }
  return candidate;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function safeCleanupDirectory(targetPath) {
  try {
    rmSync(targetPath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup for Windows/locked temp profile folders.
  }
}

async function runWithPlaywright(playwright, config) {
  const browser = await playwright.chromium.launch({
    headless: !config.headful,
    executablePath: config.browserPath || undefined,
  });
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        isMobile: viewport.mobile,
        hasTouch: viewport.hasTouch,
      });
      if (config.token) {
        await context.addCookies([sessionCookie(config.baseUrl, config.token)]);
      }
      for (const target of config.routes) {
        const page = await context.newPage();
        const response = await page.goto(routeUrl(config.baseUrl, target.route), { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        if (response && response.status() >= 500) {
          throw new Error(`Navigation to ${target.route} failed with HTTP ${response.status()}`);
        }
        const state = await page.evaluate(() => {
          const text = document.body ? document.body.innerText : '';
          return { pathname: window.location.pathname, hasBlockingText: hasBlockingText(text) };
        });
        assertRouteState(state, target, Boolean(config.token));
        if (config.screenshotDir) {
          await page.screenshot({
            path: join(config.screenshotDir, `${viewport.name}-${target.route.replace(/\//g, '-') || 'root'}.png`),
            fullPage: false,
          });
        }
        console.log(`ok ${viewport.name} ${target.route}`);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = net.createServer();
    server.unref();
    server.on('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

function waitForJson(url, timeoutMs = 10000) {
  return (async function wait() {
    const startedAt = Date.now();
    let lastError;
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const response = await fetch(url);
        if (response.ok) return response.json();
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await delay(150);
    }
    throw lastError ?? new Error(`Timed out waiting for ${url}`);
  })();
}

async function createTarget(port) {
  const url = `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`;
  let response = await fetch(url, { method: 'PUT' });
  if (response.status === 405) response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not create browser target (${response.status})`);
  }
  return response.json();
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  connect() {
    return new Promise((resolveConnect, rejectConnect) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener('open', () => resolveConnect(this));
      this.ws.addEventListener('error', rejectConnect);
      this.ws.addEventListener('message', (event) => this.handleMessage(event.data));
      this.ws.addEventListener('close', () => {
        for (const { reject } of this.pending.values()) {
          reject(new Error('CDP socket closed'));
        }
        this.pending.clear();
      });
    });
  }

  handleMessage(data) {
    const message = JSON.parse(data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ''}`));
      } else {
        resolve(message.result ?? {});
      }
      return;
    }
    const listeners = this.events.get(message.method) ?? [];
    for (const listener of listeners) {
      listener(message.params ?? {});
    }
  }

  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
      return Promise.reject(new Error('CDP socket is not open'));
    }
    return new Promise((resolveSend, rejectSend) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

async function waitForPageReady(page, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await page.send('Runtime.evaluate', {
      expression: `document.readyState === 'complete' && Boolean(document.body)`,
      returnByValue: true,
    }).catch(() => ({ result: { value: false } }));
    if (result.result?.value) return;
    await delay(150);
  }
  throw new Error('Timed out waiting for document readiness');
}

async function runWithCdp(config) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('This fallback needs Node with global WebSocket support. Use Node 22+ or install Playwright.');
  }

  const browserPath = config.browserPath || findBrowserExecutable();
  const port = await getFreePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'supplement-user-smoke-'));
  const browser = spawn(browserPath, [
    config.headful ? '' : '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    '--disable-sync',
    'about:blank',
  ].filter(Boolean), {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let browserStderr = '';
  browser.stderr.on('data', (chunk) => {
    browserStderr += String(chunk);
  });

  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    for (const viewport of VIEWPORTS) {
      const target = await createTarget(port);
      const page = await new CdpClient(target.webSocketDebuggerUrl).connect();
      try {
        await page.send('Page.enable');
        await page.send('Runtime.enable');
        if (config.token) {
          await page.send('Network.enable');
          const cookie = sessionCookie(config.baseUrl, config.token);
          const cookieResult = await page.send('Network.setCookie', cookie);
          if (cookieResult.success !== true) {
            throw new Error('Could not set user session cookie in browser context.');
          }
        }
        await page.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.deviceScaleFactor,
          mobile: viewport.mobile,
          screenWidth: viewport.width,
          screenHeight: viewport.height,
        });
        await page.send('Emulation.setTouchEmulationEnabled', {
          enabled: viewport.hasTouch,
        });

        for (const targetRoute of config.routes) {
          await page.send('Page.navigate', { url: routeUrl(config.baseUrl, targetRoute.route) });
          await waitForPageReady(page);
          const result = await page.send('Runtime.evaluate', {
            expression: `(() => {
              const text = document.body ? document.body.innerText : '';
              return {
                pathname: window.location.pathname,
                hasBlockingText: ${hasBlockingText.toString()}(text),
              };
            })()`,
            returnByValue: true,
          });
          assertRouteState(result.result.value, targetRoute, Boolean(config.token));
          if (config.screenshotDir) {
            const screenshot = await page.send('Page.captureScreenshot', {
              format: 'png',
              captureBeyondViewport: false,
            });
            writeFileSync(
              join(config.screenshotDir, `${viewport.name}-${targetRoute.route.replace(/\//g, '-') || 'root'}.png`),
              Buffer.from(screenshot.data, 'base64')
            );
          }
          console.log(`ok ${viewport.name} ${targetRoute.route}`);
        }
      } finally {
        page.close();
      }
    }
  } finally {
    browser.kill();
    safeCleanupDirectory(userDataDir);
    if (browserStderr.trim()) {
      console.error(browserStderr.trim().split('\n').slice(-6).join('\n'));
    }
  }
}

async function main() {
  parseArgs();
  const baseUrl = normalizeBaseUrl(env('BASE_URL') || env('USER_QA_BASE_URL', 'https://supplementstack.de'));
  const apiBaseUrl = normalizeBaseUrl(env('USER_QA_API_BASE_URL', `${baseUrl}/api`));
  const routes = parseRoutes();
  const screenshotDir = env('USER_QA_SCREENSHOT_DIR')
    ? resolve(REPO_ROOT, env('USER_QA_SCREENSHOT_DIR'))
    : '';
  if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

  const token = await resolveToken(apiBaseUrl);
  const hasUserAuth = Boolean(token);
  if (hasUserAuth) {
    await verifyUserToken(apiBaseUrl, token);
  } else {
    console.log('No USER_QA_TOKEN or USER_QA_EMAIL/PASSWORD provided. Running public + guard checks.');
  }

  await runApiChecks(apiBaseUrl, token);

  const config = {
    baseUrl,
    apiBaseUrl,
    routes,
    token,
    screenshotDir,
    headful: env('USER_QA_HEADFUL') === '1',
    browserPath: env('USER_QA_BROWSER_PATH'),
  };

  console.log(`User smoke mode: ${hasUserAuth ? 'authenticated' : 'public'} flow`);
  console.log(`Base URL: ${baseUrl}`);

  const playwright = await loadPlaywright();
  if (playwright) {
    console.log('Using existing Playwright installation.');
    await runWithPlaywright(playwright, config);
  } else {
    console.log('Playwright not found; using Chrome/Edge DevTools fallback.');
    await runWithCdp(config);
  }

  console.log('User browser smoke passed.');
}

main().catch((error) => {
  console.error(`User browser smoke failed: ${error.message}`);
  console.error('Run with --help for environment variables and examples.');
  process.exit(1);
});
