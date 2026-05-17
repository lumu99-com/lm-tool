import test from 'node:test';
import assert from 'node:assert/strict';

import { createBuildPlan } from '../src/core/build-plan.js';

test('createBuildPlan creates the web build command sequence with git pull first', () => {
  const plan = createBuildPlan({
    target: 'web',
    config: {
      platform: 'linux',
      projects: {
        web: '/opt/lumu99/lumu-web',
      },
      server: {
        fixedJarName: 'lumu99-server.jar',
        linuxServiceName: 'lumu99-server',
        logFile: 'logs/lm-tool-server.log',
      },
    },
  });

  assert.deepEqual(plan.steps.map((step) => step.label), [
    'git pull',
    'npm install',
    'npm run build',
  ]);
  assert.equal(plan.steps[0].cwd, '/opt/lumu99/lumu-web');
});

test('createBuildPlan creates the aggregate build order as server, web, admin', () => {
  const plan = createBuildPlan({
    target: 'all',
    config: {
      platform: 'linux',
      projects: {
        server: '/opt/lumu99/lumu99-server',
        web: '/opt/lumu99/lumu-web',
        admin: '/opt/lumu99/lumu-admin',
      },
      server: {
        fixedJarName: 'lumu99-server.jar',
        linuxServiceName: 'lumu99-server',
        logFile: 'logs/lm-tool-server.log',
      },
    },
  });

  assert.deepEqual(plan.children.map((child) => child.target), ['server', 'web', 'admin']);
});

test('createBuildPlan throws when the target project path is missing from config', () => {
  assert.throws(
    () => createBuildPlan({
      target: 'admin',
      config: {
        platform: 'linux',
        projects: {},
        server: {
          fixedJarName: 'lumu99-server.jar',
          linuxServiceName: 'lumu99-server',
          logFile: 'logs/lm-tool-server.log',
        },
      },
    }),
    /Missing project path for admin/,
  );
});
