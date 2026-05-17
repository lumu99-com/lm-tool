import { mkdir } from 'node:fs/promises';

import { createCheckCommand } from './check.js';
import { createInitPlan } from '../core/init-plan.js';
import { normalizeProjectPath, validateExistingRepoPath } from '../core/path.js';

const PROJECTS = ['server', 'web', 'admin'];

export function createInitCommand(deps) {
  const configStore = deps.configStore;
  const prompts = deps.prompts;
  const writeLine = deps.writeLine ?? (() => {});
  const writeStdout = deps.writeStdout ?? ((chunk) => process.stdout.write(chunk));
  const writeStderr = deps.writeStderr ?? ((chunk) => process.stderr.write(chunk));
  const checkCommand = deps.checkCommand ?? createCheckCommand({
    configStore,
    prompts,
    writeLine,
  });

  return {
    async run() {
      try {
        const platform = await prompts.selectPlatform();
        const repoState = await prompts.selectRepoState();
        const existingRepos = repoState === 'all'
          ? [...PROJECTS]
          : repoState === 'partial'
            ? await prompts.selectExistingRepos()
            : [];

        const existingPaths = {};
        for (const project of existingRepos) {
          const inputPath = await prompts.inputExistingRepoPath(project);
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
          const inputCloneParentDir = await prompts.inputCloneParentDir();
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

        let serverClonedInRun = false;

        for (const mkdirPath of plan.mkdirPaths) {
          await (deps.mkdirImpl ?? mkdir)(mkdirPath, { recursive: true });
        }

        for (const action of plan.cloneActions) {
          const result = await deps.executor.run({
            label: `git clone ${action.project}`,
            infoLabel: `克隆 ${action.project} 仓库`,
            startMessage: `正在克隆 ${action.project} 仓库到 ${action.targetDir}`,
            command: 'git',
            args: ['clone', action.repoUrl, action.targetDir],
            cwd: cloneParentDir,
            writeLine,
            onStdout: writeStdout,
            onStderr: writeStderr,
          });

          if (result.exitCode !== 0) {
            writeLine('仓库拉取失败，如无权限请联系 @幻仔');
            return { exitCode: result.exitCode };
          }

          if (action.project === 'server') {
            serverClonedInRun = true;
          }
        }

        await configStore.save(plan.config);

        if (serverClonedInRun) {
          const checkResult = await checkCommand.run('server');
          if (checkResult.exitCode !== 0) {
            return checkResult;
          }
        }

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
