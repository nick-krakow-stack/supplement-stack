// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import LegalDisclaimer from './LegalDisclaimer';

describe('LegalDisclaimer', () => {
  afterEach(cleanup);

  it('uses the exact orientation text while keeping the existing quiet disclosure', () => {
    const { container } = render(<LegalDisclaimer variant="health" />);
    const visibleText = [...container.querySelectorAll('summary, p')].map((node) => node.textContent?.replace(/\s+/g, ' ').trim()).join(' ');
    expect(visibleText).toBe(
      'Diese Inhalte dienen nur zur Orientierung und ersetzen keine medizinische Beratung. Bei Fragen sprich bitte mit ärztlichem oder pharmazeutischem Fachpersonal. Nahrungsergänzungsmittel ersetzen keine ausgewogene Ernährung.',
    );
    expect(container.querySelector('details')).toBeTruthy();
    expect(container.querySelector('summary')?.textContent?.trim()).toBe('Diese Inhalte dienen nur zur Orientierung und ersetzen keine medizinische Beratung.');
    expect(container.textContent).not.toMatch(/\*|konsultiere/i);
  });

  it('keeps the single global affiliate disclosure used in the footer', () => {
    const { container } = render(<LegalDisclaimer variant="affiliate" />);

    expect(screen.getByText(/Einige Produktlinks können Affiliate-Links sein/)).toBeTruthy();
    expect(screen.getByText(/Für dich entstehen dadurch keine zusätzlichen Kosten/)).toBeTruthy();
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('* Einige Produktlinks können Affiliate-Links sein. Wenn du darüber kaufst, erhält der Betreiber ggf. eine Provision. Für dich entstehen dadurch keine zusätzlichen Kosten und die Produktreihung orientiert sich nicht am Provisionsmodell.');
  });
});
