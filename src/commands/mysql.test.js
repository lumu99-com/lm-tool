import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';

import { createMysqlCommand } from './mysql.js';

test('mysql summary prints configured mysql info and help hint', async () => {
  const lines = [];
  const command = createMysqlCommand({
    configStore: {
      load: async () => ({
        mysql: {
          port: 3307,
          username: 'root',
          password: '',
        },
      }),
    },
    writeLine: (line) => lines.push(line),
  });

  const result = await command.run('summary');

  assert.equal(result.exitCode, 0);
  assert.match(lines.join('\n'), /3307/);
  assert.match(lines.join('\n'), /root/);
  assert.match(lines.join('\n'), /空密码/);
  assert.match(lines.join('\n'), /lm mysql help/);
});

test('mysql init saves prompted defaults before reporting missing server path', async () => {
  const savedConfigs = [];
  const command = createMysqlCommand({
    configStore: {
      load: async () => null,
      save: async (config) => {
        savedConfigs.push(config);
      },
    },
    prompts: {
      inputMysqlPort: async () => '3306',
      inputMysqlUsername: async () => 'root',
      inputMysqlPassword: async () => '',
    },
    executor: {
      run: async () => ({ exitCode: 0, stdout: '' }),
    },
    writeLine: () => {},
  });

  const result = await command.run('init');

  assert.equal(result.exitCode, 1);
  assert.equal(savedConfigs.length, 1);
  assert.equal(savedConfigs[0].mysql.port, 3306);
  assert.equal(savedConfigs[0].mysql.username, 'root');
  assert.equal(savedConfigs[0].mysql.password, '');
});

test('mysql init stops when lumu99 already exists and the user cancels recreation', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-mysql-init-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const executedSteps = [];
  const command = createMysqlCommand({
    configStore: {
      load: async () => ({
        projects: {
          server: serverDir,
        },
        mysql: {
          port: 3306,
          username: 'root',
          password: '',
        },
      }),
      save: async () => {},
    },
    prompts: {
      selectMysqlInitAction: async () => 'cancel',
    },
    executor: {
      run: async ({ label }) => {
        executedSteps.push(label);
        if (label === 'mysql query schema exists') {
          return { exitCode: 0, stdout: 'lumu99\n' };
        }

        return { exitCode: 0, stdout: '' };
      },
    },
    readdirImpl: async () => [],
    writeLine: () => {},
  });

  const result = await command.run('init');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(executedSteps, ['mysql query schema exists']);
});

test('mysql init creates schema and runs migration files in version order', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-mysql-init-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const migrationDir = path.join(serverDir, 'src', 'main', 'resources', 'db', 'migration');
  await mkdir(migrationDir, { recursive: true });
  await writeFile(path.join(migrationDir, 'V12__media_key_unification.sql'), 'select 12;\n');
  await writeFile(path.join(migrationDir, 'V1__init_schema.sql'), 'select 1;\n');

  const executed = [];
  const command = createMysqlCommand({
    configStore: {
      load: async () => ({
        projects: {
          server: serverDir,
        },
        mysql: {
          port: 3306,
          username: 'root',
          password: '',
        },
      }),
      save: async () => {},
    },
    executor: {
      run: async ({ label, stdinText }) => {
        executed.push({ label, stdinText });
        if (label === 'mysql query schema exists') {
          return { exitCode: 0, stdout: '' };
        }

        return { exitCode: 0, stdout: '' };
      },
    },
    writeLine: () => {},
  });

  const result = await command.run('init');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(executed.map((entry) => entry.label), [
    'mysql query schema exists',
    'mysql create schema',
    'mysql migrate V1__init_schema.sql',
    'mysql migrate V12__media_key_unification.sql',
  ]);
  assert.match(executed[1].stdinText, /create schema lumu99/i);
  assert.match(executed[2].stdinText, /select 1;/i);
  assert.match(executed[3].stdinText, /select 12;/i);
});

test('mysql user inserts a bcrypt 2a hash and selected role', async () => {
  const sqlInputs = [];
  const command = createMysqlCommand({
    configStore: {
      load: async () => ({
        mysql: {
          port: 3306,
          username: 'root',
          password: '',
        },
      }),
      save: async () => {},
    },
    prompts: {
      inputMysqlNewUsername: async () => 'tester',
      inputMysqlNewPassword: async () => 'secret',
      selectMysqlUserRole: async () => 'ADMIN',
    },
    executor: {
      run: async ({ label, stdinText }) => {
        sqlInputs.push({ label, stdinText });
        return { exitCode: 0, stdout: '' };
      },
    },
    bcryptApi: {
      genSaltSync: () => '$2b$10$abcdefghijklmnopqrstuv',
      hashSync: () => '$2b$10$abcdefghijklmnopqrstuv123456789012345678901234567890123',
    },
    randomUuid: () => '11111111-1111-1111-1111-111111111111',
    randomToken: () => 'random-token',
    writeLine: () => {},
  });

  const result = await command.run('user');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(sqlInputs.map((entry) => entry.label), ['mysql insert user']);
  assert.match(sqlInputs[0].stdinText, /tester/);
  assert.match(sqlInputs[0].stdinText, /\$2a\$10\$/);
  assert.match(sqlInputs[0].stdinText, /ADMIN/);
  assert.match(sqlInputs[0].stdinText, /11111111-1111-1111-1111-111111111111/);
});
