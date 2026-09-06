/** Keep concrete validation/conflict messages, but never expose generic transport/parser failures. */
export function operationErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || error instanceof TypeError || error instanceof SyntaxError) return fallback;
  const message = error.message.trim();
  if (!message || /^(?:unbekannter fehler\.?|unknown error\.?|failed to fetch|network error|networkerror.*|load failed|anfrage fehlgeschlagen\.?)$/i.test(message)) return fallback;
  return message;
}
