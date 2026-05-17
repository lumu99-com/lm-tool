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

test('linux build web keeps npm run build step', () => {
  const plan = createBuildPlan({
    target: 'web',
    config: createFrontendConfig({
      platform: 'linux',
      webDir: '/srv/lumu99/web',
      adminDir: '/srv/lumu99/admin',
    }),
  });

  const buildStep = plan.steps.find((step) => step.label === 'npm run build');

  assert.equal(buildStep.command, 'npm');
  assert.deepEqual(buildStep.args, ['run', 'build']);
});

test('windows build web launches a visible dev window instead of npm run build', () => {
  const plan = createBuildPlan({
    target: 'web',
    config: createFrontendConfig({
      platform: 'windows',
      webDir: 'D:\\Project\\lumu99\\lumu99-web',
      adminDir: 'D:\\Project\\lumu99\\lumu99-admin',
    }),
  });

  const buildStep = plan.steps.find((step) => step.label === 'npm run build');
  const devWindowStep = plan.steps.find((step) => step.label === 'start web dev window');

  assert.equal(buildStep, undefined);
  assert.equal(devWindowStep.command, 'powershell.exe');
  assert.match(devWindowStep.args.join(' '), /Start-Process/);
  assert.match(devWindowStep.args.join(' '), /npm run dev/);
});

test('macos build admin launches dev in terminal via osascript', () => {
  const plan = createBuildPlan({
    target: 'admin',
    config: createFrontendConfig({
      platform: 'macos',
      webDir: '/Users/dev/lumu99-web',
      adminDir: '/Users/dev/lumu99-admin',
    }),
  });

  const devWindowStep = plan.steps.find((step) => step.label === 'start admin dev window');

  assert.equal(devWindowStep.command, 'osascript');
  assert.match(devWindowStep.args.join(' '), /npm run dev/);
  assert.match(devWindowStep.args.join(' '), /Terminal/);
});

function createFrontendConfig({ platform, webDir, adminDir }) {
  return {
    platform,
    projects: {
      web: webDir,
      admin: adminDir,
    },
    server: {
      fixedJarName: 'lumu99-server.jar',
      linuxServiceName: 'lumu99-server',
      logFile: 'logs/server.log',
      linuxUseSudoForServiceCommands: true,
    },
  };
}
