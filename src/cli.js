import path from 'node:path';
import { spawn } from 'node:child_process';

import { createBuildCommand } from './commands/build.js';
import { createCheckCommand } from './commands/check.js';
import { createInitCommand } from './commands/init.js';
import { createConfigStore } from './core/config.js';
import { createExecutor } from './core/executor.js';
import { buildHelpText } from './core/help-registry.js';
import { runSelfUpdatePreflight } from './core/self-update.js';
import { createPromptUi } from './ui/prompt.js';

const COMMAND_ERROR_MESSAGE = '命令错误，请使用 lm help 查看帮助';

export async function runCli(argv, deps) {
  const command = argv[0];
  const subcommand = argv[1];

  const executableDir = deps.executableDir ?? path.dirname(process.argv[1] ?? process.cwd());
  const configStore = deps.configStore ?? createConfigStore({ executableDir });
  const executor = deps.executor ?? createExecutor();
  const prompts = deps.prompts ?? createPromptUi();
  const writeLine = deps.writeLine ?? ((line) => console.log(line));
  const writeStdout = deps.writeStdout ?? ((chunk) => process.stdout.write(chunk));
  const writeStderr = deps.writeStderr ?? ((chunk) => process.stderr.write(chunk));
  const selfUpdatePreflight = deps.selfUpdatePreflight ?? runSelfUpdatePreflight;

  const selfUpdateResult = await selfUpdatePreflight({
    executableDir,
    executor,
    prompts,
    writeLine,
    writeStdout,
    writeStderr,
  });

  if (selfUpdateResult.exitCode !== 0) {
    return { exitCode: selfUpdateResult.exitCode };
  }

  if (selfUpdateResult.shouldReexec) {
    return rerunCurrentProcess();
  }

  if (!command) {
    writeLine(COMMAND_ERROR_MESSAGE);
    return { exitCode: 1 };
  }

  if (command === 'help') {
    writeLine(buildHelpText('root'));
    return { exitCode: 0 };
  }

  if (command === 'init') {
    const initCommand = deps.initCommand ?? createInitCommand({
      prompts,
      executor,
      configStore,
      writeLine,
      writeStdout,
      writeStderr,
    });
    return initCommand.run();
  }

  if (command === 'build') {
    const target = subcommand ?? 'all';
    if (target === 'help') {
      writeLine(buildHelpText('build'));
      return { exitCode: 0 };
    }

    if (!['all', 'server', 'web', 'admin'].includes(target)) {
      writeLine(COMMAND_ERROR_MESSAGE);
      return { exitCode: 1 };
    }

    const buildCommand = deps.buildCommand ?? createBuildCommand({
      executor,
      configStore,
      writeLine,
      writeStdout,
      writeStderr,
    });
    return buildCommand.run(target);
  }

  if (command === 'check') {
    const target = subcommand ?? 'all';
    if (target === 'help') {
      writeLine(buildHelpText('check'));
      return { exitCode: 0 };
    }

    if (!['all', 'server', 'web', 'admin'].includes(target)) {
      writeLine(COMMAND_ERROR_MESSAGE);
      return { exitCode: 1 };
    }

    const checkCommand = deps.checkCommand ?? createCheckCommand({
      configStore,
      prompts,
      writeLine,
    });
    return checkCommand.run(target);
  }

  writeLine(COMMAND_ERROR_MESSAGE);
  return { exitCode: 1 };
}

async function rerunCurrentProcess() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, process.argv.slice(1), {
      env: {
        ...process.env,
        LM_TOOL_SKIP_SELF_UPDATE: '1',
      },
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', () => {
      resolve({ exitCode: 1 });
    });

    child.on('close', (exitCode) => {
      resolve({ exitCode: exitCode ?? 1 });
    });
  });
}
