type LocationLike = {
  pathname?: string;
  search?: string;
  hash?: string;
  state?: unknown;
};

const RETURN_TO_MAX_LENGTH = 2048;
const INTERNAL_BASE = 'https://supplement-stack.invalid';

function isSafeInternalStage(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('\\') || [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) return false;
  try {
    const parsed = new URL(value, INTERNAL_BASE);
    return parsed.origin === INTERNAL_BASE && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function safeInternalReturnTo(value: unknown, fallback = '/stacks'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > RETURN_TO_MAX_LENGTH) return fallback;
  if (value.trim() !== value) return fallback;
  let stage = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!isSafeInternalStage(stage)) return fallback;
    let decoded: string;
    try {
      decoded = decodeURIComponent(stage);
    } catch {
      return fallback;
    }
    if (decoded === stage) return value;
    stage = decoded;
  }
  return fallback;
}

export function currentLocationReturnTo(location: LocationLike): string {
  return safeInternalReturnTo(
    `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`,
    '/stacks',
  );
}

export function authReturnTo(location: LocationLike, fallback = '/stacks'): string {
  const query = new URLSearchParams(location.search || '');
  const queryValue = query.get('returnTo') ?? query.get('redirect');
  if (queryValue !== null) return safeInternalReturnTo(queryValue, fallback);

  const state = location.state && typeof location.state === 'object'
    ? location.state as {
      returnTo?: unknown;
      redirect?: unknown;
      from?: { pathname?: unknown; search?: unknown; hash?: unknown };
    }
    : null;
  const direct = state?.returnTo ?? state?.redirect;
  if (direct !== undefined) return safeInternalReturnTo(direct, fallback);
  if (state?.from && typeof state.from.pathname === 'string') {
    const from = `${state.from.pathname}${typeof state.from.search === 'string' ? state.from.search : ''}${typeof state.from.hash === 'string' ? state.from.hash : ''}`;
    return safeInternalReturnTo(from, fallback);
  }
  return fallback;
}

export function authPath(route: '/login' | '/register' | '/verify-email', returnTo: string): string {
  const params = new URLSearchParams({ returnTo: safeInternalReturnTo(returnTo) });
  return `${route}?${params.toString()}`;
}
