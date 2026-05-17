import test from 'node:test';
import assert from 'node:assert/strict';

import { createBuildPlan } from './build-plan.js';

test('build server passes linux service sudo setting into restart step', () => {
  const plan = createBuildPlan({
    target: 'server',
    config: {
      platform: 'linux',
      projects: {
        server: '/opt/lumu99/lumu99-server',
      },
      server: {
        fixedJarName: 'lumu99-server.jar',
        linuxServiceName: 'lumu99-server.service',
        logFile: 'logs/server.log',
        linuxUseSudoForServiceCommands: true,
      },
    },
  });

  const restartStep = plan.steps.find((step) => step.kind === 'restart-server');

  assert.equal(restartStep.linuxUseSudoForServiceCommands, true);
});

test('build plans keep git and maven commands unprivileged on linux', () => {
  const plan = createBuildPlan({
    target: 'server',
    config: {
      platform: 'linux',
      projects: {
        server: '/opt/lumu99/lumu99-server',
      },
      server: {
        fixedJarName: 'lumu99-server.jar',
        linuxServiceName: 'lumu99-server.service',
        logFile: 'logs/server.log',
        linuxUseSudoForServiceCommands: true,
      },
    },
  });

  const gitPullStep = plan.steps.find((step) => step.label === 'git pull');
  const mavenStep = plan.steps.find((step) => step.label === 'mvn clean package -DskipTests');

  assert.equal(gitPullStep.command, 'git');
  assert.deepEqual(gitPullStep.args, ['pull']);
  assert.equal(mavenStep.command, 'mvn');
  assert.deepEqual(mavenStep.args, ['clean', 'package', '-DskipTests']);
});
