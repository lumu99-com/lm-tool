import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';

import { createInitCommand } from '../src/commands/init.js';

test('init command clones missing repos for the partial state and saves the final config', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-init-'));
  const existingServerDir = path.join(rootDir, 'lumu99-server');
  const cloneParentDir = path.join(rootDir, 'repos');
  const executorCalls = [];
  let savedConfig = null;

  try {
    await mkdir(existingServerDir, { recursive: true });

    const command = createInitCommand({
      prompts: {
        async selectPlatform() {
          return 'windows';
        },
        async selectRepoState() {
          return 'partial';
        },
        async selectExistingRepos() {
          return ['server'];
        },
        async inputExistingRepoPath(project) {
          return project === 'server' ? existingServerDir : '';
        },
        async inputCloneParentDir() {
          return cloneParentDir;
        },
      },
      executor: {
        async run(step) {
          executorCalls.push([step.command, ...step.args].join(' '));
          return { exitCode: 0 };
        },
      },
      configStore: {
        async save(config) {
          savedConfig = config;
        },
      },
      writeLine: () => {},
    });

    const result = await command.run();

    assert.equal(result.exitCode, 0);
    assert.deepEqual(executorCalls, [
      `git clone git@github.com:lumu99-com/lumu-web.git ${path.win32.join(cloneParentDir, 'lumu-web')}`,
      `git clone git@github.com:lumu99-com/lumu-admin.git ${path.win32.join(cloneParentDir, 'lumu-admin')}`,
    ]);
    assert.equal(savedConfig.projects.server, existingServerDir);
    assert.equal(savedConfig.projects.web, path.win32.join(cloneParentDir, 'lumu-web'));
    assert.equal(savedConfig.projects.admin, path.win32.join(cloneParentDir, 'lumu-admin'));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('init command fails when an existing repository path does not exist', async () => {
  const lines = [];
  const missingDir = path.join(os.tmpdir(), 'lm-tool-does-not-exist');

  const command = createInitCommand({
    prompts: {
      async selectPlatform() {
        return 'windows';
      },
      async selectRepoState() {
        return 'all';
      },
      async inputExistingRepoPath() {
        return missingDir;
      },
    },
    executor: {
      async run() {
        throw new Error('should not run');
      },
    },
    configStore: {
      async save() {
        throw new Error('should not save');
      },
    },
    writeLine: (line) => lines.push(line),
  });

  const result = await command.run();

  assert.equal(result.exitCode, 1);
  assert.match(lines.at(-1), /does not exist/);
});
