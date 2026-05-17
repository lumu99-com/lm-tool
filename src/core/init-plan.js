import path from 'node:path';

import { REPOSITORIES, REPOSITORY_ORDER } from './clone.js';

export function createInitPlan(input) {
  const finalPaths = {};
  const cloneActions = [];
  const mkdirPaths = [];
  const pathApi = input.platform === 'windows' ? path.win32 : path.posix;
  const existingRepos = new Set(input.existingRepos ?? []);

  for (const project of REPOSITORY_ORDER) {
    if (existingRepos.has(project)) {
      finalPaths[project] = input.existingPaths[project];
      continue;
    }

    if (!input.cloneParentDir) {
      continue;
    }

    const repository = REPOSITORIES[project];
    const targetDir = pathApi.join(input.cloneParentDir, repository.dirName);

    finalPaths[project] = targetDir;
    cloneActions.push({
      project,
      repoUrl: repository.repoUrl,
      targetDir,
    });
  }

  if (cloneActions.length > 0 && input.cloneParentDir) {
    mkdirPaths.push(input.cloneParentDir);
  }

  const config = {
    schemaVersion: 1,
    platform: input.platform,
    projects: finalPaths,
    server: {
      fixedJarName: 'lumu99-server.jar',
      linuxServiceName: 'lumu99-server',
      logFile: 'logs/lm-tool-server.log',
      linuxUseSudoForServiceCommands: true,
    },
  };

  return {
    finalPaths,
    cloneActions,
    mkdirPaths,
    config,
  };
}
