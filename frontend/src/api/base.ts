const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const configuredApiBaseUrl = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_URL
  : undefined;

function isLocalBrowserHost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return LOCAL_HOSTS.has(window.location.hostname);
}

export function getApiBaseUrl(): string {
  if (configuredApiBaseUrl && isLocalBrowserHost()) {
    return configuredApiBaseUrl;
  }

  return '/api';
}

export const apiBaseUrl = getApiBaseUrl();

export function apiPath(path: string): string {
  const normalizedBase = apiBaseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}
