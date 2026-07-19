import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/reader', { recursive: true });
await Promise.all([
  build({
    entryPoints: ['src/reader/player.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: 'dist/reader/player.js',
    minify: false,
  }),
  build({
    entryPoints: ['src/reader/library.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: 'dist/reader/library.js',
    minify: false,
  }),
  cp('src/reader/styles', 'dist/reader/styles', { recursive: true }),
]);
