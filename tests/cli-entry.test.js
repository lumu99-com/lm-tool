import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { runCli } from '../src/cli.js';

test('runCli renders help output for the help command', async () => {
  const lines = [];

  const result = await runCli(['help'], {
    writeLine: (line) => lines.push(line),
  });

  assert.equal(result.exitCode, 0);
  assert.match(lines.join('\n'), /lm init/);
  assert.match(lines.join('\n'), /lm build/);
});

test('CLI entry prints help output for the help command', () => {
  const testFile = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(path.dirname(testFile), '..');
  const result = spawnSync(process.execPath, ['src/index.js', 'help'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /lm init/);
  assert.match(result.stdout, /lm build/);
  assert.equal(result.stderr, '');
});
