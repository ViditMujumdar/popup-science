/** Server configuration from environment variables. Secrets never leave the server. */
import path from 'node:path';
import fs from 'node:fs';

// Local development: read .env if present (hosting platforms set real env vars; .env is never uploaded).
if (fs.existsSync('.env') && typeof (process as any).loadEnvFile === 'function') { try { (process as any).loadEnvFile('.env'); } catch { /* ignore */ } }

const env = process.env;
const int = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);

export const config = {
  port: int(env.PORT, 8787),
  host: env.HOST || '0.0.0.0',
  publicUrl: (env.PUBLIC_APP_URL || '').replace(/\/+$/, ''),
  dataDir: env.DATA_DIR || path.resolve('.data'),
  staticDir: env.STATIC_DIR || path.resolve('dist'),
  ai: {
    apiKey: env.GEMINI_API_KEY || '',
    model: env.GEMINI_MODEL || 'gemini-3.6-flash',
    fallbackModel: env.GEMINI_FALLBACK_MODEL || '',
    /** Override only for tests (points the real adapter at a local mock server). */
    baseUrl: (env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/+$/, ''),
    /** Main model gets AI_MAIN_TIMEOUT_MS, then the fallback gets AI_TIMEOUT_MS (total stays under the browser's 150 s). */
    mainTimeoutMs: int(env.AI_MAIN_TIMEOUT_MS, 50_000),
    timeoutMs: int(env.AI_TIMEOUT_MS, 45_000),
  },
  video: {
    apiKey: env.YOUTUBE_API_KEY || '',
    baseUrl: (env.YOUTUBE_API_BASE || 'https://www.googleapis.com').replace(/\/+$/, ''),
    timeoutMs: int(env.VIDEO_TIMEOUT_MS, 10_000),
  },
  limits: { uploadBytes: int(env.MAX_UPLOAD_BYTES, 8 * 1024 * 1024), minDim: 200, maxDim: 8000, shareBytes: 200_000 },
};
export type AppConfig = typeof config;
