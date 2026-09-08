import { escapeLegalHtml as escapeHtml, serializeLegalBootstrap } from './legal-document-renderer.mjs'
import { CREATOR_PROFILE_COPY, projectCreatorProfile, type CreatorProfilePageState } from './creator-profile-projection.mjs'
import { renderSitePage } from './site-public-html'

export function renderCreatorProfileHtml(shell: string, slug: string, state: CreatorProfilePageState) {
  const projection = projectCreatorProfile(slug, state)
  const { profile, title, description, head } = projection
  const content = `${profile ? '<p>Öffentliche Creator-Seite</p>' : ''}${profile?.profile_image_url ? `<img src="${escapeHtml(profile.profile_image_url)}" alt="" width="96" height="96" referrerpolicy="no-referrer" style="border-radius:1rem;object-fit:cover">` : ''}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>${profile ? `<p>${escapeHtml(CREATOR_PROFILE_COPY.boundary)}</p><section><h2>${escapeHtml(CREATOR_PROFILE_COPY.exploreHeading)}</h2><p>${escapeHtml(CREATOR_PROFILE_COPY.exploreDescription)}</p></section>` : ''}<nav aria-label="Weitere Seiten"><a href="/wissen">Wissen entdecken</a> · <a href="/demo">Demo ohne Konto ausprobieren</a> · <a href="/">Zur Startseite</a></nav>`
  const html = renderSitePage(shell, head, content, `/creator/${slug}`)
    .replace(/<div\s+id=["']root["']/i, () => `<script type="application/json" id="creator-profile-bootstrap">${serializeLegalBootstrap({ slug, state })}</script><div id="root"`)
  return { html, head }
}
