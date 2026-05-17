import { spawn } from 'node:child_process';

export function createExecutor({ spawnImpl = spawn } = {}) {
  return {
    async run(input) {
      return new Promise((resolve, reject) => {
        const child = spawnImpl(input.command, input.args ?? [], {
          cwd: input.cwd,
          shell: false,
        });

        child.stdout?.on('data', (chunk) => {
          input.onStdout?.(String(chunk));
        });

        child.stderr?.on('data', (chunk) => {
          input.onStderr?.(String(chunk));
        });

        child.on('error', reject);
        child.on('close', (exitCode) => {
          resolve({ exitCode: exitCode ?? 1 });
        });
      });
    },
  };
}
