import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitPrerequisiteCheck } from './init-prerequisites.js';

test('init prerequisite check succeeds when required versions are installed', async () => {
  const commands = [];
  const checker = createInitPrerequisiteCheck({
    runtimePlatform: 'win32',
    executor: {
      run: async ({ command, args }) => {
        const key = `${command} ${args.join(' ')}`;
        commands.push(key);

        if (key === 'java -version') {
          return {
            exitCode: 0,
            stderr: 'openjdk version "17.0.12" 2024-07-16\n',
          };
        }

        if (key === 'mvn -version') {
          return {
            exitCode: 0,
            stdout: 'Apache Maven 3.9.9\nMaven home: C:\\apache-maven\n',
          };
        }

        if (key === 'mysql --version') {
          return {
            exitCode: 0,
            stdout: 'mysql  Ver 8.0.39 for Win64 on x86_64 (MySQL Community Server - GPL)\n',
          };
        }

        if (key === 'redis-server --version') {
          return {
            exitCode: 0,
            stdout: 'Redis server v=6.2.14 sha=00000000:0 malloc=jemalloc-5.3.0 bits=64 build=123456\n',
          };
        }

        throw new Error(`unexpected command: ${key}`);
      },
    },
    writeLine: () => {},
    writeStdout: () => {},
    writeStderr: () => {},
  });

  const result = await checker.run();

  assert.equal(result.exitCode, 0);
  assert.deepEqual(commands, [
    'java -version',
    'mvn -version',
    'mysql --version',
    'redis-server --version',
  ]);
});

test('init prerequisite check fails when jdk major version is not 17', async () => {
  const lines = [];
  const checker = createInitPrerequisiteCheck({
    runtimePlatform: 'linux',
    executor: {
      run: async ({ command, args }) => {
        const key = `${command} ${args.join(' ')}`;
        if (key === 'java -version') {
          return {
            exitCode: 0,
            stderr: 'openjdk version "21.0.2" 2024-01-16\n',
          };
        }

        throw new Error(`unexpected command: ${key}`);
      },
    },
    writeLine: (line) => lines.push(line),
    writeStdout: () => {},
    writeStderr: () => {},
  });

  const result = await checker.run();

  assert.equal(result.exitCode, 1);
  assert.match(lines.join('\n'), /JDK 17/);
  assert.match(lines.join('\n'), /21\.0\.2/);
});

test('init prerequisite check falls back to mysqld version output when mysql command is unavailable', async () => {
  const commands = [];
  const checker = createInitPrerequisiteCheck({
    runtimePlatform: 'darwin',
    executor: {
      run: async ({ command, args }) => {
        const key = `${command} ${args.join(' ')}`;
        commands.push(key);

        if (key === 'java -version') {
          return {
            exitCode: 0,
            stderr: 'openjdk version "17.0.11" 2024-04-16\n',
          };
        }

        if (key === 'mvn -version') {
          return {
            exitCode: 0,
            stdout: 'Apache Maven 3.9.6\n',
          };
        }

        if (key === 'mysql --version') {
          return {
            exitCode: 1,
            stderr: 'mysql: command not found\n',
          };
        }

        if (key === 'mysqld --version') {
          return {
            exitCode: 0,
            stdout: 'mysqld  Ver 8.4.0 for macos14 on x86_64 (MySQL Community Server - GPL)\n',
          };
        }

        if (key === 'redis-server --version') {
          return {
            exitCode: 0,
            stdout: 'Redis server v=7.2.5 sha=00000000:0 malloc=libc bits=64 build=123456\n',
          };
        }

        throw new Error(`unexpected command: ${key}`);
      },
    },
    writeLine: () => {},
    writeStdout: () => {},
    writeStderr: () => {},
  });

  const result = await checker.run();

  assert.equal(result.exitCode, 0);
  assert.deepEqual(commands, [
    'java -version',
    'mvn -version',
    'mysql --version',
    'mysqld --version',
    'redis-server --version',
  ]);
});
