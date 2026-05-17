import { mkdir } from 'node:fs/promises';

import { createInitPlan } from '../core/init-plan.js';
import { normalizeProjectPath, validateExistingRepoPath } from '../core/path.js';

const PROJECTS = ['server', 'web', 'admin'];

export function createInitCommand(deps) {
  const writeLine = deps.writeLine ?? (() => {});

  return {
    async run() {
      try {
        const platform = await deps.prompts.selectPlatform();
        const repoState = await deps.prompts.selectRepoState();
        const existingRepos = repoState === 'all'
          ? [...PROJECTS]
          : repoState === 'partial'
            ? await deps.prompts.selectExistingRepos()
            : [];

        const existingPaths = {};
        for (const project of existingRepos) {
          const inputPath = await deps.prompts.inputExistingRepoPath(project);
          const normalized = normalizeProjectPath({
            input: inputPath,
            platform,
            cwd: process.cwd(),
          });
          await validateExistingRepoPath(normalized.normalized);
          existingPaths[project] = normalized.normalized;
        }

        let cloneParentDir;
        if (existingRepos.length !== PROJECTS.length) {
          const inputCloneParentDir = await deps.prompts.inputCloneParentDir();
          cloneParentDir = normalizeProjectPath({
            input: inputCloneParentDir,
            platform,
            cwd: process.cwd(),
          }).normalized;
        }

        const plan = createInitPlan({
          platform,
          repoState,
          existingRepos,
          existingPaths,
          cloneParentDir,
        });

        for (const mkdirPath of plan.mkdirPaths) {
          await (deps.mkdirImpl ?? mkdir)(mkdirPath, { recursive: true });
        }

        for (const action of plan.cloneActions) {
          const result = await deps.executor.run({
            label: `git clone ${action.project}`,
            command: 'git',
            args: ['clone', action.repoUrl, action.targetDir],
            cwd: cloneParentDir,
          });

          if (result.exitCode !== 0) {
            writeLine('仓库拉取失败，如无权限请联系 @幻仔');
            return { exitCode: result.exitCode };
          }
        }

        await deps.configStore.save(plan.config);
        writeLine('初始化完成');
        return { exitCode: 0 };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(message);
        return { exitCode: 1 };
      }
    },
  };
}
