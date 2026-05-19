import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

import { createCheckCommand } from './check.js';
import { createInitPlan } from '../core/init-plan.js';
import { createInitPrerequisiteCheck } from '../core/init-prerequisites.js';
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
  const prerequisiteCheck = deps.prerequisiteCheck ?? createInitPrerequisiteCheck({
    executor: deps.executor,
    writeLine,
    writeStdout,
    writeStderr,
    runtimePlatform: deps.runtimePlatform ?? process.platform,
  });

  return {
    async run() {
      try {
        const prerequisiteResult = await prerequisiteCheck.run();
        if (prerequisiteResult.exitCode !== 0) {
          return prerequisiteResult;
        }

        const existingConfig = await loadConfig(configStore);
        const platform = await prompts.selectPlatform();
        const existingProjects = existingConfig?.projects ?? {};
        const keptPaths = {};
        const unresolvedProjects = [];

        for (const project of PROJECTS) {
          const configuredPath = existingProjects[project];
          if (!configuredPath) {
            unresolvedProjects.push(project);
            continue;
          }

          const shouldOverwrite = await prompts.confirmPathOverwrite?.(project, configuredPath) ?? true;
          if (!shouldOverwrite) {
            await validateExistingRepoPath(configuredPath);
            keptPaths[project] = configuredPath;
            continue;
          }

          unresolvedProjects.push(project);
        }

        let repoState = 'all';
        if (unresolvedProjects.length > 0) {
          repoState = await prompts.selectRepoState();
        }

        const promptedExistingRepos = unresolvedProjects.length === 0
          ? []
          : repoState === 'all'
            ? [...unresolvedProjects]
            : repoState === 'partial'
              ? await prompts.selectExistingRepos(unresolvedProjects)
              : [];

        const existingRepos = [...Object.keys(keptPaths), ...promptedExistingRepos];
        const existingPaths = { ...keptPaths };

        for (const project of promptedExistingRepos) {
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
        const lmToolPath = await resolveLmToolPath({
          prompts,
          platform,
          cwd: process.cwd(),
          existingLmToolPath: existingProjects.lmTool,
          resolveToolDir: deps.resolveToolDir ?? resolveToolDir,
          executableDir: deps.executableDir ?? process.cwd(),
        });
        const finalConfig = buildFinalConfig({
          existingConfig,
          nextConfig: plan.config,
          lmToolPath,
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

        await configStore.save(finalConfig);

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

async function loadConfig(configStore) {
  if (!configStore?.load) {
    return null;
  }

  return configStore.load();
}

async function resolveLmToolPath({
  prompts,
  platform,
  cwd,
  existingLmToolPath,
  resolveToolDir,
  executableDir,
}) {
  if (existingLmToolPath) {
    const shouldOverwrite = await prompts.confirmPathOverwrite?.('lmTool', existingLmToolPath) ?? true;
    if (!shouldOverwrite) {
      await validateExistingRepoPath(existingLmToolPath);
      return existingLmToolPath;
    }
  }

  const defaultToolDir = await resolveToolDir(executableDir) ?? executableDir;
  const inputPath = prompts.inputLmToolPath
    ? await prompts.inputLmToolPath(defaultToolDir)
    : defaultToolDir;
  const normalized = normalizeProjectPath({
    input: inputPath,
    platform,
    cwd,
  });
  await validateExistingRepoPath(normalized.normalized);
  return normalized.normalized;
}

function buildFinalConfig({ existingConfig, nextConfig, lmToolPath }) {
  return {
    ...existingConfig,
    ...nextConfig,
    projects: {
      ...(existingConfig?.projects ?? {}),
      ...(nextConfig.projects ?? {}),
      lmTool: lmToolPath,
    },
    server: {
      ...(existingConfig?.server ?? {}),
      ...(nextConfig.server ?? {}),
    },
  };
}

async function resolveToolDir(executableDir) {
  const result = await runCaptureCommand({
    command: 'git',
    args: ['rev-parse', '--show-toplevel'],
    cwd: executableDir,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

async function runCaptureCommand(input) {
  return new Promise((resolve) => {
    const child = spawn(input.command, input.args ?? [], {
      cwd: input.cwd,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({ exitCode: 1, stdout, stderr });
    });

    child.on('close', (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}
