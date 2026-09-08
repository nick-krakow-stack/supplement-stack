import { resolveRouteHead } from './route-head-contract.mjs'

const publicText = (value, token) => typeof value === 'string' ? (token ? value.split(token).join('') : value).replace(/\s+/g, ' ').trim() : ''

/** Only public, known failure copy crosses the API/SSR/SPA boundary. */
export function publicShareFailure(status, code) {
  const safeStatus = [404, 409, 410].includes(status) ? status : 503
  const message = code === 'SHARE_PENDING' ? 'Diese Empfehlung wird noch geprüft.'
    : code === 'SHARE_PAUSED' ? 'Diese Empfehlung ist vorübergehend pausiert.'
      : safeStatus === 410 ? 'Diese Empfehlung ist nicht mehr verfügbar. Bitte frage nach einem aktuellen Link.'
        : safeStatus === 404 ? 'Diese Empfehlung wurde nicht gefunden. Bitte prüfe den Link.'
          : 'Diese Empfehlung kann gerade nicht geladen werden. Bitte versuche es später noch einmal.'
  return { status: safeStatus, message }
}

/** Same minimal approved-snapshot projection for HTML and the hydrated page.
 * No token-bearing URL, personal amounts, statements, or profile/product images.
 */
export function projectShareHead(share, token = '') {
  const loading = share.status === 'loading'
  const creatorName = publicText(share.creatorName, token)
  const title = loading ? 'Empfehlung wird geladen'
    : share.status === 200 ? publicText(share.title, token) || 'Geteilte Empfehlung'
      : share.status === 410 ? 'Empfehlung nicht mehr verfügbar'
        : share.status === 404 ? 'Empfehlung nicht gefunden' : 'Empfehlung gerade nicht verfügbar'
  const description = loading ? 'Die geteilte Empfehlung wird geladen. Bitte warte einen Moment.'
    : share.status === 200 ? `${creatorName ? `Von ${creatorName}. ` : ''}Sieh dir die geteilte Zusammenstellung an. Du entscheidest selbst, welche Produkte du übernehmen möchtest.`
      : publicText(share.message, token) || publicShareFailure(share.status).message
  return {
    title,
    description,
    // A fixed internal route identifier establishes the policy, never a capability URL.
    head: resolveRouteHead({ pathname: '/share/preview', status: loading ? 200 : share.status, title: `${title} | Supplement Stack`, description }),
  }
}
