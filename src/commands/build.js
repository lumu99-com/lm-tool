import { mkdir } from 'node:fs/promises';
import { openSync } from 'node:fs';
import { spawn } from 'node:child_process';

import { createBuildPlan } from '../core/build-plan.js';
import { locateVersionedServerJar, copyServerJarToFixedName } from '../core/jar.js';
import { createServerRestartPlan, matchesServerJarCommandLine } from '../core/server-runtime.js';

export function createBuildCommand(deps) {
  const executor = deps.executor;
  const writeLine = deps.writeLine ?? (() => {});
  const writeStdout = deps.writeStdout ?? ((chunk) => process.stdout.write(chunk));
  const writeStderr = deps.writeStderr ?? ((chunk) => process.stderr.write(chunk));

  return {
    async run(target) {
      const config = await deps.configStore.load();
      if (!config) {
        writeLine('请先执行 lm init');
        return { exitCode: 1 };
      }

      return runTarget(target, config);
    },
  };

  async function runTarget(target, config) {
    const plan = createBuildPlan({ target, config });

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
      const result = await runStep(step);
      if (result.exitCode !== 0) {
        writeLine(`${plan.target} 构建失败：${step.label}`);
        return result;
      }
    }

    writeLine(plan.successMessage);
    return { exitCode: 0 };
  }

  async function runStep(step) {
    if (step.kind === 'command') {
      return executor.run({
        ...step,
        onStdout: writeStdout,
        onStderr: writeStderr,
      });
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
              onStdout: writeStdout,
              onStderr: writeStderr,
            })
          : await (deps.runRuntimeStep ?? runRuntimeStepDefault)(restartStep, {
              executor,
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
}

async function runRuntimeStepDefault(step, context) {
  if (step.kind === 'ensure-logs-dir') {
    await mkdir(step.logsDir, { recursive: true });
    return { exitCode: 0 };
  }

  if (step.kind === 'stop-server-process') {
    if (process.platform === 'win32') {
      return context.executor.run({
        label: step.label,
        command: 'powershell.exe',
        args: [
          '-Command',
          "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*lumu99-server.jar*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
        ],
        cwd: process.cwd(),
        onStdout: context.writeStdout,
        onStderr: context.writeStderr,
      });
    }

    return context.executor.run({
      label: step.label,
      command: 'sh',
      args: ['-lc', "pkill -f 'lumu99-server.jar' || true"],
      cwd: process.cwd(),
      onStdout: context.writeStdout,
      onStderr: context.writeStderr,
    });
  }

  if (step.kind === 'start-java-server') {
    const stdoutFd = openSync(step.logPath, 'a');
    const stderrFd = openSync(step.logPath, 'a');
    const child = spawn('java', ['-jar', step.jarPath], {
      cwd: step.serverDir,
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
    });
    child.unref();
    return { exitCode: 0 };
  }

  if (step.kind === 'verify-server-process') {
    if (process.platform === 'win32') {
      const result = await context.executor.run({
        label: step.label,
        command: 'powershell.exe',
        args: [
          '-Command',
          "if (Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*lumu99-server.jar*' }) { exit 0 } else { exit 1 }",
        ],
        cwd: process.cwd(),
        onStdout: context.writeStdout,
        onStderr: context.writeStderr,
      });
      return result;
    }

    return context.executor.run({
      label: step.label,
      command: 'sh',
      args: ['-lc', "pgrep -f 'lumu99-server.jar' >/dev/null"],
      cwd: process.cwd(),
      onStdout: context.writeStdout,
      onStderr: context.writeStderr,
    });
  }

  return { exitCode: matchesServerJarCommandLine(step.jarPath ?? '') ? 0 : 1 };
}
