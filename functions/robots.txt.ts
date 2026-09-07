import type { Env } from './api/lib/types'
import { buildRobotsTxt } from './lib/site-crawl.mjs'

const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' }
export const onRequestGet: PagesFunction<Env> = () => new Response(buildRobotsTxt(), { headers })
export const onRequestHead: PagesFunction<Env> = () => new Response(null, { headers })
