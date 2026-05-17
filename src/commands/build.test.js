import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';

import { createBuildCommand } from './build.js';

function createServerConfig(serverDir) {
  return {
    platform: 'windows',
    projects: {
      server: serverDir,
    },
    server: {
      fixedJarName: 'lumu99-server.jar',
      logFile: 'logs/server.log',
      linuxServiceName: 'lumu99-server',
    },
  };
}

test('build server syncs new example lines and runs check server before maven build', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-build-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const envPath = path.join(serverDir, '.env');
  const examplePath = path.join(serverDir, '.env.example');

  await writeFile(examplePath, 'SPRING_PROFILES_ACTIVE=prod\n');
  await writeFile(envPath, 'SPRING_PROFILES_ACTIVE=local\n');

  const sequence = [];
  let envContentAtCheck = '';
  const command = createBuildCommand({
    configStore: {
      load: async () => createServerConfig(serverDir),
    },
    executor: {
      run: async ({ label }) => {
        sequence.push(label);
        if (label === 'git pull') {
          await writeFile(
            examplePath,
            [
              'SPRING_PROFILES_ACTIVE=prod',
              '# Redis',
              'REDIS_HOST=127.0.0.1',
              'REDIS_PASSWORD=',
              '',
            ].join('\n'),
          );
        }

        return { exitCode: 0 };
      },
    },
    checkCommand: {
      run: async (target) => {
        sequence.push(`check:${target}`);
        envContentAtCheck = await readFile(envPath, 'utf8');
        return { exitCode: 0 };
      },
    },
    locateVersionedServerJar: async () => ({ fullPath: path.join(serverDir, 'target', 'lumu99-server-1.1.8.jar') }),
    copyServerJarToFixedName: async () => {
      sequence.push('copy-jar');
    },
    createServerRestartPlan: () => ({ steps: [] }),
    writeLine: () => {},
  });

  const result = await command.run('server');
  const envContent = await readFile(envPath, 'utf8');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(sequence, [
    'git pull',
    'check:server',
    'mvn clean package -DskipTests',
    'copy-jar',
  ]);
  assert.match(envContentAtCheck, /^SPRING_PROFILES_ACTIVE=local\s*$/m);
  assert.match(envContentAtCheck, /^# Redis\s*$/m);
  assert.match(envContentAtCheck, /^REDIS_HOST=127\.0\.0\.1\s*$/m);
  assert.match(envContentAtCheck, /^REDIS_PASSWORD=\s*$/m);
  assert.equal(envContent, envContentAtCheck);
});

test('build server sync does not overwrite existing env values', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-build-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const envPath = path.join(serverDir, '.env');
  const examplePath = path.join(serverDir, '.env.example');

  await writeFile(
    examplePath,
    [
      'SPRING_PROFILES_ACTIVE=prod',
      'APP_PORT=8080',
      '',
    ].join('\n'),
  );
  await writeFile(envPath, 'SPRING_PROFILES_ACTIVE=local\n');

  const command = createBuildCommand({
    configStore: {
      load: async () => createServerConfig(serverDir),
    },
    executor: {
      run: async ({ label }) => {
        if (label === 'git pull') {
          await writeFile(
            examplePath,
            [
              'SPRING_PROFILES_ACTIVE=dev',
              'APP_PORT=8080',
              'NEW_REDIS_HOST=127.0.0.1',
              '',
            ].join('\n'),
          );
        }

        return { exitCode: 0 };
      },
    },
    checkCommand: {
      run: async () => ({ exitCode: 0 }),
    },
    locateVersionedServerJar: async () => ({ fullPath: path.join(serverDir, 'target', 'lumu99-server-1.1.8.jar') }),
    copyServerJarToFixedName: async () => {},
    createServerRestartPlan: () => ({ steps: [] }),
    writeLine: () => {},
  });

  const result = await command.run('server');
  const envContent = await readFile(envPath, 'utf8');

  assert.equal(result.exitCode, 0);
  assert.match(envContent, /^SPRING_PROFILES_ACTIVE=local\s*$/m);
  assert.match(envContent, /^NEW_REDIS_HOST=127\.0\.0\.1\s*$/m);
  assert.doesNotMatch(envContent, /^SPRING_PROFILES_ACTIVE=dev\s*$/m);
});

test('build server stops before maven build when check server fails', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-build-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const examplePath = path.join(serverDir, '.env.example');
  await writeFile(examplePath, 'SPRING_PROFILES_ACTIVE=prod\n');

  const sequence = [];
  const command = createBuildCommand({
    configStore: {
      load: async () => createServerConfig(serverDir),
    },
    executor: {
      run: async ({ label }) => {
        sequence.push(label);
        return { exitCode: 0 };
      },
    },
    checkCommand: {
      run: async (target) => {
        sequence.push(`check:${target}`);
        return { exitCode: 9 };
      },
    },
    locateVersionedServerJar: async () => ({ fullPath: path.join(serverDir, 'target', 'lumu99-server-1.1.8.jar') }),
    copyServerJarToFixedName: async () => {
      sequence.push('copy-jar');
    },
    createServerRestartPlan: () => ({ steps: [] }),
    writeLine: () => {},
  });

  const result = await command.run('server');

  assert.equal(result.exitCode, 9);
  assert.deepEqual(sequence, [
    'git pull',
    'check:server',
  ]);
});

test('windows build web launches a new dev window instead of npm run build', async () => {
  const calls = [];
  const command = createBuildCommand({
    configStore: {
      load: async () => ({
        platform: 'windows',
        projects: {
          web: 'D:\\Project\\lumu99\\lumu99-web',
        },
        server: {
          fixedJarName: 'lumu99-server.jar',
          logFile: 'logs/server.log',
          linuxServiceName: 'lumu99-server',
        },
      }),
    },
    executor: {
      run: async ({ label, command: commandName, args, cwd }) => {
        calls.push({ label, commandName, args, cwd });
        return { exitCode: 0 };
      },
    },
    writeLine: () => {},
  });

  const result = await command.run('web');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls.map((call) => call.label), [
    'git pull',
    'npm install',
    'start web dev window',
  ]);
  assert.equal(calls[2].commandName, 'powershell.exe');
  assert.match(calls[2].args.join(' '), /npm run dev/);
  assert.doesNotMatch(calls.map((call) => call.label).join('\n'), /npm run build/);
});

test('windows build all launches web and admin dev windows after server build', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-build-all-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  const calls = [];
  const command = createBuildCommand({
    configStore: {
      load: async () => ({
        platform: 'windows',
        projects: {
          server: serverDir,
          web: 'D:\\Project\\lumu99\\lumu99-web',
          admin: 'D:\\Project\\lumu99\\lumu99-admin',
        },
        server: {
          fixedJarName: 'lumu99-server.jar',
          logFile: 'logs/server.log',
          linuxServiceName: 'lumu99-server',
        },
      }),
    },
    executor: {
      run: async ({ label, command: commandName, args, cwd }) => {
        calls.push({ label, commandName, args, cwd });
        return { exitCode: 0 };
      },
    },
    checkCommand: {
      run: async () => ({ exitCode: 0 }),
    },
    locateVersionedServerJar: async () => ({ fullPath: path.join(serverDir, 'target', 'lumu99-server-1.1.8.jar') }),
    copyServerJarToFixedName: async () => {
      calls.push({ label: 'copy-jar' });
    },
    createServerRestartPlan: () => ({ steps: [] }),
    writeLine: () => {},
  });

  const result = await command.run('all');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls.map((call) => call.label), [
    'git pull',
    'mvn clean package -DskipTests',
    'copy-jar',
    'git pull',
    'npm install',
    'start web dev window',
    'git pull',
    'npm install',
    'start admin dev window',
  ]);
  assert.equal(calls[5].commandName, 'powershell.exe');
  assert.equal(calls[8].commandName, 'powershell.exe');
});

test('windows server restart steps use the configured fixed jar name for process matching', async (t) => {
  const serverDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-build-runtime-'));
  t.after(() => rm(serverDir, { recursive: true, force: true }));

  await writeFile(path.join(serverDir, '.env.example'), 'SPRING_PROFILES_ACTIVE=prod\n');

  const calls = [];
  const fixedJarName = 'custom-server.jar';
  const command = createBuildCommand({
    configStore: {
      load: async () => ({
        platform: 'windows',
        projects: {
          server: serverDir,
        },
        server: {
          fixedJarName,
          logFile: 'logs/server.log',
          linuxServiceName: 'lumu99-server',
        },
      }),
    },
    executor: {
      run: async (input) => {
        calls.push(input);
        return { exitCode: 0 };
      },
    },
    checkCommand: {
      run: async () => ({ exitCode: 0 }),
    },
    locateVersionedServerJar: async () => ({
      fullPath: path.join(serverDir, 'target', 'custom-server-1.1.8.jar'),
    }),
    copyServerJarToFixedName: async () => {},
    createServerRestartPlan: (step) => ({
      steps: [
        {
          kind: 'stop-server-process',
          label: 'stop existing server process',
          infoLabel: 'stop server',
          startMessage: 'stop server',
          jarPath: step.jarPath,
        },
        {
          kind: 'verify-server-process',
          label: 'verify server process',
          infoLabel: 'verify server',
          startMessage: 'verify server',
          jarPath: step.jarPath,
        },
      ],
    }),
    writeLine: () => {},
  });

  const result = await command.run('server');
  const stopCall = calls.find((call) => call.label === 'stop existing server process');
  const verifyCall = calls.find((call) => call.label === 'verify server process');

  assert.equal(result.exitCode, 0);
  assert.equal(stopCall.command, 'powershell.exe');
  assert.match(stopCall.args.join(' '), /custom-server\.jar/);
  assert.equal(verifyCall.command, 'powershell.exe');
  assert.match(verifyCall.args.join(' '), /custom-server\.jar/);
});
