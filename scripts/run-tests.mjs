import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

const tempDir = mkdtempSync(join(tmpdir(), 'keypiano-tests-'));
const outfile = join(tempDir, 'unit-tests.mjs');
const entryPoint = fileURLToPath(new URL('../tests/unit.test.ts', import.meta.url));
const isWatchMode = process.argv.includes('--watch');

const runCompiledTests = () => {
  const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  if (!isWatchMode) process.exitCode = result.status ?? 1;
};

const buildOptions = {
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: 'inline',
  logLevel: 'silent',
};

if (!isWatchMode) {
  try {
    await build(buildOptions);
    runCompiledTests();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
} else {
  const testRunnerPlugin = {
    name: 'run-tests-after-build',
    setup(esbuild) {
      esbuild.onEnd((result) => {
        if (result.errors.length === 0) runCompiledTests();
      });
    },
  };
  const buildContext = await context({ ...buildOptions, plugins: [testRunnerPlugin] });
  const cleanup = async () => {
    await buildContext.dispose();
    rmSync(tempDir, { recursive: true, force: true });
  };
  process.once('SIGINT', async () => {
    await cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', async () => {
    await cleanup();
    process.exit(143);
  });
  await buildContext.watch();
  console.log('Watching source files for test changes…');
}
