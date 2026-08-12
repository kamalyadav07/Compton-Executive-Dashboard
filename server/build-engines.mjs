/**
 * server/build-engines.mjs
 * -----------------------------------------------------------------------
 * Compiles the THREE TypeScript engine files the LangChain agent needs
 * into plain CommonJS .js files under server/engines/.
 *
 * This means there is ONE copy of each engine (the .ts source in src/)
 * and this script produces the server-consumable builds automatically.
 * No hand-maintained JS duplicates that can drift.
 *
 * Run:   node server/build-engines.mjs
 * Or:    npm run build:engines   (from server/)
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const entries = [
  {
    in:  path.join(rootDir, 'src/engine/salesProjectionEngine.ts'),
    out: path.join(__dirname, 'engines/salesProjectionEngine.js'),
  },
  {
    in:  path.join(rootDir, 'src/engine/dealIntelligenceEngine.ts'),
    out: path.join(__dirname, 'engines/dealIntelligenceEngine.js'),
  },
  {
    in:  path.join(rootDir, 'src/utils/financeUtils.ts'),
    out: path.join(__dirname, 'engines/financeUtils.js'),
  },
  {
    in:  path.join(rootDir, 'src/utils/textUtils.ts'),
    out: path.join(__dirname, 'engines/textUtils.js'),
  },
];

async function buildAll() {
  console.log('[build-engines] Compiling TS engines → server/engines/ (CommonJS) …');

  for (const entry of entries) {
    await build({
      entryPoints: [entry.in],
      outfile: entry.out,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node18',
      sourcemap: false,
      // The TS engines import from ../types/sales — which is a type-only
      // import that esbuild strips automatically in bundled output.
      // No externals needed since everything is self-contained.
      logLevel: 'warning',
    });
    console.log(`  ✅ ${path.relative(rootDir, entry.in)} → ${path.relative(rootDir, entry.out)}`);
  }

  console.log('[build-engines] Done.\n');
}

buildAll().catch(err => {
  console.error('[build-engines] ❌ Failed:', err);
  process.exit(1);
});
