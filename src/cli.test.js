import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from './cli.js';

test('lm check help prints check help text', async () => {
  const lines = [];
  const result = await runCli(['check', 'help'], {
    writeLine: (line) => lines.push(line),
    executor: { run: async () => ({ exitCode: 0 }) },
    prompts: {},
    configStore: {},
    executableDir: process.cwd(),
    selfUpdatePreflight: async () => ({ exitCode: 0, shouldReexec: false }),
  });

  assert.equal(result.exitCode, 0);
  assert.match(lines.join('\n'), /lm check server/);
});
