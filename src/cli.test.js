import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from './cli.js';

test('lm init help prints init help text and does not run init command', async () => {
  const lines = [];
  const result = await runCli(['init', 'help'], {
    writeLine: (line) => lines.push(line),
    executor: { run: async () => ({ exitCode: 0 }) },
    prompts: {},
    configStore: {},
    executableDir: process.cwd(),
    selfUpdatePreflight: async () => ({ exitCode: 0, shouldReexec: false }),
    initCommand: {
      run: async () => {
        throw new Error('init command should not run for lm init help');
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.match(lines.join('\n'), /lm init help/);
});

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

test('lm check server routes to the check command', async () => {
  const targets = [];
  const result = await runCli(['check', 'server'], {
    writeLine: () => {},
    executor: { run: async () => ({ exitCode: 0 }) },
    prompts: {},
    configStore: {},
    executableDir: process.cwd(),
    selfUpdatePreflight: async () => ({ exitCode: 0, shouldReexec: false }),
    checkCommand: {
      run: async (target) => {
        targets.push(target);
        return { exitCode: 0 };
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(targets, ['server']);
});

test('lm mysql help prints mysql help text', async () => {
  const lines = [];
  const result = await runCli(['mysql', 'help'], {
    writeLine: (line) => lines.push(line),
    executor: { run: async () => ({ exitCode: 0 }) },
    prompts: {},
    configStore: {},
    executableDir: process.cwd(),
    selfUpdatePreflight: async () => ({ exitCode: 0, shouldReexec: false }),
    mysqlCommand: {
      run: async () => {
        throw new Error('mysql command should not run for lm mysql help');
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.match(lines.join('\n'), /lm mysql init/);
});

test('lm mysql routes summary, init and user targets to the mysql command', async () => {
  const targets = [];
  const deps = {
    writeLine: () => {},
    executor: { run: async () => ({ exitCode: 0 }) },
    prompts: {},
    configStore: {},
    executableDir: process.cwd(),
    selfUpdatePreflight: async () => ({ exitCode: 0, shouldReexec: false }),
    mysqlCommand: {
      run: async (target) => {
        targets.push(target);
        return { exitCode: 0 };
      },
    },
  };

  const summaryResult = await runCli(['mysql'], deps);
  const initResult = await runCli(['mysql', 'init'], deps);
  const userResult = await runCli(['mysql', 'user'], deps);

  assert.equal(summaryResult.exitCode, 0);
  assert.equal(initResult.exitCode, 0);
  assert.equal(userResult.exitCode, 0);
  assert.deepEqual(targets, ['summary', 'init', 'user']);
});

test('lm update routes to manual self update mode', async () => {
  const modes = [];
  const result = await runCli(['update'], {
    writeLine: () => {},
    executor: { run: async () => ({ exitCode: 0 }) },
    prompts: {},
    configStore: {},
    executableDir: process.cwd(),
    selfUpdatePreflight: async ({ mode }) => {
      modes.push(mode);
      return { exitCode: 0, shouldReexec: false };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(modes, ['manual']);
});

test('automatic commands call self update in auto mode', async () => {
  const modes = [];
  const result = await runCli(['check', 'server'], {
    writeLine: () => {},
    executor: { run: async () => ({ exitCode: 0 }) },
    prompts: {},
    configStore: {},
    executableDir: process.cwd(),
    selfUpdatePreflight: async ({ mode }) => {
      modes.push(mode);
      return { exitCode: 0, shouldReexec: false };
    },
    checkCommand: {
      run: async () => ({ exitCode: 0 }),
    },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(modes, ['auto']);
});
