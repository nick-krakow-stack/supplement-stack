// Cloudflare Pages Function - Catch-all route
import app from '../src/index';

export const onRequest: PagesFunction = app.fetch;