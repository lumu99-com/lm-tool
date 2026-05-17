import { spawn } from 'node:child_process';

export function createExecutor({ spawnImpl = spawn } = {}) {
  return {
    async run(input) {
      return new Promise((resolve) => {
        if (input.startMessage) {
          input.writeLine?.(input.startMessage);
        }

        const child = spawnImpl(input.command, input.args ?? [], {
          cwd: input.cwd,
          shell: false,
        });

        let settled = false;

        child.stdout?.on('data', (chunk) => {
          input.onStdout?.(String(chunk));
        });

        child.stderr?.on('data', (chunk) => {
          input.onStderr?.(String(chunk));
        });

        child.on('error', (error) => {
          if (settled) {
            return;
          }

          settled = true;
          input.onStderr?.(`${error.message}\n`);
          writeCompletion(input, 1);
          resolve({ exitCode: 1 });
        });

        child.on('close', (exitCode) => {
          if (settled) {
            return;
          }

          settled = true;
          writeCompletion(input, exitCode ?? 1);
          resolve({ exitCode: exitCode ?? 1 });
        });
      });
    },
  };
}

function writeCompletion(input, exitCode) {
  const infoLabel = input.infoLabel ?? input.label ?? buildFallbackLabel(input);
  const status = exitCode === 0 ? '执行成功' : '执行失败';
  input.writeLine?.(`[INFO] ${infoLabel} ${status}`);
  input.writeLine?.('=======================');
}

function buildFallbackLabel(input) {
  const parts = [input.command, ...(input.args ?? [])].filter(Boolean);
  return parts.join(' ');
}
