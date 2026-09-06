import { describe, expect, it } from 'vitest';
import { operationErrorMessage } from './operationError';
import { routeLoadingText } from './routeLoadingText';

describe('contextual loading and fallback errors', () => {
  const fallback = 'Das Speichern hat gerade nicht geklappt. Bitte versuche es erneut.';
  it.each([null, {}, undefined, new Error('Unbekannter Fehler.'), new Error('Unknown error'), new Error(''), new TypeError('Failed to fetch'), new SyntaxError('Unexpected token <'), new Error('Network Error')])('replaces only unhelpful generic failures (%s)', (error) => {
    expect(operationErrorMessage(error, fallback)).toBe(fallback);
  });
  it.each(['Die Menge muss größer als 0 sein.', 'Du hast keine Berechtigung.', 'Das Produkt wurde inzwischen geändert. Bitte lade es neu.', 'Der Eintrag wurde nicht gefunden.'])('preserves the concrete reason %s', (message) => {
    expect(operationErrorMessage(new Error(message), fallback)).toBe(message);
  });
  it.each([
    ['/stacks', 'Deine Stacks werden geladen …'],
    ['/wissen/vitamin-d', 'Artikel wird geladen …'],
    ['/creator', 'Dein Creator-Bereich wird geladen …'],
    ['/share/secret-token', 'Die Empfehlung wird geladen …'],
    ['/my-products/', 'Deine Produkte werden geladen …'],
    ['/administrator/interactions', 'Der Admin-Bereich wird geladen …'],
    ['/datenschutz', 'Die Datenschutzerklärung wird geladen …'],
    ['/login', 'Die Anmeldung wird vorbereitet …'],
  ])('names the actual pending screen for %s without reflecting route values', (path, message) => {
    expect(routeLoadingText(path)).toBe(message);
    expect(routeLoadingText(path)).not.toContain('secret-token');
  });
});
