#!/usr/bin/env node

import { runCli } from './cli.js';

void runCli(process.argv.slice(2), {
  writeLine: (line) => console.log(line),
}).then((result) => {
  process.exitCode = result.exitCode;
}).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
