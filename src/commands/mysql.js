import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const MYSQL_DATABASE = 'lumu99';
const DEFAULT_MYSQL_PORT = 3306;
const DEFAULT_MYSQL_USERNAME = 'root';
const DEFAULT_MYSQL_PASSWORD = '';
const MIGRATION_FILE_PATTERN = /^V(\d+)__.+\.sql$/i;

export function createMysqlCommand(deps) {
  const configStore = deps.configStore;
  const prompts = deps.prompts ?? {};
  const executor = deps.executor;
  const writeLine = deps.writeLine ?? (() => {});
  const writeStdout = deps.writeStdout ?? ((chunk) => process.stdout.write(chunk));
  const writeStderr = deps.writeStderr ?? ((chunk) => process.stderr.write(chunk));
  const readdirImpl = deps.readdirImpl ?? readdir;
  const readFileImpl = deps.readFileImpl ?? readFile;
  const randomUuid = deps.randomUuid ?? randomUUID;
  const randomToken = deps.randomToken ?? (() => randomBytes(12).toString('hex'));

  return {
    async run(target) {
      try {
        if (target === 'summary') {
          return await runSummary();
        }

        if (target === 'init') {
          return await runInit();
        }

        if (target === 'user') {
          return await runUser();
        }

        writeLine(`不支持的 mysql 子命令：${target}`);
        return { exitCode: 1 };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(message);
        return { exitCode: 1 };
      }
    },
  };

  async function runSummary() {
    const config = await loadConfig();
    const mysqlConfig = config?.mysql ?? {};

    writeLine('当前配置文件中的本地 MySQL 配置如下：');
    writeLine(`端口：${formatValue(mysqlConfig.port)}`);
    writeLine(`用户名：${formatValue(mysqlConfig.username)}`);
    writeLine(`密码：${formatPasswordStatus(mysqlConfig.password)}`);
    writeLine('请使用 lm mysql help 命令查看详细帮助。');

    return { exitCode: 0 };
  }

  async function runInit() {
    const { config } = await ensureMysqlConfig();
    const serverDir = config.projects?.server;
    if (!serverDir) {
      throw new Error('server 项目路径未配置，请先执行 lm init');
    }

    const migrationDir = path.join(serverDir, 'src', 'main', 'resources', 'db', 'migration');
    const mysqlConfig = config.mysql;

    const existsResult = await runMysqlSql({
      mysqlConfig,
      label: 'mysql query schema exists',
      infoLabel: '检查 lumu99 数据库是否存在',
      startMessage: '正在检查本地 MySQL 中是否已存在 lumu99 数据库',
      sql: "select schema_name from information_schema.schemata where schema_name = 'lumu99';",
      captureOutput: true,
    });

    if (existsResult.exitCode !== 0) {
      return { exitCode: existsResult.exitCode };
    }

    const schemaExists = existsResult.stdout.trim() === MYSQL_DATABASE;
    if (schemaExists) {
      writeLine('检测到本地 MySQL 中已存在 lumu99 数据库，本次初始化会清空现有数据。');
      const action = await requirePrompt('selectMysqlInitAction')();
      if (action === 'cancel') {
        writeLine('已取消初始化 lumu99 数据库。');
        return { exitCode: 0 };
      }

      const dropResult = await runMysqlSql({
        mysqlConfig,
        label: 'mysql drop schema',
        infoLabel: '删除已有 lumu99 数据库',
        startMessage: '正在删除已有的 lumu99 数据库',
        sql: 'drop schema if exists lumu99;',
      });

      if (dropResult.exitCode !== 0) {
        return { exitCode: dropResult.exitCode };
      }
    }

    const createResult = await runMysqlSql({
      mysqlConfig,
      label: 'mysql create schema',
      infoLabel: '初始化 lumu99 数据库',
      startMessage: '正在创建 lumu99 数据库',
      sql: 'create schema lumu99 collate utf8mb4_unicode_ci;',
    });

    if (createResult.exitCode !== 0) {
      return { exitCode: createResult.exitCode };
    }

    const migrationFiles = await listMigrationFiles(migrationDir);
    for (const migration of migrationFiles) {
      const sql = await readFileImpl(migration.fullPath, 'utf8');
      const result = await runMysqlSql({
        mysqlConfig,
        label: `mysql migrate ${migration.name}`,
        infoLabel: `执行数据库迁移 ${migration.name}`,
        startMessage: `正在执行数据库迁移文件 ${migration.name}`,
        database: MYSQL_DATABASE,
        sql,
      });

      if (result.exitCode !== 0) {
        return { exitCode: result.exitCode };
      }
    }

    writeLine('lumu99 数据库初始化完成。');
    return { exitCode: 0 };
  }

  async function runUser() {
    const { config } = await ensureMysqlConfig();
    const mysqlConfig = config.mysql;
    const username = await promptRequiredValue({
      promptMethod: 'inputMysqlNewUsername',
      emptyMessage: '要创建的用户名不能为空，请重新输入。',
    });
    const password = await promptRequiredValue({
      promptMethod: 'inputMysqlNewPassword',
      emptyMessage: '要创建的密码不能为空，请重新输入。',
    });
    const role = await requirePrompt('selectMysqlUserRole')();
    const passwordHash = await createPasswordHash(password, deps.bcryptApi);

    const sql = buildInsertUserSql({
      userUuid: randomUuid(),
      username,
      weiboUid: `lm-${randomToken()}`,
      weiboLink: `https://local.invalid/weibo/${randomToken()}`,
      tFamilyId: `lm-${randomToken()}`,
      passwordHash,
      role,
    });

    const result = await runMysqlSql({
      mysqlConfig,
      label: 'mysql insert user',
      infoLabel: `创建本地用户 ${username}`,
      startMessage: `正在向 lumu99.users 表创建用户 ${username}`,
      database: MYSQL_DATABASE,
      sql,
    });

    if (result.exitCode !== 0) {
      return { exitCode: result.exitCode };
    }

    writeLine(`本地用户 ${username} 创建完成。`);
    return { exitCode: 0 };
  }

  async function ensureMysqlConfig() {
    const currentConfig = normalizeBaseConfig(await loadConfig());
    const mysqlConfig = currentConfig.mysql ?? {};
    let changed = false;

    const port = isValidPort(mysqlConfig.port)
      ? Number(mysqlConfig.port)
      : await promptMysqlPort();
    changed ||= !isValidPort(mysqlConfig.port);

    const username = hasNonEmptyString(mysqlConfig.username)
      ? mysqlConfig.username
      : await promptMysqlUsername();
    changed ||= !hasNonEmptyString(mysqlConfig.username);

    const password = typeof mysqlConfig.password === 'string'
      ? mysqlConfig.password
      : await promptMysqlPassword();
    changed ||= typeof mysqlConfig.password !== 'string';

    const nextConfig = {
      ...currentConfig,
      mysql: {
        port,
        username,
        password,
      },
    };

    if (changed) {
      if (!configStore?.save) {
        throw new Error('当前环境无法写入 lm.config.json');
      }
      await configStore.save(nextConfig);
    }

    return {
      config: nextConfig,
      changed,
    };
  }

  async function promptMysqlPort() {
    const prompt = requirePrompt('inputMysqlPort');
    while (true) {
      const answer = normalizeString(await prompt(DEFAULT_MYSQL_PORT));
      const port = Number(answer);
      if (isValidPort(port)) {
        return port;
      }

      writeLine('本地 MySQL 端口必须是 1 到 65535 之间的整数，请重新输入。');
    }
  }

  async function promptMysqlUsername() {
    const prompt = requirePrompt('inputMysqlUsername');
    while (true) {
      const answer = normalizeString(await prompt(DEFAULT_MYSQL_USERNAME));
      if (answer !== '') {
        return answer;
      }

      writeLine('本地 MySQL 用户名不能为空，请重新输入。');
    }
  }

  async function promptMysqlPassword() {
    const prompt = requirePrompt('inputMysqlPassword');
    const answer = await prompt(DEFAULT_MYSQL_PASSWORD);
    return normalizeString(answer);
  }

  async function promptRequiredValue({ promptMethod, emptyMessage }) {
    const prompt = requirePrompt(promptMethod);
    while (true) {
      const answer = normalizeString(await prompt());
      if (answer !== '') {
        return answer;
      }

      writeLine(emptyMessage);
    }
  }

  async function runMysqlSql({
    mysqlConfig,
    label,
    infoLabel,
    startMessage,
    sql,
    database,
    captureOutput = false,
  }) {
    if (!executor?.run) {
      throw new Error('当前环境无法执行 mysql 命令');
    }

    return executor.run({
      label,
      infoLabel,
      startMessage,
      command: 'mysql',
      args: buildMysqlArgs({ mysqlConfig, database, captureOutput }),
      cwd: process.cwd(),
      captureOutput,
      stdinText: sql,
      writeLine,
      onStdout: writeStdout,
      onStderr: writeStderr,
    });
  }

  async function listMigrationFiles(migrationDir) {
    let entries;
    try {
      entries = await readdirImpl(migrationDir);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`server 项目迁移目录不存在：${migrationDir}`);
      }

      throw error;
    }

    return entries
      .map((entry) => parseMigrationFileName(entry, migrationDir))
      .filter(Boolean)
      .sort((left, right) => left.version - right.version || left.name.localeCompare(right.name));
  }

  async function loadConfig() {
    return configStore?.load ? configStore.load() : null;
  }

  function requirePrompt(methodName) {
    const prompt = prompts?.[methodName];
    if (typeof prompt !== 'function') {
      throw new Error(`当前环境缺少交互方法：${methodName}`);
    }

    return prompt;
  }
}

function buildMysqlArgs({ mysqlConfig, database, captureOutput }) {
  const args = [
    '--host=127.0.0.1',
    '--protocol=TCP',
    `--port=${mysqlConfig.port}`,
    `--user=${mysqlConfig.username}`,
  ];

  if (mysqlConfig.password !== '') {
    args.push(`--password=${mysqlConfig.password}`);
  }

  if (captureOutput) {
    args.push('--batch', '--skip-column-names');
  }

  if (database) {
    args.push(database);
  }

  return args;
}

function parseMigrationFileName(fileName, migrationDir) {
  const match = MIGRATION_FILE_PATTERN.exec(fileName);
  if (!match) {
    return null;
  }

  return {
    name: fileName,
    version: Number(match[1]),
    fullPath: path.join(migrationDir, fileName),
  };
}

function normalizeBaseConfig(config) {
  if (!config || typeof config !== 'object') {
    return { schemaVersion: 1 };
  }

  return { ...config };
}

function isValidPort(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 65535;
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') {
    return '未配置';
  }

  return String(value);
}

function formatPasswordStatus(value) {
  if (typeof value !== 'string') {
    return '未配置';
  }

  if (value === '') {
    return '空密码';
  }

  return '已设置密码';
}

async function createPasswordHash(password, injectedBcryptApi) {
  const bcryptApi = injectedBcryptApi ?? await loadBcryptApi();
  const salt = bcryptApi.genSaltSync(10);
  const hash = bcryptApi.hashSync(password, salt);
  return normalizeBcryptVersion(hash);
}

async function loadBcryptApi() {
  try {
    const module = await import('bcryptjs');
    return module.default ?? module;
  } catch {
    throw new Error('缺少 bcryptjs 依赖，请先执行 npm install');
  }
}

function normalizeBcryptVersion(hash) {
  if (typeof hash !== 'string') {
    return hash;
  }

  if (hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return `$2a$${hash.slice(4)}`;
  }

  return hash;
}

function buildInsertUserSql({
  userUuid,
  username,
  weiboUid,
  weiboLink,
  tFamilyId,
  passwordHash,
  role,
}) {
  return [
    'insert into users (',
    '  user_uuid,',
    '  username,',
    '  email,',
    '  weibo_uid,',
    '  weibo_link,',
    '  t_family_id,',
    '  registration_video_file_key,',
    '  password_hash,',
    '  role,',
    '  registration_reject_reason,',
    '  registration_claimed_by,',
    '  registration_claim_expires_at,',
    '  registration_reviewed_by,',
    '  registration_reviewed_at',
    ') values (',
    `  ${escapeSqlString(userUuid)},`,
    `  ${escapeSqlString(username)},`,
    '  null,',
    `  ${escapeSqlString(weiboUid)},`,
    `  ${escapeSqlString(weiboLink)},`,
    `  ${escapeSqlString(tFamilyId)},`,
    '  null,',
    `  ${escapeSqlString(passwordHash)},`,
    `  ${escapeSqlString(role)},`,
    '  null,',
    '  null,',
    '  null,',
    '  null,',
    '  null',
    ');',
  ].join('\n');
}

function escapeSqlString(value) {
  const normalized = String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "''");
  return `'${normalized}'`;
}
