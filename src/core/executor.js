import { spawn } from 'node:child_process';

export function createExecutor({ spawnImpl = spawn } = {}) {
  return {
    async run(input) {
      return new Promise((resolve) => {
        if (input.startMessage) {
          input.writeLine?.(input.startMessage);
        }

        const shouldCaptureOutput = Boolean(input.captureOutput);
        let stdout = '';
        let stderr = '';

        const child = spawnImpl(input.command, input.args ?? [], {
          cwd: input.cwd,
          shell: false,
        });

        let settled = false;

        child.stdout?.on('data', (chunk) => {
          const text = String(chunk);
          if (shouldCaptureOutput) {
            stdout += text;
          }
          input.onStdout?.(text);
        });

        child.stderr?.on('data', (chunk) => {
          const text = String(chunk);
          if (shouldCaptureOutput) {
            stderr += text;
          }
          input.onStderr?.(text);
        });

        child.on('error', (error) => {
          if (settled) {
            return;
          }

          settled = true;
          const message = `${error.message}\n`;
          if (shouldCaptureOutput) {
            stderr += message;
          }
          input.onStderr?.(message);
          writeCompletion(input, 1);
          resolve(buildResult({
            exitCode: 1,
            shouldCaptureOutput,
            stdout,
            stderr,
          }));
        });

        child.on('close', (exitCode) => {
          if (settled) {
            return;
          }

          settled = true;
          const normalizedExitCode = exitCode ?? 1;
          writeCompletion(input, normalizedExitCode);
          resolve(buildResult({
            exitCode: normalizedExitCode,
            shouldCaptureOutput,
            stdout,
            stderr,
          }));
        });
      });
    },
  };
}

function buildResult({ exitCode, shouldCaptureOutput, stdout, stderr }) {
  if (!shouldCaptureOutput) {
    return { exitCode };
  }

  return {
    exitCode,
    stdout,
    stderr,
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
