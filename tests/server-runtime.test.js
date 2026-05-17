import test from 'node:test';
import assert from 'node:assert/strict';

import { createServerRestartPlan, matchesServerJarCommandLine } from '../src/core/server-runtime.js';

test('createServerRestartPlan uses systemctl on linux', () => {
  const plan = createServerRestartPlan({
    platform: 'linux',
    serverDir: '/opt/lumu99/lumu99-server',
    jarPath: '/opt/lumu99/lumu99-server/target/lumu99-server.jar',
    logPath: '/opt/lumu99/lumu99-server/logs/lm-tool-server.log',
    linuxServiceName: 'lumu99-server',
  });

  assert.deepEqual(plan.steps.map((step) => step.label), ['systemctl restart']);
  assert.equal(plan.steps[0].command, 'systemctl');
});

test('createServerRestartPlan creates process-stop and java-start steps for windows', () => {
  const plan = createServerRestartPlan({
    platform: 'windows',
    serverDir: 'D:/repos/lumu99-server',
    jarPath: 'D:/repos/lumu99-server/target/lumu99-server.jar',
    logPath: 'D:/repos/lumu99-server/logs/lm-tool-server.log',
    linuxServiceName: 'lumu99-server',
  });

  assert.deepEqual(plan.steps.map((step) => step.label), [
    'stop existing server process',
    'ensure logs directory',
    'start java server',
    'verify server process',
  ]);
});

test('matchesServerJarCommandLine only matches the fixed jar name', () => {
  assert.equal(matchesServerJarCommandLine('java -jar target/lumu99-server.jar'), true);
  assert.equal(matchesServerJarCommandLine('java -jar target/other-app.jar'), false);
});
