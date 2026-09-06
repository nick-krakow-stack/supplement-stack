const routeLabels: Record<string, string> = {
  '/': 'Die Startseite wird geladen …',
  '/wissen': 'Die Wissensübersicht wird geladen …',
  '/stacks': 'Deine Stacks werden geladen …',
  '/demo': 'Die Demo wird geladen …',
  '/einnahmeplan': 'Dein Einnahmeplan wird geladen …',
  '/creator': 'Dein Creator-Bereich wird geladen …',
  '/my-products': 'Deine Produkte werden geladen …',
  '/profile': 'Dein Profil wird geladen …',
  '/login': 'Die Anmeldung wird vorbereitet …',
  '/register': 'Die Registrierung wird vorbereitet …',
  '/forgot-password': 'Die Passwort-Hilfe wird geladen …',
  '/reset-password': 'Das Zurücksetzen deines Passworts wird vorbereitet …',
  '/verify-email': 'Die E-Mail-Bestätigung wird vorbereitet …',
  '/impressum': 'Das Impressum wird geladen …',
  '/datenschutz': 'Die Datenschutzerklärung wird geladen …',
  '/nutzungsbedingungen': 'Die Nutzungsbedingungen werden geladen …',
  '/agb': 'Die Nutzungsbedingungen werden geladen …',
};

export function routeLoadingText(pathname: string): string {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path.startsWith('/wissen/')) return 'Artikel wird geladen …';
  if (path.startsWith('/share/')) return 'Die Empfehlung wird geladen …';
  if (path === '/administrator' || path.startsWith('/administrator/')) return 'Der Admin-Bereich wird geladen …';
  return routeLabels[path] ?? 'Die Seite wird geladen …';
}
