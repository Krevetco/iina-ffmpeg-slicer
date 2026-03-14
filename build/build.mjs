#!/usr/bin/env node
// VideoMarkers – build script
// Compiles TypeScript via esbuild, copies assets, installs into IINA plugins folder

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PLUGIN_NAME = 'VideoMarkers.iinaplugin';
const DIST = path.join(ROOT, 'dist', PLUGIN_NAME);
const IINA_PLUGINS = path.join(
  process.env.HOME,
  'Library/Application Support/com.colliderli.iina/plugins',
  PLUGIN_NAME
);

const WATCH = process.argv.includes('--watch');

// ── Build ──────────────────────────────────────────────────────────────────

async function build() {
  console.log(`\n🔨 Building ${PLUGIN_NAME}...`);

  // 1. Clean dist
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'sidebar'), { recursive: true });

  // 2. Compile main entry: src/index.ts → dist/main.js
  //    IIFE format so the code runs immediately in IINA's JavaScriptCore sandbox
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/index.ts')],
    outfile: path.join(DIST, 'main.js'),
    bundle: true,
    format: 'iife',
    target: 'es6',
    platform: 'neutral',    // no Node/browser built-ins injected
    // `iina` is a global provided by IINA at runtime – tell esbuild not to touch it
    external: [],
    define: {},
    treeShaking: true,
    minify: false,           // keep readable for debugging
    logLevel: 'info',
  });

  // 3. Compile sidebar script: ui/sidebar/script.ts → dist/sidebar/script.js
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'ui/sidebar/script.ts')],
    outfile: path.join(DIST, 'sidebar/script.js'),
    bundle: true,
    format: 'iife',
    target: 'es6',
    platform: 'browser',
    treeShaking: true,
    minify: false,
    logLevel: 'info',
  });

  // 4. Copy static assets
  fs.copyFileSync(path.join(ROOT, 'Info.json'),               path.join(DIST, 'Info.json'));
  fs.copyFileSync(path.join(ROOT, 'ui/sidebar/index.html'),   path.join(DIST, 'sidebar/index.html'));
  fs.copyFileSync(path.join(ROOT, 'ui/sidebar/style.css'),    path.join(DIST, 'sidebar/style.css'));

  // 5. Install into IINA plugins folder (sync)
  fs.rmSync(IINA_PLUGINS, { recursive: true, force: true });
  fs.cpSync(DIST, IINA_PLUGINS, { recursive: true });

  console.log(`✅ Built and installed to:\n   ${IINA_PLUGINS}`);
  console.log(`⚠️  Restart IINA to pick up changes\n`);
}

// ── Watch mode ─────────────────────────────────────────────────────────────

if (WATCH) {
  // Dynamic import for chokidar (optional dep)
  const chokidar = (await import('chokidar')).default;

  const WATCH_GLOBS = [
    path.join(ROOT, 'src/**/*'),
    path.join(ROOT, 'ui/**/*'),
    path.join(ROOT, 'Info.json'),
  ];

  await build();

  console.log('👀 Watching for changes... (Ctrl+C to stop)\n');

  let rebuilding = false;
  chokidar.watch(WATCH_GLOBS, { ignoreInitial: true }).on('all', async (event, filePath) => {
    if (rebuilding) return;
    rebuilding = true;
    console.log(`📝 ${event}: ${path.relative(ROOT, filePath)}`);
    try {
      await build();
    } catch (e) {
      console.error('❌ Build failed:', e.message);
    }
    rebuilding = false;
  });
} else {
  // Single build
  build().catch((e) => {
    console.error('❌ Build failed:', e.message);
    process.exit(1);
  });
}
