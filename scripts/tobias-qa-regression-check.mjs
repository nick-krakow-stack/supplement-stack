import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

const landingPage = read('frontend/src/pages/LandingPage.tsx')
const stackWorkspace = read('frontend/src/components/StackWorkspace.tsx')
const productStepMatch = stackWorkspace.match(/\{step === 'products' && ingredient && \([\s\S]*?\n\s*\)\}/)
const productStep = productStepMatch?.[0] ?? ''

check(
  landingPage.includes('Wissenschaftlich. Einfach. Kostenlos.'),
  'LandingPage hero must say "Wissenschaftlich. Einfach. Kostenlos."',
)
check(
  !landingPage.includes('Wissenschaftlich. Einfach. Kosteneffizient.'),
  'LandingPage hero must not say "Wissenschaftlich. Einfach. Kosteneffizient."',
)

check(!/step === 'form'/.test(stackWorkspace), 'StackWorkspace must not render a step === "form" branch')
check(!/setStep\('form'\)/.test(stackWorkspace), 'AddProductModal must not navigate to a form step')
check(!/useState<[^>]*'form'[^>]*>/.test(stackWorkspace), 'AddProductModal step type must not include "form"')

check(productStep.length > 0, 'StackWorkspace products step branch must be discoverable')
check(
  productStep.includes('Alle Formen'),
  'Product selection must expose a default "Alle Formen" form filter',
)
check(
  productStep.includes('selectedFormId') && productStep.includes('setSelectedFormId'),
  'Product selection form filter must be wired to selectedFormId',
)

for (const forbiddenText of ['Form auswahlen', 'Weiter zur Dosierung', 'Zuruck zur Formauswahl']) {
  check(!stackWorkspace.includes(forbiddenText), `AddProductModal must not show "${forbiddenText}"`)
}

if (failures.length > 0) {
  console.error(`Tobias QA regression check failed with ${failures.length} issue(s):`)
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Tobias QA regression check passed')
