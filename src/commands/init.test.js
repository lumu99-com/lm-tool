import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import { createInitCommand } from './init.js';

test('init stops before prompts when prerequisite check fails', async () => {
  const sequence = [];
  const command = createInitCommand({
    prerequisiteCheck: {
      run: async () => {
        sequence.push('prerequisite-check');
        return { exitCode: 9 };
      },
    },
    prompts: {
      selectPlatform: async () => {
        throw new Error('selectPlatform should not run when prerequisite check fails');
      },
    },
    executor: {
      run: async () => ({ exitCode: 0 }),
    },
    configStore: {
      save: async () => {},
    },
  });

  const result = await command.run();

  assert.equal(result.exitCode, 9);
  assert.deepEqual(sequence, ['prerequisite-check']);
});

test('init runs check server after cloning server and saving config', async (t) => {
  const cloneParentDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-clone-'));
  t.after(() => rm(cloneParentDir, { recursive: true, force: true }));

  const sequence = [];
  const command = createInitCommand({
    prompts: {
      selectPlatform: async () => 'windows',
      selectRepoState: async () => 'none',
      inputCloneParentDir: async () => cloneParentDir,
    },
    prerequisiteCheck: {
      run: async () => {
        sequence.push('prerequisite-check');
        return { exitCode: 0 };
      },
    },
    executor: {
      run: async ({ label }) => {
        sequence.push(label);
        return { exitCode: 0 };
      },
    },
    configStore: {
      save: async () => {
        sequence.push('save-config');
      },
    },
    checkCommand: {
      run: async (target) => {
        sequence.push(`check:${target}`);
        return { exitCode: 0 };
      },
    },
    mkdirImpl: async () => {},
  });

  const result = await command.run();

  assert.equal(result.exitCode, 0);
  assert.deepEqual(sequence, [
    'prerequisite-check',
    'git clone server',
    'git clone web',
    'git clone admin',
    'save-config',
    'check:server',
  ]);
});

test('init does not run check server when server was not cloned in this run', async (t) => {
  const existingServerDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-server-'));
  const cloneParentDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-clone-'));
  t.after(() => rm(existingServerDir, { recursive: true, force: true }));
  t.after(() => rm(cloneParentDir, { recursive: true, force: true }));

  const checkedTargets = [];
  const clonedTargets = [];
  const sequence = [];
  const command = createInitCommand({
    prompts: {
      selectPlatform: async () => 'windows',
      selectRepoState: async () => 'partial',
      selectExistingRepos: async () => ['server'],
      inputExistingRepoPath: async () => existingServerDir,
      inputCloneParentDir: async () => cloneParentDir,
    },
    prerequisiteCheck: {
      run: async () => {
        sequence.push('prerequisite-check');
        return { exitCode: 0 };
      },
    },
    executor: {
      run: async ({ label }) => {
        sequence.push(label);
        clonedTargets.push(label);
        return { exitCode: 0 };
      },
    },
    configStore: {
      save: async () => {},
    },
    checkCommand: {
      run: async (target) => {
        checkedTargets.push(target);
        return { exitCode: 0 };
      },
    },
    mkdirImpl: async () => {},
  });

  const result = await command.run();

  assert.equal(result.exitCode, 0);
  assert.deepEqual(sequence, [
    'prerequisite-check',
    'git clone web',
    'git clone admin',
  ]);
  assert.deepEqual(clonedTargets, ['git clone web', 'git clone admin']);
  assert.deepEqual(checkedTargets, []);
});

test('init returns check server failure after successful clone and config save', async (t) => {
  const cloneParentDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-clone-'));
  t.after(() => rm(cloneParentDir, { recursive: true, force: true }));

  const sequence = [];
  const command = createInitCommand({
    prompts: {
      selectPlatform: async () => 'windows',
      selectRepoState: async () => 'none',
      inputCloneParentDir: async () => cloneParentDir,
    },
    prerequisiteCheck: {
      run: async () => {
        sequence.push('prerequisite-check');
        return { exitCode: 0 };
      },
    },
    executor: {
      run: async ({ label }) => {
        sequence.push(label);
        return { exitCode: 0 };
      },
    },
    configStore: {
      save: async () => {
        sequence.push('save-config');
      },
    },
    checkCommand: {
      run: async (target) => {
        sequence.push(`check:${target}`);
        return { exitCode: 7 };
      },
    },
    mkdirImpl: async () => {},
  });

  const result = await command.run();

  assert.equal(result.exitCode, 7);
  assert.deepEqual(sequence, [
    'prerequisite-check',
    'git clone server',
    'git clone web',
    'git clone admin',
    'save-config',
    'check:server',
  ]);
});

test('init keeps configured project paths that user chooses not to overwrite', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-server-'));
  const webDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-web-'));
  const adminDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-admin-'));
  const lmToolDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-tool-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));
  t.after(() => rm(webDir, { recursive: true, force: true }));
  t.after(() => rm(adminDir, { recursive: true, force: true }));
  t.after(() => rm(lmToolDir, { recursive: true, force: true }));

  const savedConfigs = [];
  const promptsCalled = [];
  const command = createInitCommand({
    prompts: {
      selectPlatform: async () => 'linux',
      confirmPathOverwrite: async (project) => {
        promptsCalled.push(`overwrite:${project}`);
        return false;
      },
      selectRepoState: async () => {
        throw new Error('selectRepoState should not run when all project paths are kept');
      },
      inputExistingRepoPath: async (project) => {
        throw new Error(`inputExistingRepoPath should not run for ${project}`);
      },
      inputCloneParentDir: async () => {
        throw new Error('inputCloneParentDir should not run when all project paths are kept');
      },
      inputLmToolPath: async () => {
        throw new Error('inputLmToolPath should not run when lmTool path is kept');
      },
    },
    prerequisiteCheck: {
      run: async () => ({ exitCode: 0 }),
    },
    executor: {
      run: async ({ label }) => {
        throw new Error(`executor should not run, got ${label}`);
      },
    },
    configStore: {
      load: async () => ({
        platform: 'linux',
        projects: {
          server: serverDir,
          web: webDir,
          admin: adminDir,
          lmTool: lmToolDir,
        },
        mysql: {
          port: 3306,
        },
      }),
      save: async (config) => {
        savedConfigs.push(config);
      },
    },
    checkCommand: {
      run: async () => ({ exitCode: 0 }),
    },
    mkdirImpl: async () => {
      throw new Error('mkdir should not run when no clone is needed');
    },
  });

  const result = await command.run();

  assert.equal(result.exitCode, 0);
  assert.deepEqual(promptsCalled, [
    'overwrite:server',
    'overwrite:web',
    'overwrite:admin',
    'overwrite:lmTool',
  ]);
  assert.equal(savedConfigs.length, 1);
  assert.deepEqual(savedConfigs[0].projects, {
    server: serverDir,
    web: webDir,
    admin: adminDir,
    lmTool: lmToolDir,
  });
  assert.deepEqual(savedConfigs[0].mysql, {
    port: 3306,
  });
});

test('init writes lmTool path from current repo when config is missing that field', async (t) => {
  const cloneParentDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-clone-'));
  const toolDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-tool-'));
  t.after(() => rm(cloneParentDir, { recursive: true, force: true }));
  t.after(() => rm(toolDir, { recursive: true, force: true }));

  const savedConfigs = [];
  const command = createInitCommand({
    executableDir: toolDir,
    resolveToolDir: async () => toolDir,
    prompts: {
      selectPlatform: async () => 'windows',
      selectRepoState: async () => 'none',
      inputCloneParentDir: async () => cloneParentDir,
      inputLmToolPath: async (defaultValue) => defaultValue,
    },
    prerequisiteCheck: {
      run: async () => ({ exitCode: 0 }),
    },
    executor: {
      run: async () => ({ exitCode: 0 }),
    },
    configStore: {
      load: async () => null,
      save: async (config) => {
        savedConfigs.push(config);
      },
    },
    checkCommand: {
      run: async () => ({ exitCode: 0 }),
    },
    mkdirImpl: async () => {},
  });

  const result = await command.run();

  assert.equal(result.exitCode, 0);
  assert.equal(savedConfigs.length, 1);
  assert.equal(savedConfigs[0].projects.lmTool, toolDir);
});
