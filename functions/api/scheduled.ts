// ---------------------------------------------------------------------------
// Scheduled maintenance entry points.
// Cloudflare Workers cron triggers call this default export when this module is
// deployed as a Worker entry. The Pages route itself is intentionally closed;
// this is not a public API.
// ---------------------------------------------------------------------------

import type { Env } from './lib/types'

const AFFILIATE_LINK_HEALTH_CRON = '17 2 * * *'
const MAX_LINKS_PER_RUN = 30
const CHECK_CONCURRENCY = 4
const FETCH_TIMEOUT_MS = 6000
const MAX_REDIRECTS = 5

type LinkHealthStatus = 'ok' | 'failed' | 'timeout' | 'invalid'
type CheckMethod = 'HEAD' | 'GET'

type ProductLinkRow = {
  id: number
  shop_link_id: number | null
  shop_link: string
}

type NormalizedUrl =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: string; url: string; host: string }

type LinkCheckResult = {
  status: LinkHealthStatus
  url: string
  host: string
  httpStatus: number | null
  failureReason: string | null
  checkMethod: CheckMethod | null
  finalUrl: string | null
  redirected: boolean
  responseTimeMs: number | null
}

type LinkHealthRunSummary = {
  cron: string
  scheduledTime: number
  selected: number
  checked: number
  ok: number
  failed: number
  timeout: number
  invalid: number
  persisted: number
}

function jsonResponse(data: unknown, status = 404): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

async function hasTable(db: D1Database, tableName: string): Promise<boolean> {
  try {
    const row = await db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
    `).bind(tableName).first<{ name: string }>()
    return row?.name === tableName
  } catch {
    return false
  }
}

export const onRequest: PagesFunction<Env> = async () => {
  return jsonResponse({ error: 'Not found' })
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((part) => Number(part))
  if (octets.some((octet, index) => !Number.isInteger(octet) || octet < 0 || octet > 255 || String(octet) !== parts[index])) {
    return false
  }
  const [first, second] = octets
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  )
}

function isUnsafeHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, '')
  const withoutBrackets = normalized.replace(/^\[(.*)\]$/, '$1')
  if (!withoutBrackets) return true
  if (withoutBrackets === 'localhost' || withoutBrackets.endsWith('.localhost')) return true
  if (withoutBrackets.includes(':')) return true
  return isPrivateIpv4(withoutBrackets)
}

function normalizeShopUrl(rawUrl: string): NormalizedUrl {
  const trimmed = rawUrl.trim()
  if (!trimmed) return { ok: false, reason: 'empty_url', url: '', host: '' }
  if (trimmed.length > 2048) return { ok: false, reason: 'url_too_long', url: trimmed.slice(0, 2048), host: '' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid_url', url: trimmed, host: '' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'unsupported_protocol', url: parsed.toString(), host: parsed.hostname.toLowerCase() }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'url_credentials_not_allowed', url: parsed.toString(), host: parsed.hostname.toLowerCase() }
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    return { ok: false, reason: 'non_standard_port', url: parsed.toString(), host: parsed.hostname.toLowerCase() }
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
  if (isUnsafeHost(host)) return { ok: false, reason: 'unsafe_host', url: parsed.toString(), host }

  parsed.hash = ''
  return { ok: true, url: parsed.toString(), host }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function isHealthyStatus(status: number): boolean {
  return status >= 200 && status < 400
}

function shouldRetryHeadWithGet(result: LinkCheckResult): boolean {
  return (
    result.status !== 'ok' &&
    result.httpStatus !== null &&
    [400, 403, 404, 405, 406, 408, 409, 410, 418, 421, 425, 429, 500, 501, 502, 503, 504].includes(result.httpStatus)
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function fetchOnce(url: string, method: CheckMethod): Promise<{
  response: Response | null
  responseTimeMs: number
  timedOut: boolean
  error: string | null
}> {
  const controller = new AbortController()
  const startedAt = Date.now()
  const timeoutId = setTimeout(() => controller.abort('timeout'), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'User-Agent': 'SupplementStack-LinkHealth/1.0 (+https://supplementstack.de)',
        ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
      },
    })
    return {
      response,
      responseTimeMs: Date.now() - startedAt,
      timedOut: false,
      error: null,
    }
  } catch (error) {
    return {
      response: null,
      responseTimeMs: Date.now() - startedAt,
      timedOut: controller.signal.aborted,
      error: errorMessage(error).slice(0, 240),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function closeBody(response: Response): Promise<void> {
  if (!response.body) return
  try {
    await response.body.cancel()
  } catch {
    // Ignored: the status line is enough for this health check.
  }
}

async function performHttpCheck(normalized: { url: string; host: string }, method: CheckMethod): Promise<LinkCheckResult> {
  let currentUrl = normalized.url
  let currentHost = normalized.host
  let redirected = false
  let responseTimeMs = 0

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const attempt = await fetchOnce(currentUrl, method)
    responseTimeMs += attempt.responseTimeMs

    if (!attempt.response) {
      return {
        status: attempt.timedOut ? 'timeout' : 'failed',
        url: normalized.url,
        host: normalized.host,
        httpStatus: null,
        failureReason: attempt.timedOut ? 'timeout' : attempt.error ?? 'fetch_error',
        checkMethod: method,
        finalUrl: currentUrl,
        redirected,
        responseTimeMs,
      }
    }

    const response = attempt.response
    await closeBody(response)

    if (!isRedirectStatus(response.status)) {
      return {
        status: isHealthyStatus(response.status) ? 'ok' : 'failed',
        url: normalized.url,
        host: normalized.host,
        httpStatus: response.status,
        failureReason: isHealthyStatus(response.status) ? null : `http_${response.status}`,
        checkMethod: method,
        finalUrl: currentUrl,
        redirected,
        responseTimeMs,
      }
    }

    const location = response.headers.get('Location')
    if (!location) {
      return {
        status: 'failed',
        url: normalized.url,
        host: normalized.host,
        httpStatus: response.status,
        failureReason: 'redirect_without_location',
        checkMethod: method,
        finalUrl: currentUrl,
        redirected,
        responseTimeMs,
      }
    }

    let nextUrl: string
    try {
      nextUrl = new URL(location, currentUrl).toString()
    } catch {
      return {
        status: 'failed',
        url: normalized.url,
        host: normalized.host,
        httpStatus: response.status,
        failureReason: 'invalid_redirect_location',
        checkMethod: method,
        finalUrl: currentUrl,
        redirected,
        responseTimeMs,
      }
    }

    const next = normalizeShopUrl(nextUrl)
    if (!next.ok) {
      return {
        status: 'failed',
        url: normalized.url,
        host: normalized.host,
        httpStatus: response.status,
        failureReason: `unsafe_redirect:${next.reason}`,
        checkMethod: method,
        finalUrl: next.url,
        redirected: true,
        responseTimeMs,
      }
    }

    currentUrl = next.url
    currentHost = next.host
    redirected = true
  }

  return {
    status: 'failed',
    url: normalized.url,
    host: normalized.host || currentHost,
    httpStatus: null,
    failureReason: 'too_many_redirects',
    checkMethod: method,
    finalUrl: currentUrl,
    redirected,
    responseTimeMs,
  }
}

async function checkShopLink(rawUrl: string): Promise<LinkCheckResult> {
  const normalized = normalizeShopUrl(rawUrl)
  if (!normalized.ok) {
    return {
      status: 'invalid',
      url: normalized.url,
      host: normalized.host,
      httpStatus: null,
      failureReason: normalized.reason,
      checkMethod: null,
      finalUrl: null,
      redirected: false,
      responseTimeMs: null,
    }
  }

  const headResult = await performHttpCheck(normalized, 'HEAD')
  if (headResult.status === 'ok') return headResult

  if (shouldRetryHeadWithGet(headResult)) {
    return performHttpCheck(normalized, 'GET')
  }

  return headResult
}

async function loadProductsToCheck(db: D1Database, limit: number): Promise<ProductLinkRow[]> {
  if ((await hasTable(db, 'product_shop_links')) && (await hasTable(db, 'product_shop_link_health'))) {
    const { results } = await db.prepare(`
      SELECT
        p.id,
        psl.id AS shop_link_id,
        TRIM(psl.url) AS shop_link
      FROM product_shop_links psl
      JOIN products p ON p.id = psl.product_id
      LEFT JOIN product_shop_link_health lh ON lh.shop_link_id = psl.id
      WHERE psl.active = 1
        AND NULLIF(TRIM(psl.url), '') IS NOT NULL
        AND (p.discontinued_at IS NULL OR TRIM(p.discontinued_at) = '')
      ORDER BY
        CASE WHEN lh.last_checked_at IS NULL THEN 0 ELSE 1 END,
        lh.last_checked_at ASC,
        psl.is_primary DESC,
        psl.id ASC
      LIMIT ?
    `).bind(limit).all<ProductLinkRow>()
    return results
  }

  const { results } = await db.prepare(`
    SELECT p.id, NULL AS shop_link_id, TRIM(p.shop_link) AS shop_link
    FROM products p
    LEFT JOIN affiliate_link_health lh ON lh.product_id = p.id
    WHERE NULLIF(TRIM(p.shop_link), '') IS NOT NULL
      AND (p.discontinued_at IS NULL OR TRIM(p.discontinued_at) = '')
    ORDER BY
      CASE WHEN lh.last_checked_at IS NULL THEN 0 ELSE 1 END,
      lh.last_checked_at ASC,
      p.id ASC
    LIMIT ?
  `).bind(limit).all<ProductLinkRow>()
  return results
}

async function persistResult(db: D1Database, product: ProductLinkRow, result: LinkCheckResult, checkedAt: string): Promise<void> {
  await db.prepare(`
    INSERT INTO affiliate_link_health (
      product_id,
      url,
      host,
      status,
      http_status,
      failure_reason,
      check_method,
      final_url,
      redirected,
      response_time_ms,
      consecutive_failures,
      first_failure_at,
      last_failure_at,
      last_success_at,
      last_checked_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(product_id) DO UPDATE SET
      url = excluded.url,
      host = excluded.host,
      status = excluded.status,
      http_status = excluded.http_status,
      failure_reason = excluded.failure_reason,
      check_method = excluded.check_method,
      final_url = excluded.final_url,
      redirected = excluded.redirected,
      response_time_ms = excluded.response_time_ms,
      last_checked_at = excluded.last_checked_at,
      last_success_at = CASE
        WHEN excluded.status = 'ok' THEN excluded.last_checked_at
        ELSE affiliate_link_health.last_success_at
      END,
      first_failure_at = CASE
        WHEN excluded.status = 'ok' THEN NULL
        WHEN affiliate_link_health.url <> excluded.url THEN excluded.last_checked_at
        WHEN affiliate_link_health.first_failure_at IS NULL THEN excluded.last_checked_at
        ELSE affiliate_link_health.first_failure_at
      END,
      last_failure_at = CASE
        WHEN excluded.status = 'ok' THEN affiliate_link_health.last_failure_at
        ELSE excluded.last_checked_at
      END,
      consecutive_failures = CASE
        WHEN excluded.status = 'ok' THEN 0
        WHEN affiliate_link_health.url <> excluded.url THEN 1
        ELSE affiliate_link_health.consecutive_failures + 1
      END,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    product.id,
    result.url,
    result.host,
    result.status,
    result.httpStatus,
    result.failureReason,
    result.checkMethod,
    result.finalUrl,
    result.redirected ? 1 : 0,
    result.responseTimeMs,
    result.status === 'ok' ? 0 : 1,
    result.status === 'ok' ? null : checkedAt,
    result.status === 'ok' ? null : checkedAt,
    result.status === 'ok' ? checkedAt : null,
    checkedAt,
  ).run()

  if (product.shop_link_id === null || !(await hasTable(db, 'product_shop_link_health'))) return

  await db.prepare(`
    INSERT INTO product_shop_link_health (
      shop_link_id,
      url,
      status,
      http_status,
      failure_reason,
      final_url,
      redirected,
      response_time_ms,
      consecutive_failures,
      last_success_at,
      last_checked_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(shop_link_id) DO UPDATE SET
      url = excluded.url,
      status = excluded.status,
      http_status = excluded.http_status,
      failure_reason = excluded.failure_reason,
      final_url = excluded.final_url,
      redirected = excluded.redirected,
      response_time_ms = excluded.response_time_ms,
      last_checked_at = excluded.last_checked_at,
      last_success_at = CASE
        WHEN excluded.status = 'ok' THEN excluded.last_checked_at
        ELSE product_shop_link_health.last_success_at
      END,
      consecutive_failures = CASE
        WHEN excluded.status = 'ok' THEN 0
        WHEN product_shop_link_health.url <> excluded.url THEN 1
        ELSE product_shop_link_health.consecutive_failures + 1
      END,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    product.shop_link_id,
    result.url,
    result.status,
    result.httpStatus,
    result.failureReason,
    result.finalUrl,
    result.redirected ? 1 : 0,
    result.responseTimeMs,
    result.status === 'ok' ? 0 : 1,
    result.status === 'ok' ? checkedAt : null,
    checkedAt,
  ).run()
}

async function processProduct(db: D1Database, product: ProductLinkRow, checkedAt: string): Promise<LinkCheckResult | null> {
  try {
    const result = await checkShopLink(product.shop_link)
    await persistResult(db, product, result, checkedAt)
    return result
  } catch (error) {
    const result: LinkCheckResult = {
      status: 'failed',
      url: product.shop_link.slice(0, 2048),
      host: '',
      httpStatus: null,
      failureReason: `checker_error:${errorMessage(error).slice(0, 220)}`,
      checkMethod: null,
      finalUrl: null,
      redirected: false,
      responseTimeMs: null,
    }
    try {
      await persistResult(db, product, result, checkedAt)
    } catch (persistError) {
      console.error('affiliate link health persist failed', {
        productId: product.id,
        error: errorMessage(persistError),
      })
      return null
    }
    return result
  }
}

export async function runAffiliateLinkHealthCheck(
  env: Env,
  options: { cron?: string; scheduledTime?: number; limit?: number } = {},
): Promise<LinkHealthRunSummary> {
  const checkedAt = new Date().toISOString()
  const cron = options.cron ?? AFFILIATE_LINK_HEALTH_CRON
  const scheduledTime = options.scheduledTime ?? Date.now()
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? MAX_LINKS_PER_RUN), 1), MAX_LINKS_PER_RUN)
  const products = await loadProductsToCheck(env.DB, limit)
  const summary: LinkHealthRunSummary = {
    cron,
    scheduledTime,
    selected: products.length,
    checked: 0,
    ok: 0,
    failed: 0,
    timeout: 0,
    invalid: 0,
    persisted: 0,
  }

  for (let index = 0; index < products.length; index += CHECK_CONCURRENCY) {
    const chunk = products.slice(index, index + CHECK_CONCURRENCY)
    const results = await Promise.all(chunk.map((product) => processProduct(env.DB, product, checkedAt)))
    for (const result of results) {
      if (!result) continue
      summary.checked += 1
      summary.persisted += 1
      if (result.status === 'ok') summary.ok += 1
      if (result.status === 'failed') summary.failed += 1
      if (result.status === 'timeout') summary.timeout += 1
      if (result.status === 'invalid') summary.invalid += 1
    }
  }

  console.info('affiliate link health run completed', summary)
  return summary
}

export default {
  async fetch(): Promise<Response> {
    return jsonResponse({ error: 'Not found' })
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron !== AFFILIATE_LINK_HEALTH_CRON) return
    ctx.waitUntil(
      runAffiliateLinkHealthCheck(env, {
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      }).catch((error) => {
        console.error('affiliate link health run failed', { error: errorMessage(error) })
      }),
    )
  },
} satisfies ExportedHandler<Env>
