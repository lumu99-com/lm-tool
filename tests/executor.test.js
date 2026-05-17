import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { createExecutor } from '../src/core/executor.js';

test('executor streams stdout and stderr to the provided sinks', async () => {
  const events = [];
  const executor = createExecutor({
    spawnImpl: () => createFakeChild({
      stdout: ['pulling\n'],
      stderr: ['warning\n'],
      exitCode: 0,
    }),
  });

  const result = await executor.run({
    command: 'git',
    args: ['pull'],
    cwd: '/repo',
    onStdout: (chunk) => events.push(`out:${chunk}`),
    onStderr: (chunk) => events.push(`err:${chunk}`),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(events, ['out:pulling\n', 'err:warning\n']);
});

test('executor returns a non-zero exit code when the process fails', async () => {
  const executor = createExecutor({
    spawnImpl: () => createFakeChild({
      stdout: [],
      stderr: ['boom\n'],
      exitCode: 2,
    }),
  });

  const result = await executor.run({
    command: 'git',
    args: ['pull'],
    cwd: '/repo',
  });

  assert.equal(result.exitCode, 2);
});

function createFakeChild({ stdout, stderr, exitCode }) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  queueMicrotask(() => {
    for (const chunk of stdout) {
      child.stdout.emit('data', chunk);
    }

    for (const chunk of stderr) {
      child.stderr.emit('data', chunk);
    }

    child.emit('close', exitCode);
  });

  return child;
}
