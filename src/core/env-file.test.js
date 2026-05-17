import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';

import {
  ensureServerEnvFile,
  readEmptyEnvKeys,
  resolveServerEnvPaths,
  syncAddedExampleLines,
} from './env-file.js';

test('ensureServerEnvFile copies .env.example when .env is missing', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-env-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  await writeFile(path.join(serverDir, '.env.example'), 'SPRING_PROFILES_ACTIVE=dev\n');

  const config = {
    projects: {
      server: serverDir,
    },
  };

  const paths = resolveServerEnvPaths({ config });
  const result = await ensureServerEnvFile({ config });

  assert.equal(paths.envPath, path.join(serverDir, '.env'));
  assert.equal(paths.examplePath, path.join(serverDir, '.env.example'));
  assert.equal(result.createdFromExample, true);
  assert.equal(await readFile(paths.envPath, 'utf8'), 'SPRING_PROFILES_ACTIVE=dev\n');
});

test('ensureServerEnvFile does not overwrite an existing .env file', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-env-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  await writeFile(path.join(serverDir, '.env.example'), 'SPRING_PROFILES_ACTIVE=dev\n');
  await writeFile(path.join(serverDir, '.env'), 'SPRING_PROFILES_ACTIVE=prod\n');

  const result = await ensureServerEnvFile({
    config: {
      projects: {
        server: serverDir,
      },
    },
  });

  assert.equal(result.createdFromExample, false);
  assert.equal(
    await readFile(path.join(serverDir, '.env'), 'utf8'),
    'SPRING_PROFILES_ACTIVE=prod\n',
  );
});

test('readEmptyEnvKeys finds empty env values', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-env-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  const envPath = path.join(tempDir, '.env');
  await writeFile(
    envPath,
    [
      '# Database',
      'spring.datasource.url=jdbc:mysql://127.0.0.1:3306/lumu99',
      'spring.datasource.username=',
      'spring.datasource.password=   ',
      'logging.level.root=INFO',
      '',
    ].join('\n'),
  );

  const keys = await readEmptyEnvKeys({ envPath });

  assert.deepEqual(keys, [
    'spring.datasource.username',
    'spring.datasource.password',
  ]);
});

test('syncAddedExampleLines only syncs pure-added keys and comments without overwriting existing values', () => {
  const result = syncAddedExampleLines({
    beforeExampleLines: [
      '# Base',
      'A=1',
      '# Cache',
      'CACHE_PORT=6379',
      'B=1',
    ],
    afterExampleLines: [
      '# Base',
      'A=2',
      '# Cache',
      'CACHE_PORT=6379',
      '# Redis',
      'REDIS_HOST=127.0.0.1',
      'REDIS_PASSWORD=',
      'B=1',
    ],
    envLines: [
      '# Base',
      'A=9',
      '# Cache',
      'CACHE_PORT=16379',
      'B=7',
    ],
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.lines, [
    '# Base',
    'A=9',
    '# Cache',
    'CACHE_PORT=16379',
    '# Redis',
    'REDIS_HOST=127.0.0.1',
    'REDIS_PASSWORD=',
    'B=7',
  ]);
});

test('syncAddedExampleLines ignores modified and deleted example lines', () => {
  const result = syncAddedExampleLines({
    beforeExampleLines: [
      '# Base',
      'SPRING_MODE=prod',
      'LEGACY_TOKEN=abc',
    ],
    afterExampleLines: [
      '# Base',
      'SPRING_MODE=dev',
    ],
    envLines: [
      '# Base',
      'APP_NAME=lumu99',
    ],
  });

  assert.equal(result.changed, false);
  assert.deepEqual(result.lines, [
    '# Base',
    'APP_NAME=lumu99',
  ]);
});

test('syncAddedExampleLines keeps pure-added comment and key from a mixed diff block', () => {
  const result = syncAddedExampleLines({
    beforeExampleLines: [
      'A=1',
      'B=1',
    ],
    afterExampleLines: [
      'A=2',
      '# Redis',
      'C=3',
      'B=1',
    ],
    envLines: [
      'B=7',
    ],
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.lines, [
    '# Redis',
    'C=3',
    'B=7',
  ]);
});

test('syncAddedExampleLines does not insert a modified old comment', () => {
  const result = syncAddedExampleLines({
    beforeExampleLines: [
      '# Base',
      'A=1',
    ],
    afterExampleLines: [
      '# Base Config',
      'A=1',
    ],
    envLines: [
      'A=9',
    ],
  });

  assert.equal(result.changed, false);
  assert.deepEqual(result.lines, [
    'A=9',
  ]);
});

test('syncAddedExampleLines keeps a real new comment before a replaced old comment in the same block', () => {
  const result = syncAddedExampleLines({
    beforeExampleLines: [
      '# Base',
      'A=1',
    ],
    afterExampleLines: [
      '# Redis',
      '# Base Config',
      'A=1',
    ],
    envLines: [
      'A=9',
    ],
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.lines, [
    '# Redis',
    'A=9',
  ]);
});

test('syncAddedExampleLines prefers the more likely replacement when two new comments tie on base similarity', () => {
  const result = syncAddedExampleLines({
    beforeExampleLines: [
      '# Base',
      'A=1',
    ],
    afterExampleLines: [
      '# Base Redis',
      '# Base Config',
      'A=1',
    ],
    envLines: [
      'A=9',
    ],
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.lines, [
    '# Base Redis',
    'A=9',
  ]);
});
