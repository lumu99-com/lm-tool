import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitPlan } from '../src/core/init-plan.js';

test('createInitPlan builds clone actions for missing repositories when only part of the repos exist', () => {
  const plan = createInitPlan({
    platform: 'linux',
    repoState: 'partial',
    existingRepos: ['server'],
    existingPaths: {
      server: '/opt/lumu99/lumu99-server',
    },
    cloneParentDir: '/opt/lumu99',
  });

  assert.equal(plan.finalPaths.server, '/opt/lumu99/lumu99-server');
  assert.deepEqual(plan.cloneActions, [
    {
      project: 'web',
      repoUrl: 'git@github.com:lumu99-com/lumu-web.git',
      targetDir: '/opt/lumu99/lumu-web',
    },
    {
      project: 'admin',
      repoUrl: 'git@github.com:lumu99-com/lumu-admin.git',
      targetDir: '/opt/lumu99/lumu-admin',
    },
  ]);
});

test('createInitPlan keeps all paths when all repositories already exist', () => {
  const plan = createInitPlan({
    platform: 'linux',
    repoState: 'all',
    existingRepos: ['server', 'web', 'admin'],
    existingPaths: {
      server: '/opt/lumu99/lumu99-server',
      web: '/opt/lumu99/lumu-web',
      admin: '/opt/lumu99/lumu-admin',
    },
  });

  assert.deepEqual(plan.cloneActions, []);
  assert.deepEqual(plan.finalPaths, {
    server: '/opt/lumu99/lumu99-server',
    web: '/opt/lumu99/lumu-web',
    admin: '/opt/lumu99/lumu-admin',
  });
});

test('createInitPlan clones all repositories when none exist', () => {
  const plan = createInitPlan({
    platform: 'linux',
    repoState: 'none',
    existingRepos: [],
    existingPaths: {},
    cloneParentDir: '/opt/lumu99',
  });

  assert.deepEqual(plan.cloneActions.map((action) => action.project), [
    'server',
    'web',
    'admin',
  ]);
  assert.deepEqual(plan.finalPaths, {
    server: '/opt/lumu99/lumu99-server',
    web: '/opt/lumu99/lumu-web',
    admin: '/opt/lumu99/lumu-admin',
  });
});
