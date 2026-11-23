// Bundle the TypeScript server into a single ESM file (dependencies stay external).
import { build } from 'esbuild';
await build({
  entryPoints: ['server/index.ts'],
  outfile: 'dist-server/index.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  logLevel: 'info',
});
