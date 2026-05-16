export async function runCli(argv, deps) {
  if (argv[0] === 'help') {
    deps.writeLine('lm init');
    deps.writeLine('lm build');
    return { exitCode: 0 };
  }

  deps.writeLine('Unknown command');
  return { exitCode: 1 };
}
