// Development: API server (watch mode) + Vite dev server with /api proxy.
import { spawn } from 'node:child_process';
const run = (cmd, args, env = {}) => spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });
const api = run('npx', ['tsx', 'watch', '--env-file-if-exists=.env', 'server/index.ts'], { PORT: '8787', STATIC_DIR: 'dist-dev-none' });
const web = run('npx', ['vite']);
const stop = () => { api.kill(); web.kill(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
