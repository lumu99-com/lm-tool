import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitPlan } from './init-plan.js';

test('linux init config enables sudo for service commands by default', () => {
  const plan = createInitPlan({
    platform: 'linux',
    repoState: 'none',
    existingRepos: [],
    existingPaths: {},
    cloneParentDir: '/opt/lumu99',
  });

  assert.equal(plan.config.server.linuxUseSudoForServiceCommands, true);
});
