import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';

import { createCheckCommand } from './check.js';
import { resolveServerEnvPaths } from '../core/env-file.js';

test('server check creates .env from .env.example when missing', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-check-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  await writeFile(path.join(serverDir, '.env.example'), 'SPRING_DATASOURCE_USERNAME=\n');

  const promptedKeys = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => ({
        projects: {
          server: serverDir,
        },
      }),
    },
    prompts: {
      inputEnvValue: async (key) => {
        promptedKeys.push(key);
        return 'root';
      },
    },
  });

  const result = await command.run('server');
  const envContent = await readFile(path.join(serverDir, '.env'), 'utf8');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(promptedKeys, ['SPRING_DATASOURCE_USERNAME']);
  assert.match(envContent, /^SPRING_DATASOURCE_USERNAME=root\s*$/m);
});

test('server check prompts for each empty key and writes values back immediately', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-check-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const envPath = path.join(serverDir, '.env');
  await writeFile(envPath, 'FIRST_KEY=\nSECOND_KEY=\n');

  const promptSnapshots = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => ({
        projects: {
          server: serverDir,
        },
      }),
    },
    prompts: {
      inputEnvValue: async (key) => {
        promptSnapshots.push({
          key,
          content: await readFile(envPath, 'utf8'),
        });
        return key === 'FIRST_KEY' ? 'alpha' : 'beta';
      },
    },
  });

  const result = await command.run('server');
  const envContent = await readFile(envPath, 'utf8');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(promptSnapshots.map((entry) => entry.key), ['FIRST_KEY', 'SECOND_KEY']);
  assert.match(promptSnapshots[0].content, /^FIRST_KEY=\s*$/m);
  assert.match(promptSnapshots[1].content, /^FIRST_KEY=alpha\s*$/m);
  assert.match(promptSnapshots[1].content, /^SECOND_KEY=\s*$/m);
  assert.match(envContent, /^FIRST_KEY=alpha\s*$/m);
  assert.match(envContent, /^SECOND_KEY=beta\s*$/m);
});

test('server check keeps prompting the same key until it receives a non-empty value', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-check-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const envPath = path.join(serverDir, '.env');
  await writeFile(envPath, 'FIRST_KEY=\n');

  const answers = ['', '   ', 'final-value'];
  const promptSnapshots = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => ({
        projects: {
          server: serverDir,
        },
      }),
    },
    prompts: {
      inputEnvValue: async (key) => {
        promptSnapshots.push({
          key,
          content: await readFile(envPath, 'utf8'),
        });
        return answers.shift();
      },
    },
  });

  const result = await command.run('server');
  const envContent = await readFile(envPath, 'utf8');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(promptSnapshots.map((entry) => entry.key), ['FIRST_KEY', 'FIRST_KEY', 'FIRST_KEY']);
  assert.match(promptSnapshots[0].content, /^FIRST_KEY=\s*$/m);
  assert.match(promptSnapshots[1].content, /^FIRST_KEY=\s*$/m);
  assert.match(promptSnapshots[2].content, /^FIRST_KEY=\s*$/m);
  assert.match(envContent, /^FIRST_KEY=final-value\s*$/m);
});

test('server check prints skip message when both .env and .env.example are missing', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-check-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const lines = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => ({
        projects: {
          server: serverDir,
        },
      }),
    },
    prompts: {
      inputEnvValue: async () => 'unused',
    },
    writeLine: (line) => lines.push(line),
  });

  const result = await command.run('server');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(lines, ['server 项目目录下未找到 .env.example，跳过检查']);
});

test('lm check all runs server then web then admin in order', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-check-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  await writeFile(path.join(serverDir, '.env.example'), 'FIRST_KEY=\n');

  const sequence = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => ({
        projects: {
          server: serverDir,
        },
      }),
    },
    prompts: {
      inputEnvValue: async (key) => {
        sequence.push(`prompt:${key}`);
        return 'value';
      },
    },
    writeLine: (line) => sequence.push(line),
  });

  const result = await command.run('all');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(sequence, [
    'prompt:FIRST_KEY',
    'web 暂无检查项',
    'admin 暂无检查项',
  ]);
});

test('check prints init hint when config is missing', async () => {
  const lines = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => null,
    },
    prompts: {
      inputEnvValue: async () => 'unused',
    },
    writeLine: (line) => lines.push(line),
  });

  const result = await command.run('server');

  assert.equal(result.exitCode, 1);
  assert.deepEqual(lines, ['请先执行 lm init']);
});

test('server check reuses the existing server path config error', async () => {
  const config = {
    projects: {},
  };
  const lines = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => config,
    },
    prompts: {
      inputEnvValue: async () => 'unused',
    },
    writeLine: (line) => lines.push(line),
  });

  let expectedMessage = '';
  try {
    resolveServerEnvPaths({ config });
  } catch (error) {
    expectedMessage = error.message;
  }

  const result = await command.run('server');

  assert.equal(result.exitCode, 1);
  assert.deepEqual(lines, [expectedMessage]);
});

test('web check succeeds without init', async () => {
  const lines = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => null,
    },
    writeLine: (line) => lines.push(line),
  });

  const result = await command.run('web');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(lines, ['web 暂无检查项']);
});

test('admin check succeeds without init', async () => {
  const lines = [];
  const command = createCheckCommand({
    configStore: {
      load: async () => null,
    },
    writeLine: (line) => lines.push(line),
  });

  const result = await command.run('admin');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(lines, ['admin 暂无检查项']);
});
