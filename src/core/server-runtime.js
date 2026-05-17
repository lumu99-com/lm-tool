import path from 'node:path';

export function createServerRestartPlan(input) {
  if (input.platform === 'linux') {
    return {
      steps: [
        {
          kind: 'command',
          label: 'systemctl restart',
          command: 'systemctl',
          args: ['restart', input.linuxServiceName],
          cwd: input.serverDir,
        },
      ],
    };
  }

  return {
    steps: [
      {
        kind: 'stop-server-process',
        label: 'stop existing server process',
        jarPath: input.jarPath,
      },
      {
        kind: 'ensure-logs-dir',
        label: 'ensure logs directory',
        logsDir: path.dirname(input.logPath),
      },
      {
        kind: 'start-java-server',
        label: 'start java server',
        serverDir: input.serverDir,
        jarPath: input.jarPath,
        logPath: input.logPath,
      },
      {
        kind: 'verify-server-process',
        label: 'verify server process',
        jarPath: input.jarPath,
      },
    ],
  };
}

export function matchesServerJarCommandLine(commandLine) {
  return commandLine.includes('lumu99-server.jar');
}
