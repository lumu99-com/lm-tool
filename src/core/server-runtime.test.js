import test from 'node:test';
import assert from 'node:assert/strict';

import { createServerRestartPlan, matchesServerJarCommandLine } from './server-runtime.js';

function createLinuxInput(overrides = {}) {
  return {
    platform: 'linux',
    serverDir: '/opt/lumu99/lumu99-server',
    jarPath: '/opt/lumu99/lumu99-server/target/lumu99-server.jar',
    logPath: '/opt/lumu99/lumu99-server/logs/server.log',
    linuxServiceName: 'lumu99-server.service',
    ...overrides,
  };
}

test('linux restart plan uses sudo when service sudo is enabled', () => {
  const plan = createServerRestartPlan(createLinuxInput({
    linuxUseSudoForServiceCommands: true,
  }));

  assert.equal(plan.steps[0].command, 'sudo');
  assert.deepEqual(plan.steps[0].args, ['systemctl', 'restart', 'lumu99-server.service']);
});

test('linux restart plan skips sudo when service sudo is disabled', () => {
  const plan = createServerRestartPlan(createLinuxInput({
    linuxUseSudoForServiceCommands: false,
  }));

  assert.equal(plan.steps[0].command, 'systemctl');
  assert.deepEqual(plan.steps[0].args, ['restart', 'lumu99-server.service']);
});

test('linux restart plan defaults to sudo for old linux configs', () => {
  const plan = createServerRestartPlan(createLinuxInput());

  assert.equal(plan.steps[0].command, 'sudo');
  assert.deepEqual(plan.steps[0].args, ['systemctl', 'restart', 'lumu99-server.service']);
});

test('server jar matcher only matches fixed jar name', () => {
  assert.equal(matchesServerJarCommandLine('java -jar /opt/app/target/lumu99-server.jar'), true);
  assert.equal(matchesServerJarCommandLine('java -jar /opt/app/target/lumu99-server-1.1.9.jar'), false);
});
