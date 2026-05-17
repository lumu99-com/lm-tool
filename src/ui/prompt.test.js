import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { createPromptUi } from './prompt.js';

test('prompt ui exposes env value input method', () => {
  const ui = createPromptUi();
  assert.equal(typeof ui.inputEnvValue, 'function');
});

test('inputEnvValue prompts with key and returns trimmed visible input', async () => {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = () => {};

  const output = new CaptureTtyOutput();
  const ui = createPromptUi({ input, output });

  const resultPromise = ui.inputEnvValue('spring.datasource.username');
  input.write('  root  \n');

  const result = await resultPromise;

  assert.equal(result, 'root');
  assert.match(output.buffer, /spring\.datasource\.username/);
  assert.match(output.buffer, /  root  /);
});

class CaptureTtyOutput extends Writable {
  constructor() {
    super();
    this.buffer = '';
    this.isTTY = true;
    this.columns = 80;
    this.rows = 24;
  }

  _write(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    callback();
  }

  cursorTo() {}

  moveCursor() {}

  clearLine() {}

  clearScreenDown() {}
}
