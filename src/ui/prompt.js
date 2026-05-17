import readline from 'node:readline';

export function createPromptUi({ input = process.stdin, output = process.stdout } = {}) {
  return {
    async selectPlatform() {
      return select({
        input,
        output,
        message: '请选择当前平台',
        hint: '使用 ↑/↓ 选择，Enter 确认',
        options: ['windows', 'macos', 'linux'],
        formatOption: formatPlatform,
      });
    },
    async selectRepoState() {
      return select({
        input,
        output,
        message: '请选择仓库状态',
        hint: '使用 ↑/↓ 选择，Enter 确认',
        options: ['all', 'partial', 'none'],
        formatOption: formatRepoState,
      });
    },
    async selectExistingRepos() {
      return multiselect({
        input,
        output,
        message: '哪些仓库已经存在？',
        hint: '使用 ↑/↓ 移动，Space 勾选/取消，Enter 确认',
        options: ['server', 'web', 'admin'],
        formatOption: (option) => option,
      });
    },
    async selectSelfUpdateAction() {
      return select({
        input,
        output,
        message: 'lm-tool 有更新，但是 lm-tool 本地仓库有变更',
        hint: '使用上下方向键选择，Enter 确认',
        options: ['restore-and-update', 'skip-update'],
        formatOption: formatSelfUpdateAction,
      });
    },
    async inputExistingRepoPath(project) {
      return promptText({
        input,
        output,
        message: `请输入 ${project} 仓库路径`,
        hint: '请输入本机仓库目录，程序会自动校验是否存在',
      });
    },
    async inputCloneParentDir() {
      output.write('请输入项目父目录，不存在会自动创建\n');
      output.write('缺失仓库会自动 clone 到该目录下\n');
      output.write('如果 git clone 提示无权限，请联系 @幻仔\n');
      return promptText({
        input,
        output,
        message: '请输入项目父目录',
      });
    },
  };
}

function formatPlatform(platform) {
  if (platform === 'windows') return 'Windows';
  if (platform === 'macos') return 'macOS';
  return 'Linux';
}

function formatRepoState(state) {
  if (state === 'all') return '已拉取三个仓库';
  if (state === 'partial') return '拉取了部分仓库';
  return '未拉取仓库';
}

function formatSelfUpdateAction(action) {
  if (action === 'restore-and-update') {
    return '回退本地变更并更新';
  }

  return '跳过更新，继续执行当前命令';
}

async function promptText({ input, output, message, hint }) {
  if (hint) {
    output.write(`${hint}\n`);
  }

  const rl = readline.createInterface({ input, output });
  try {
    return await new Promise((resolve) => {
      rl.question(`${message}: `, (answer) => resolve(answer.trim()));
    });
  } finally {
    rl.close();
  }
}

async function select({ input, output, message, hint, options, formatOption }) {
  const render = (index) => {
    output.write('\x1Bc');
    output.write(`${message}\n`);
    output.write(`${hint}\n`);
    for (let i = 0; i < options.length; i += 1) {
      const marker = i === index ? '>' : ' ';
      output.write(`${marker} ${formatOption(options[i])}\n`);
    }
  };

  return new Promise((resolve) => {
    let index = 0;
    readline.emitKeypressEvents(input);
    input.setRawMode?.(true);
    render(index);

    const onKeypress = (_, key) => {
      if (key.name === 'up') {
        index = (index - 1 + options.length) % options.length;
        render(index);
      } else if (key.name === 'down') {
        index = (index + 1) % options.length;
        render(index);
      } else if (key.name === 'return') {
        cleanup();
        output.write('\n');
        resolve(options[index]);
      }
    };

    const cleanup = () => {
      input.off('keypress', onKeypress);
      input.setRawMode?.(false);
    };

    input.on('keypress', onKeypress);
  });
}

async function multiselect({ input, output, message, hint, options, formatOption }) {
  const selected = new Set();

  const render = (index) => {
    output.write('\x1Bc');
    output.write(`${message}\n`);
    output.write(`${hint}\n`);
    for (let i = 0; i < options.length; i += 1) {
      const active = i === index ? '>' : ' ';
      const checked = selected.has(options[i]) ? 'x' : ' ';
      output.write(`${active} [${checked}] ${formatOption(options[i])}\n`);
    }
  };

  return new Promise((resolve) => {
    let index = 0;
    readline.emitKeypressEvents(input);
    input.setRawMode?.(true);
    render(index);

    const onKeypress = (_, key) => {
      if (key.name === 'up') {
        index = (index - 1 + options.length) % options.length;
        render(index);
      } else if (key.name === 'down') {
        index = (index + 1) % options.length;
        render(index);
      } else if (key.name === 'space') {
        const option = options[index];
        if (selected.has(option)) {
          selected.delete(option);
        } else {
          selected.add(option);
        }
        render(index);
      } else if (key.name === 'return') {
        cleanup();
        output.write('\n');
        resolve(options.filter((option) => selected.has(option)));
      }
    };

    const cleanup = () => {
      input.off('keypress', onKeypress);
      input.setRawMode?.(false);
    };

    input.on('keypress', onKeypress);
  });
}
