// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImageCropModal from './ImageCropModal';

describe('ImageCropModal product photo guardrails', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('benennt den Dialog, fokussiert Schließen und reagiert auf Escape', () => {
    const onClose = vi.fn();
    render(<ImageCropModal onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'Produktfoto zuschneiden' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Foto-Dialog schließen' })).toBe(document.activeElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('weist nicht unterstützte Formate und Dateien über 10 MB verständlich ab', () => {
    render(<ImageCropModal onClose={() => undefined} />);
    const input = screen.getByLabelText('Produktfoto auswählen');

    const gif = new File(['gif'], 'produkt.gif', { type: 'image/gif' });
    fireEvent.change(input, { target: { files: [gif] } });
    expect(screen.getByRole('alert').textContent).toContain('JPEG, PNG oder WebP');

    const largeJpeg = new File(['jpeg'], 'produkt.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeJpeg, 'size', { value: 10 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [largeJpeg] } });
    expect(screen.getByRole('alert').textContent).toContain('größer als 10 MB');
  });
});
