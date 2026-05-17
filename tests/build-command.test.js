import test from 'node:test';
import assert from 'node:assert/strict';

import { createBuildCommand } from '../src/commands/build.js';

function createConfig() {
  return {
    schemaVersion: 1,
    platform: 'linux',
    projects: {
      server: '/srv/server',
      web: '/srv/web',
      admin: '/srv/admin',
    },
    server: {
      fixedJarName: 'lumu99-server.jar',
      linuxServiceName: 'lumu99-server',
      logFile: 'logs/lm-tool-server.log',
    },
  };
}

test('build command runs steps in order and prints the success line for web', async () => {
  const lines = [];
  const calls = [];
  const command = createBuildCommand({
    executor: {
      async run(step) {
        calls.push(step.label);
        return { exitCode: 0 };
      },
    },
    configStore: {
      async load() {
        return createConfig();
      },
    },
    locateVersionedServerJar: async () => ({ fileName: 'lumu99-server-1.1.8.jar', fullPath: '/srv/server/target/lumu99-server-1.1.8.jar' }),
    copyServerJarToFixedName: async () => {},
    createServerRestartPlan: () => ({ steps: [] }),
    runRuntimeStep: async () => ({ exitCode: 0 }),
    writeLine: (line) => lines.push(line),
  });

  const result = await command.run('web');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls, ['git pull', 'npm install', 'npm run build']);
  assert.equal(lines.at(-1), 'web 编译成功');
});

test('build command runs server jar copy and restart helpers', async () => {
  const calls = [];
  const command = createBuildCommand({
    executor: {
      async run(step) {
        calls.push(step.label);
        return { exitCode: 0 };
      },
    },
    configStore: {
      async load() {
        return createConfig();
      },
    },
    locateVersionedServerJar: async () => ({ fileName: 'lumu99-server-1.1.8.jar', fullPath: '/srv/server/target/lumu99-server-1.1.8.jar' }),
    copyServerJarToFixedName: async () => {
      calls.push('copy server jar');
    },
    createServerRestartPlan: () => ({
      steps: [{ kind: 'command', label: 'systemctl restart', command: 'systemctl', args: ['restart', 'lumu99-server'], cwd: '/srv/server' }],
    }),
    runRuntimeStep: async (step) => {
      calls.push(step.label);
      return { exitCode: 0 };
    },
    writeLine: () => {},
  });

  const result = await command.run('server');

  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls, [
    'git pull',
    'mvn clean package -DskipTests',
    'copy server jar',
    'systemctl restart',
  ]);
});

test('build command stops on the first failure for aggregate builds', async () => {
  const calls = [];
  const command = createBuildCommand({
    executor: {
      async run(step) {
        calls.push(step.label);
        return { exitCode: step.label === 'mvn clean package -DskipTests' ? 1 : 0 };
      },
    },
    configStore: {
      async load() {
        return createConfig();
      },
    },
    locateVersionedServerJar: async () => ({ fileName: 'lumu99-server-1.1.8.jar', fullPath: '/srv/server/target/lumu99-server-1.1.8.jar' }),
    copyServerJarToFixedName: async () => {
      calls.push('copy server jar');
    },
    createServerRestartPlan: () => ({ steps: [] }),
    runRuntimeStep: async () => ({ exitCode: 0 }),
    writeLine: () => {},
  });

  const result = await command.run('all');

  assert.equal(result.exitCode, 1);
  assert.deepEqual(calls, ['git pull', 'mvn clean package -DskipTests']);
});

test('build command asks the user to run lm init first when config is missing', async () => {
  const lines = [];
  const command = createBuildCommand({
    executor: {
      async run() {
        throw new Error('should not run');
      },
    },
    configStore: {
      async load() {
        return null;
      },
    },
    locateVersionedServerJar: async () => {
      throw new Error('should not run');
    },
    copyServerJarToFixedName: async () => {
      throw new Error('should not run');
    },
    createServerRestartPlan: () => ({ steps: [] }),
    runRuntimeStep: async () => ({ exitCode: 0 }),
    writeLine: (line) => lines.push(line),
  });

  const result = await command.run('web');

  assert.equal(result.exitCode, 1);
  assert.equal(lines.at(-1), '请先执行 lm init');
});
