import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { openSync } from 'node:fs';
import { spawn } from 'node:child_process';

import { createCheckCommand } from './check.js';
import { createBuildPlan } from '../core/build-plan.js';
import {
  applyEnvKeyUpdates,
  ensureServerEnvFile,
  findModifiedExampleKeyUpdates,
  resolveServerEnvPaths,
  syncAddedExampleLines,
} from '../core/env-file.js';
import { locateVersionedServerJar, copyServerJarToFixedName } from '../core/jar.js';
import {
  createServerRestartPlan,
  matchesServerJarCommandLine,
  resolveServerJarFileName,
} from '../core/server-runtime.js';

export function createBuildCommand(deps) {
  const executor = deps.executor;
  const configStore = deps.configStore;
  const prompts = deps.prompts ?? {};
  const writeLine = deps.writeLine ?? (() => {});
  const writeStdout = deps.writeStdout ?? ((chunk) => process.stdout.write(chunk));
  const writeStderr = deps.writeStderr ?? ((chunk) => process.stderr.write(chunk));
  const readFileImpl = deps.readFileImpl ?? readFile;
  const writeFileImpl = deps.writeFileImpl ?? writeFile;
  const ensureEnvFile = deps.ensureServerEnvFile ?? ensureServerEnvFile;
  const findModifiedExampleUpdates = deps.findModifiedExampleKeyUpdates ?? findModifiedExampleKeyUpdates;
  const resolveEnvPaths = deps.resolveServerEnvPaths ?? resolveServerEnvPaths;
  const syncExampleLines = deps.syncAddedExampleLines ?? syncAddedExampleLines;
  const applyKeyUpdates = deps.applyEnvKeyUpdates ?? applyEnvKeyUpdates;
  const checkCommand = deps.checkCommand ?? createCheckCommand({
    configStore,
    prompts,
    writeLine,
  });

  return {
    async run(target) {
      const config = await configStore.load();
      if (!config) {
        writeLine('请先执行 lm init');
        return { exitCode: 1 };
      }

      try {
        return await runTarget(target, config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(message);
        return { exitCode: 1 };
      }
    },
  };

  async function runTarget(target, config) {
    const plan = createBuildPlan({ target, config });
    const state = {};

    if (plan.children) {
      for (const child of plan.children) {
        const result = await runTarget(child.target, config);
        if (result.exitCode !== 0) {
          return result;
        }
      }

      return { exitCode: 0 };
    }

    for (const step of plan.steps) {
      const result = await runStep(step, { config, state });
      if (result.exitCode !== 0) {
        writeLine(`${plan.target} 构建失败：${step.infoLabel ?? step.label}`);
        return result;
      }
    }

    writeLine(plan.successMessage);
    return { exitCode: 0 };
  }

  async function runStep(step, context) {
    if (step.kind === 'command') {
      return executor.run({
        ...step,
        writeLine,
        onStdout: writeStdout,
        onStderr: writeStderr,
      });
    }

    if (step.kind === 'snapshot-server-example') {
      context.state.serverExamplePaths = resolveEnvPaths({ config: context.config });
      context.state.beforeExampleContent = await readFileIfExists(
        context.state.serverExamplePaths.examplePath,
      );
      return { exitCode: 0 };
    }

    if (step.kind === 'sync-server-env') {
      return runManagedStep(step, async () => {
        await syncServerEnvAfterPull(context);
        return { exitCode: 0 };
      });
    }

    if (step.kind === 'check-server-env') {
      return runManagedStep(step, async () => checkCommand.run('server'));
    }

    if (step.kind === 'copy-server-jar') {
      const versionedJar = await (deps.locateVersionedServerJar ?? locateVersionedServerJar)({
        targetDir: step.targetDir,
      });
      await (deps.copyServerJarToFixedName ?? copyServerJarToFixedName)({
        versionedJarPath: versionedJar.fullPath,
        fixedJarPath: step.fixedJarPath,
      });
      return { exitCode: 0 };
    }

    if (step.kind === 'restart-server') {
      const restartPlan = (deps.createServerRestartPlan ?? createServerRestartPlan)(step);
      for (const restartStep of restartPlan.steps) {
        const result = restartStep.kind === 'command'
          ? await executor.run({
              ...restartStep,
              writeLine,
              onStdout: writeStdout,
              onStderr: writeStderr,
            })
          : await (deps.runRuntimeStep ?? runRuntimeStepDefault)(restartStep, {
              executor,
              writeLine,
              writeStdout,
              writeStderr,
            });

        if (result.exitCode !== 0) {
          return result;
        }
      }

      return { exitCode: 0 };
    }

    throw new Error(`Unsupported build step: ${step.kind}`);
  }

  async function syncServerEnvAfterPull(context) {
    const paths = context.state.serverExamplePaths ?? resolveEnvPaths({ config: context.config });
    const ensureResult = await ensureEnvFile({ config: context.config });
    if (!ensureResult.envExists || !ensureResult.exampleExists) {
      return;
    }

    const beforeExampleContent = context.state.beforeExampleContent ?? '';
    const afterExampleContent = await readFileImpl(paths.examplePath, 'utf8');
    const envContent = await readFileImpl(paths.envPath, 'utf8');
    const syncResult = syncExampleLines({
      beforeExampleLines: beforeExampleContent,
      afterExampleLines: afterExampleContent,
      envLines: envContent,
    });

    if (!syncResult.changed) {
      await promptModifiedExampleUpdates({
        beforeExampleContent,
        afterExampleContent,
        envContent,
        envPath: paths.envPath,
      });
      return;
    }

    const syncedEnvContent = stringifyEnvLines({
      lines: syncResult.lines,
      originalContent: envContent,
      fallbackContent: afterExampleContent,
    });

    await writeFileImpl(paths.envPath, syncedEnvContent);
    await promptModifiedExampleUpdates({
      beforeExampleContent,
      afterExampleContent,
      envContent: syncedEnvContent,
      envPath: paths.envPath,
    });
  }

  async function promptModifiedExampleUpdates({
    beforeExampleContent,
    afterExampleContent,
    envContent,
    envPath,
  }) {
    const prompt = prompts.selectEnvExampleUpdateAction;
    if (typeof prompt !== 'function') {
      return;
    }

    const modifiedKeyUpdates = findModifiedExampleUpdates({
      beforeExampleLines: beforeExampleContent,
      afterExampleLines: afterExampleContent,
      envLines: envContent,
    });
    if (modifiedKeyUpdates.length === 0) {
      return;
    }

    const approvedUpdates = [];
    for (const item of modifiedKeyUpdates) {
      const action = await prompt(item);
      if (action === 'update-local') {
        approvedUpdates.push({
          key: item.key,
          value: item.afterExampleValue,
        });
      }
    }

    if (approvedUpdates.length === 0) {
      return;
    }

    const nextLines = applyKeyUpdates({
      envLines: envContent,
      updates: approvedUpdates,
    });
    await writeFileImpl(
      envPath,
      stringifyEnvLines({
        lines: nextLines,
        originalContent: envContent,
        fallbackContent: afterExampleContent,
      }),
    );
  }

  async function runManagedStep(step, action) {
    if (step.startMessage) {
      writeLine(step.startMessage);
    }

    try {
      const result = await action();
      writeStepCompletion(step, result.exitCode ?? 1, writeLine);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeStderr(`${message}\n`);
      writeStepCompletion(step, 1, writeLine);
      return { exitCode: 1 };
    }
  }
}

function writeStepCompletion(step, exitCode, writeLine = console.log) {
  const status = exitCode === 0 ? '执行成功' : '执行失败';
  const infoLabel = step.infoLabel ?? step.label;
  writeLine(`[INFO] ${infoLabel} ${status}`);
  writeLine('=======================');
}

function stringifyEnvLines({ lines, originalContent, fallbackContent }) {
  if (lines.length === 0) {
    return '';
  }

  const lineEnding = detectLineEnding(originalContent) ?? detectLineEnding(fallbackContent) ?? '\n';
  const hasTrailingNewline = endsWithLineEnding(originalContent)
    || (!originalContent && endsWithLineEnding(fallbackContent));

  return `${lines.join(lineEnding)}${hasTrailingNewline ? lineEnding : ''}`;
}

function detectLineEnding(content) {
  if (typeof content !== 'string' || content.length === 0) {
    return null;
  }

  return content.includes('\r\n') ? '\r\n' : '\n';
}

function endsWithLineEnding(content) {
  return typeof content === 'string' && (content.endsWith('\r\n') || content.endsWith('\n'));
}

async function readFileIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function runRuntimeStepDefault(step, context) {
  if (step.kind === 'ensure-logs-dir') {
    await mkdir(step.logsDir, { recursive: true });
    return { exitCode: 0 };
  }

  if (step.kind === 'stop-server-process') {
    const jarFileName = resolveServerJarFileName(step.jarPath);
    if (process.platform === 'win32') {
      return context.executor.run({
        label: step.label,
        infoLabel: step.infoLabel,
        startMessage: step.startMessage,
        command: 'powershell.exe',
        args: [
          '-Command',
          `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escapePowerShellSingleQuotedString(jarFileName)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
        ],
        cwd: process.cwd(),
        writeLine: context.writeLine,
        onStdout: context.writeStdout,
        onStderr: context.writeStderr,
      });
    }

    return context.executor.run({
      label: step.label,
      infoLabel: step.infoLabel,
      startMessage: step.startMessage,
      command: 'sh',
      args: ['-lc', `pkill -f ${quotePosix(jarFileName)} || true`],
      cwd: process.cwd(),
      writeLine: context.writeLine,
      onStdout: context.writeStdout,
      onStderr: context.writeStderr,
    });
  }

  if (step.kind === 'start-java-server') {
    return new Promise((resolve) => {
      context.writeLine?.(step.startMessage);

      try {
        const stdoutFd = openSync(step.logPath, 'a');
        const stderrFd = openSync(step.logPath, 'a');
        const child = spawn('java', ['-jar', step.jarPath], {
          cwd: step.serverDir,
          detached: true,
          stdio: ['ignore', stdoutFd, stderrFd],
        });

        child.once('error', (error) => {
          context.writeStderr?.(`${error.message}\n`);
          context.writeLine?.(`[INFO] ${step.infoLabel} 执行失败`);
          context.writeLine?.('=======================');
          resolve({ exitCode: 1 });
        });

        child.once('spawn', () => {
          child.unref();
          context.writeLine?.(`[INFO] ${step.infoLabel} 执行成功`);
          context.writeLine?.('=======================');
          resolve({ exitCode: 0 });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.writeStderr?.(`${message}\n`);
        context.writeLine?.(`[INFO] ${step.infoLabel} 执行失败`);
        context.writeLine?.('=======================');
        resolve({ exitCode: 1 });
      }
    });
  }

  if (step.kind === 'verify-server-process') {
    const jarFileName = resolveServerJarFileName(step.jarPath);
    if (process.platform === 'win32') {
      const result = await context.executor.run({
        label: step.label,
        infoLabel: step.infoLabel,
        startMessage: step.startMessage,
        command: 'powershell.exe',
        args: [
          '-Command',
          `if (Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escapePowerShellSingleQuotedString(jarFileName)}*' }) { exit 0 } else { exit 1 }`,
        ],
        cwd: process.cwd(),
        writeLine: context.writeLine,
        onStdout: context.writeStdout,
        onStderr: context.writeStderr,
      });
      return result;
    }

    return context.executor.run({
      label: step.label,
      infoLabel: step.infoLabel,
      startMessage: step.startMessage,
      command: 'sh',
      args: ['-lc', `pgrep -f ${quotePosix(jarFileName)} >/dev/null`],
      cwd: process.cwd(),
      writeLine: context.writeLine,
      onStdout: context.writeStdout,
      onStderr: context.writeStderr,
    });
  }

  return { exitCode: matchesServerJarCommandLine(step.jarPath ?? '', step.jarPath) ? 0 : 1 };
}

function escapePowerShellSingleQuotedString(value) {
  return String(value).replaceAll("'", "''");
}

function quotePosix(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}
