// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LegalDisclaimer from './LegalDisclaimer';

describe('LegalDisclaimer', () => {
  it('keeps the single global affiliate disclosure used in the footer', () => {
    render(<LegalDisclaimer variant="affiliate" />);

    expect(screen.getByText(/Einige Produktlinks können Affiliate-Links sein/)).toBeTruthy();
    expect(screen.getByText(/Für dich entstehen dadurch keine zusätzlichen Kosten/)).toBeTruthy();
  });
});
