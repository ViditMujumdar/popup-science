/** Production entry: one Node process serving the API and the built frontend. */
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './config';
import { createApp } from './app';
import { GeminiProvider } from './ai/gemini';
import { YouTubeSearch } from './video/youtube';
import { createStore } from './store';

const store = await createStore(config.dataDir);
const ai = new GeminiProvider({ apiKey: config.ai.apiKey, model: config.ai.model, fallbackModel: config.ai.fallbackModel, baseUrl: config.ai.baseUrl, timeoutMs: config.ai.timeoutMs, mainTimeoutMs: config.ai.mainTimeoutMs });
const video = new YouTubeSearch({ apiKey: config.video.apiKey, baseUrl: config.video.baseUrl, timeoutMs: config.video.timeoutMs });
const app = createApp({ ai, video, store, config });

const root = path.relative(process.cwd(), config.staticDir) || '.';
if (fs.existsSync(config.staticDir)) {
  app.use('/assets/*', async (c, next) => { await next(); c.header('Cache-Control', 'public, max-age=31536000, immutable'); });
  app.use('*', serveStatic({ root }));
  const indexHtml = fs.readFileSync(path.join(config.staticDir, 'index.html'), 'utf8');
  // A missing build file (e.g. an old tab after a redeploy) must be a real 404, not index.html.
  app.get('/assets/*', (c) => c.text('Not found', 404));
  app.get('*', (c) => c.html(indexHtml)); // SPA fallback for /view, /s/:id …
} else {
  console.warn(`No built frontend at ${config.staticDir}. Run "npm run build" (API still works).`);
}

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`Pop-Up Science listening on http://${config.host}:${info.port}`);
  console.log(`AI: ${ai.configured ? `${ai.name} (${ai.model}${config.ai.fallbackModel ? `, fallback ${config.ai.fallbackModel}` : ''})` : 'not configured'} · Videos: ${video.configured ? 'YouTube Data API' : 'search link only (set YOUTUBE_API_KEY)'} · Data: ${config.dataDir}`);
});
