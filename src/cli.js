import { buildHelpText } from './core/help-registry.js';

export async function runCli(argv, deps) {
  if (argv[0] === 'help') {
    deps.writeLine(buildHelpText());
    return { exitCode: 0 };
  }

  deps.writeLine('Unknown command');
  return { exitCode: 1 };
}
