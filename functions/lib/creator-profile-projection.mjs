import { normalizeIsoTimestamp, resolveRouteHead, SITE_ORIGIN } from './route-head-contract.mjs'
import { isCreatorProfileSlug } from './site-routes.mjs'

export const CREATOR_PROFILE_COPY = Object.freeze({
  boundary: 'Dies ist eine öffentliche Vorstellung. Geteilte Empfehlungen öffnest du über den jeweiligen Link des Creators. Deine eigenen Stacks bleiben privat.',
  exploreHeading: 'Supplement Stack kennenlernen',
  exploreDescription: 'Informiere dich über Wirkstoffe und Quellen oder probiere die App ohne Konto aus.',
})

/** Only an already consented, moderated, current public projection may enter here. */
export function projectCreatorProfile(slug, state) {
  const pathname = `/creator/${slug}`
  const profile = state.status === 200 && isCreatorProfileSlug(slug) && state.profile?.slug === slug ? state.profile : null
  if (!profile) {
    const loading = state.status === 'loading'
    const status = loading ? 200 : state.status === 503 ? 503 : 404
    const title = loading ? 'Creator-Seite wird geladen …' : status === 503 ? 'Diese Creator-Seite kann gerade nicht geladen werden' : 'Diese Creator-Seite ist nicht verfügbar'
    const description = loading ? 'Die öffentlichen Angaben werden geladen.' : status === 503 ? 'Bitte versuche es später noch einmal.' : 'Die Seite ist nicht öffentlich oder der Link stimmt nicht. Über den Wissensbereich oder die Demo kannst du weitergehen.'
    return { title, description, profile: null, head: resolveRouteHead({ pathname, status, title: `${title} | Supplement Stack`, description }) }
  }
  const canonical = `${SITE_ORIGIN}${pathname}`
  const image = profile.profile_image_url?.startsWith('/api/r2/') ? `${SITE_ORIGIN}${profile.profile_image_url}` : profile.profile_image_url
  const publishedAt = normalizeIsoTimestamp(profile.published_at)
  const entity = { '@type': profile.type === 'brand' ? 'Organization' : 'Person', '@id': `${canonical}#creator`, name: profile.name, url: canonical, description: profile.description,
    ...(image ? { image } : {}),
  }
  const jsonLd = { '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': canonical, url: canonical, name: profile.name, description: profile.description, inLanguage: 'de', mainEntity: entity,
    ...(publishedAt ? { dateModified: publishedAt } : {}),
  }
  return {
    title: profile.name,
    description: profile.description,
    profile,
    head: resolveRouteHead({ pathname, status: 200, title: `${profile.name} | Supplement Stack`, description: profile.description, image, jsonLd, profilePublished: true }),
  }
}
