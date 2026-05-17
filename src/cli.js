import { buildHelpText } from './core/help-registry.js';
import { createConfigStore } from './core/config.js';
import { createExecutor } from './core/executor.js';
import { createBuildCommand } from './commands/build.js';
import { createInitCommand } from './commands/init.js';
import { createPromptUi } from './ui/prompt.js';
import path from 'node:path';

export async function runCli(argv, deps) {
  const command = argv[0];

  if (!command) {
    deps.writeLine('命令错误，请使用 lm help 查看帮助');
    return { exitCode: 1 };
  }

  if (command === 'help') {
    deps.writeLine(buildHelpText());
    return { exitCode: 0 };
  }

  const executableDir = deps.executableDir ?? path.dirname(process.argv[1] ?? process.cwd());
  const configStore = deps.configStore ?? createConfigStore({ executableDir });
  const executor = deps.executor ?? createExecutor();

  if (command === 'init') {
    const initCommand = deps.initCommand ?? createInitCommand({
      prompts: deps.prompts ?? createPromptUi(),
      executor,
      configStore,
      writeLine: deps.writeLine,
    });
    return initCommand.run();
  }

  if (command === 'build') {
    const target = argv[1] ?? 'all';
    const buildCommand = deps.buildCommand ?? createBuildCommand({
      executor,
      configStore,
      writeLine: deps.writeLine,
    });
    return buildCommand.run(target);
  }

  deps.writeLine('命令错误，请使用 lm help 查看帮助');
  return { exitCode: 1 };
}
