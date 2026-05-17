import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

import { createConfigStore } from '../src/core/config.js';

test('config store reads and writes lm.config.json beside the executable directory', async () => {
  const executableDir = await mkdtemp(path.join(os.tmpdir(), 'lm-tool-config-'));

  try {
    const store = createConfigStore({ executableDir });

    await store.save({
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
    });

    const configPath = path.join(executableDir, 'lm.config.json');
    const fileContents = await readFile(configPath, 'utf8');
    assert.match(fileContents, /"platform": "linux"/);

    const loaded = await store.load();
    assert.equal(loaded.projects.server, '/srv/server');
  } finally {
    await rm(executableDir, { recursive: true, force: true });
  }
});
