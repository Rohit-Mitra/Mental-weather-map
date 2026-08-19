import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = resolve(ROOT, 'data');

/**
 * Serves the repo's /data directory as a static route.
 *
 * The dataset lives in data/trends_data.json (next to the scripts that write
 * it) rather than in public/, so `python3 data/fetch_trends.py` swaps in real
 * data with no copy step and no code change. This plugin makes that same file
 * reachable at /data/trends_data.json in dev, and copies it into dist/ on build.
 */
function serveDataDir() {
  return {
    name: 'mhwm-serve-data-dir',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/data/')) return next();
        const rel = req.url.slice('/data/'.length).split('?')[0];
        const file = resolve(DATA_DIR, rel);
        // Guard against path traversal out of data/.
        if (!file.startsWith(DATA_DIR) || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      const src = resolve(DATA_DIR, 'trends_data.json');
      if (!existsSync(src)) return;
      const dest = resolve(ROOT, 'dist/data/trends_data.json');
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    },
  };
}

export default defineConfig({
  // Relative base so the built app works from any path (GitHub Pages, S3, ...).
  base: './',
  plugins: [react(), serveDataDir()],
  server: { port: 5173, open: false },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
