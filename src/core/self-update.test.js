import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';

import { runSelfUpdatePreflight } from './self-update.js';

function createConfigStore(initialConfig) {
  let currentConfig = initialConfig;
  const saves = [];

  return {
    async load() {
      return currentConfig;
    },
    async save(nextConfig) {
      currentConfig = nextConfig;
      saves.push(nextConfig);
    },
    get saves() {
      return saves;
    },
    get currentConfig() {
      return currentConfig;
    },
  };
}

function createDeps(overrides = {}) {
  const configStore = overrides.configStore ?? createConfigStore(null);
  const executorCalls = [];
  const lines = [];

  return {
    configStore,
    executorCalls,
    lines,
    deps: {
      mode: 'auto',
      today: '2026-05-17',
      configStore,
      executor: {
        run: async (input) => {
          executorCalls.push(input.label);
          return { exitCode: 0 };
        },
      },
      prompts: {
        selectSelfUpdateAction: async () => 'skip-update',
      },
      writeLine: (line) => lines.push(line),
      writeStdout: () => {},
      writeStderr: () => {},
      resolveToolDir: async () => 'D:/repo/lm-tool',
      resolveUpstreamBranch: async () => 'origin/main',
      readAheadBehind: async () => ({ localAhead: 0, remoteAhead: 0 }),
      readHasLocalChanges: async () => false,
      ...overrides,
    },
  };
}

test('manual mode prints skip message when lm-tool is not in a git repo', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-self-update-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  const lines = [];
  const result = await runSelfUpdatePreflight({
    mode: 'manual',
    executableDir: tempDir,
    writeLine: (line) => lines.push(line),
    executor: {
      run: async () => {
        throw new Error('executor.run should not be called');
      },
    },
    prompts: {},
    writeStdout: () => {},
    writeStderr: () => {},
  });

  assert.deepEqual(result, { exitCode: 0, shouldReexec: false });
  assert.match(lines.join('\n'), /不在 Git 仓库/);
});

test('manual mode prints skip message when lm-tool has no upstream branch', async (t) => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-self-update-'));
  t.after(() => rm(repoDir, { recursive: true, force: true }));

  execFileSync('git', ['init'], { cwd: repoDir, stdio: 'ignore' });

  const lines = [];
  const result = await runSelfUpdatePreflight({
    mode: 'manual',
    executableDir: repoDir,
    writeLine: (line) => lines.push(line),
    executor: {
      run: async () => {
        throw new Error('executor.run should not be called');
      },
    },
    prompts: {},
    writeStdout: () => {},
    writeStderr: () => {},
  });

  assert.deepEqual(result, { exitCode: 0, shouldReexec: false });
  assert.match(lines.join('\n'), /未配置上游分支/);
});

test('auto mode skips update check when config file does not exist', async () => {
  const { deps, executorCalls, configStore } = createDeps();

  const result = await runSelfUpdatePreflight(deps);

  assert.deepEqual(result, { exitCode: 0, shouldReexec: false });
  assert.deepEqual(executorCalls, []);
  assert.deepEqual(configStore.saves, []);
});

test('auto mode skips repeated update check on the same day', async () => {
  const { deps, executorCalls, configStore } = createDeps({
    configStore: createConfigStore({
      projects: { server: 'D:/server' },
      selfUpdate: { lastCheckedDate: '2026-05-17' },
    }),
  });

  const result = await runSelfUpdatePreflight(deps);

  assert.deepEqual(result, { exitCode: 0, shouldReexec: false });
  assert.deepEqual(executorCalls, []);
  assert.deepEqual(configStore.saves, []);
});

test('manual mode always performs update check even without config file', async () => {
  const { deps, executorCalls } = createDeps({
    mode: 'manual',
  });

  const result = await runSelfUpdatePreflight(deps);

  assert.deepEqual(result, { exitCode: 0, shouldReexec: false });
  assert.deepEqual(executorCalls, ['git fetch']);
});

test('auto mode writes today after successful no-update check', async () => {
  const configStore = createConfigStore({
    projects: { server: 'D:/server' },
  });
  const { deps, executorCalls } = createDeps({
    configStore,
  });

  const result = await runSelfUpdatePreflight(deps);

  assert.deepEqual(result, { exitCode: 0, shouldReexec: false });
  assert.deepEqual(executorCalls, ['git fetch']);
  assert.equal(configStore.saves.length, 1);
  assert.deepEqual(configStore.currentConfig, {
    projects: { server: 'D:/server' },
    selfUpdate: { lastCheckedDate: '2026-05-17' },
  });
});

test('auto mode requests reexec after pulling new code and saves the date', async () => {
  const configStore = createConfigStore({
    platform: 'windows',
    projects: { server: 'D:/server' },
  });
  const { deps, executorCalls, lines } = createDeps({
    configStore,
    readAheadBehind: async () => ({ localAhead: 0, remoteAhead: 1 }),
  });

  const result = await runSelfUpdatePreflight(deps);

  assert.deepEqual(result, { exitCode: 0, shouldReexec: true });
  assert.deepEqual(executorCalls, ['git fetch', 'git pull']);
  assert.equal(configStore.saves.length, 1);
  assert.deepEqual(configStore.currentConfig, {
    platform: 'windows',
    projects: { server: 'D:/server' },
    selfUpdate: { lastCheckedDate: '2026-05-17' },
  });
  assert.match(lines.join('\n'), /正在重新执行当前命令/);
});

test('manual mode updates without reexec and asks user to rerun the target command', async () => {
  const { deps, executorCalls, lines, configStore } = createDeps({
    mode: 'manual',
    readAheadBehind: async () => ({ localAhead: 0, remoteAhead: 1 }),
  });

  const result = await runSelfUpdatePreflight(deps);

  assert.deepEqual(result, { exitCode: 0, shouldReexec: false });
  assert.deepEqual(executorCalls, ['git fetch', 'git pull']);
  assert.deepEqual(configStore.saves, []);
  assert.match(lines.join('\n'), /请重新执行需要的命令/);
});

test('auto mode stores today when git repo preconditions cause a skip', async () => {
  const configStore = createConfigStore({
    projects: { server: 'D:/server' },
  });
  const { deps, executorCalls, lines } = createDeps({
    configStore,
    resolveToolDir: async () => null,
  });

  const result = await runSelfUpdatePreflight(deps);

  assert.deepEqual(result, { exitCode: 0, shouldReexec: false });
  assert.deepEqual(executorCalls, []);
  assert.equal(configStore.saves.length, 1);
  assert.equal(configStore.currentConfig.selfUpdate.lastCheckedDate, '2026-05-17');
  assert.match(lines.join('\n'), /不在 Git 仓库/);
});
