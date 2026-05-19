import readline from 'node:readline';

export function createPromptUi({ input = process.stdin, output = process.stdout } = {}) {
  return {
    async selectPlatform() {
      return select({
        input,
        output,
        message: '请选择当前平台',
        hint: '使用上下方向键选择，Enter 确认',
        options: ['windows', 'macos', 'linux'],
        formatOption: formatPlatform,
      });
    },
    async selectRepoState() {
      return select({
        input,
        output,
        message: '请选择仓库状态',
        hint: '使用上下方向键选择，Enter 确认',
        options: ['all', 'partial', 'none'],
        formatOption: formatRepoState,
      });
    },
    async selectExistingRepos(options = ['server', 'web', 'admin']) {
      return multiselect({
        input,
        output,
        message: '哪些仓库已经存在？',
        hint: '使用上下方向键移动，Space 勾选或取消，Enter 确认',
        options,
        formatOption: (option) => option,
      });
    },
    async confirmPathOverwrite(project, configuredPath) {
      const action = await select({
        input,
        output,
        message: `当前已配置 ${project} 路径：${configuredPath}\n是否覆盖该路径配置？`,
        hint: '使用上下方向键选择，Enter 确认',
        options: ['keep', 'overwrite'],
        formatOption: formatPathOverwriteAction,
      });
      return action === 'overwrite';
    },
    async selectSelfUpdateAction() {
      return select({
        input,
        output,
        message: 'lm-tool 有更新，但是 lm-tool 本地仓库存在变更，是否继续更新？',
        hint: '使用上下方向键选择，Enter 确认',
        options: ['restore-and-update', 'skip-update'],
        formatOption: formatSelfUpdateAction,
      });
    },
    async selectEnvExampleUpdateAction(change) {
      return select({
        input,
        output,
        message: [
          `server 项目的 .env.example 检测到已有配置项发生变化：${change.key}`,
          `旧示例值：${formatEnvValue(change.beforeExampleValue)}`,
          `新示例值：${formatEnvValue(change.afterExampleValue)}`,
          `本地 .env 当前值：${formatEnvValue(change.localEnvValue)}`,
          '请选择是否同步更新本地 .env',
        ].join('\n'),
        hint: '使用上下方向键选择，Enter 确认',
        options: ['keep-local', 'update-local'],
        formatOption: formatEnvExampleUpdateAction,
      });
    },
    async selectMysqlInitAction() {
      return select({
        input,
        output,
        message: 'lumu99 数据库已存在，该操作会清空现有数据，是否继续？',
        hint: '使用上下方向键选择，Enter 确认',
        options: ['recreate', 'cancel'],
        formatOption: formatMysqlInitAction,
      });
    },
    async selectMysqlUserRole() {
      return select({
        input,
        output,
        message: '请选择要创建用户的角色',
        hint: '使用上下方向键选择，Enter 确认',
        options: ['ADMIN', 'USER'],
        formatOption: (option) => option,
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
    async inputLmToolPath(defaultValue) {
      return promptText({
        input,
        output,
        message: '请输入 lm-tool 仓库路径',
        hint: '直接回车使用当前 lm-tool 仓库路径，也可以手动修改',
        defaultValue,
      });
    },
    async inputEnvValue(key) {
      return promptText({
        input,
        output,
        message: `请输入 ${key} 的值`,
      });
    },
    async inputCloneParentDir() {
      output.write('请输入项目父目录，不存在会自动创建\n');
      output.write('缺失仓库会自动 clone 到该目录中\n');
      output.write('如果 git clone 提示无权限，请联系 @幻仔\n');
      return promptText({
        input,
        output,
        message: '请输入项目父目录',
      });
    },
    async inputMysqlPort(defaultValue = 3306) {
      return promptText({
        input,
        output,
        message: '请输入本地 MySQL 端口',
        hint: `直接回车使用默认端口 ${defaultValue}`,
        defaultValue: String(defaultValue),
      });
    },
    async inputMysqlUsername(defaultValue = 'root') {
      return promptText({
        input,
        output,
        message: '请输入本地 MySQL 用户名',
        hint: `直接回车使用默认用户名 ${defaultValue}`,
        defaultValue,
      });
    },
    async inputMysqlPassword(defaultValue = '') {
      return promptText({
        input,
        output,
        message: '请输入本地 MySQL 密码',
        hint: '直接回车表示空密码',
        defaultValue,
        defaultValueLabel: defaultValue === '' ? '空密码' : defaultValue,
      });
    },
    async inputMysqlNewUsername() {
      return promptText({
        input,
        output,
        message: '请输入要创建的用户名',
      });
    },
    async inputMysqlNewPassword() {
      return promptText({
        input,
        output,
        message: '请输入要创建的密码',
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

function formatPathOverwriteAction(action) {
  if (action === 'keep') {
    return '保留当前配置，不重新输入';
  }

  return '覆盖当前配置，重新输入';
}

function formatSelfUpdateAction(action) {
  if (action === 'restore-and-update') {
    return '回退本地变更并更新';
  }

  return '跳过更新，继续执行当前命令';
}

function formatMysqlInitAction(action) {
  if (action === 'recreate') {
    return '确认删除并重建';
  }

  return '取消初始化';
}

function formatEnvExampleUpdateAction(action) {
  if (action === 'keep-local') {
    return '保留本地 .env 当前值（推荐）';
  }

  return '把本地值更新为新的 .env.example 值';
}

function formatEnvValue(value) {
  if (value === '') {
    return '（空值）';
  }

  return value;
}

async function promptText({
  input,
  output,
  message,
  hint,
  defaultValue,
  defaultValueLabel,
}) {
  if (hint) {
    output.write(`${hint}\n`);
  }

  const rl = readline.createInterface({ input, output });
  const defaultSuffix = defaultValue !== undefined
    ? `（默认：${defaultValueLabel ?? defaultValue}）`
    : '';

  try {
    return await new Promise((resolve) => {
      rl.question(`${message}${defaultSuffix}: `, (answer) => {
        const trimmed = answer.trim();
        if (trimmed === '' && defaultValue !== undefined) {
          resolve(String(defaultValue));
          return;
        }

        resolve(trimmed);
      });
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
