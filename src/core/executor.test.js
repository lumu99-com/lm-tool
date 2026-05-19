import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { createExecutor } from './executor.js';

test('executor routes npm and mvn through cmd.exe on windows', async () => {
  const calls = [];
  const executor = createExecutor({
    runtimePlatform: 'win32',
    spawnImpl: (command, args, options) => {
      calls.push({ command, args, options });

      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin = {
        end() {},
      };

      process.nextTick(() => {
        child.emit('close', 0);
      });

      return child;
    },
  });

  await executor.run({
    command: 'npm',
    args: ['install'],
    writeLine: () => {},
  });
  await executor.run({
    command: 'mvn',
    args: ['-version'],
    writeLine: () => {},
  });
  await executor.run({
    command: 'git',
    args: ['fetch'],
    writeLine: () => {},
  });

  assert.match(calls[0].command.toLowerCase(), /cmd(.exe)?$/);
  assert.deepEqual(calls[0].args, ['/d', '/s', '/c', 'npm install']);
  assert.match(calls[1].command.toLowerCase(), /cmd(.exe)?$/);
  assert.deepEqual(calls[1].args, ['/d', '/s', '/c', 'mvn -version']);
  assert.equal(calls[2].command, 'git');
  assert.deepEqual(calls[2].args, ['fetch']);
});
