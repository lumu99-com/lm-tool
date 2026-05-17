# lm mysql 命令设计

## 背景

当前 `lm-tool` 已经支持 `init`、`build`、`check`、`update` 等命令，但本地 MySQL 初始化和本地测试账号创建仍然依赖人工执行 SQL。为了让本地环境准备流程收敛到 `lm` 命令内，需要新增一组围绕 MySQL 的子命令，统一完成连接配置、库初始化、迁移执行和用户创建。

## 目标

- 新增顶层命令 `lm mysql`，用于查看当前配置中的本地 MySQL 连接信息，并引导用户查看帮助。
- 新增 `lm mysql init`，用于初始化本地 `lumu99` 数据库，并逐个执行后端迁移脚本。
- 新增 `lm mysql user`，用于向 `lumu99.users` 表插入一个本地测试用户。
- MySQL 连接信息在配置文件缺失或不完整时通过交互补录，并写回 `lm.config.json`。
- 所有外部命令仍然通过现有执行器实时透传原始 `stdout` / `stderr`，并在结束后输出 `[INFO] ...` 与 `=======================`。
- 所有提示文案保持详细中文，明确说明动作、对象和默认值。

## 非目标

- 不改造 `lm init` 流程，不把 MySQL 账号信息前置到初始化命令里。
- 不引入数据库连接池或长期驻留的数据库客户端。
- 不在 `lm mysql user` 中扩展邮箱、状态等更多用户字段输入。

## 命令行为

### `lm mysql`

- 读取 `lm.config.json` 中的 `mysql` 配置。
- 输出端口、用户名、密码状态：
  - 未配置
  - 空密码
  - 已设置密码
- 额外输出提示：`请使用 lm mysql help 查看详细帮助。`

### `lm mysql help`

- 展示 `lm mysql`、`lm mysql init`、`lm mysql user`、`lm mysql help` 的帮助说明。
- 顶层 `lm help` 也要同步出现 `lm mysql` 入口。

### `lm mysql init`

- 先确保本地 MySQL 连接配置完整，不完整时交互补录并保存：
  - 端口：默认 `3306`
  - 用户名：默认 `root`
  - 密码：默认空字符串，提示“直接回车表示空密码”
- 使用配置中的 `projects.server` 路径定位迁移目录：`src/main/resources/db/migration`。
- 若缺失 `projects.server`，直接报错退出。
- 通过 MySQL 查询 `lumu99` 是否已存在：
  - 不存在：直接创建库并执行迁移
  - 已存在：提示“`lumu99` 数据库已存在，该操作会清空现有数据”，并通过上下键让用户选择“确认删除并重建”或“取消初始化”
- 初始化 SQL 固定为：

```sql
create schema lumu99 collate utf8mb4_unicode_ci;
```

- 迁移文件按版本号升序逐个执行，来源仅限 `V<number>__*.sql`。

### `lm mysql user`

- 同样先确保本地 MySQL 配置完整并保存。
- 交互获取：
  - 用户名
  - 密码（明文可见）
  - 角色，通过上下键选择 `ADMIN` / `USER`
- 密码使用 `bcrypt` 生成版本 `2a`、cost `10` 的哈希。
- 插入 `users` 表时：
  - `user_uuid`、`weibo_uid`、`weibo_link`、`t_family_id` 生成随机值
  - 允许为 `null` 的字段写 `null`
  - `status`、`mute_status`、时间字段交给数据库默认值处理

## 配置结构

在 `lm.config.json` 根对象新增：

```json
{
  "mysql": {
    "port": 3306,
    "username": "root",
    "password": ""
  }
}
```

约束如下：

- 若配置文件不存在，`lm mysql init` / `lm mysql user` 可以创建最小配置文件。
- 保存时保留已有字段，不覆盖 `projects`、`server`、`selfUpdate` 等其他配置。
- `port` 保存为数字，`username` 和 `password` 保存为字符串。

## 实现方案

### 连接与命令执行

- 数据库操作统一复用外部 `mysql` 命令，以保持输出透传与现有执行器一致。
- 为了避免在命令参数中直接拼接大段 SQL，执行器增加 `stdinText` 能力，允许把 SQL 通过标准输入传给 `mysql` 客户端。
- 需要查询结果时，继续复用执行器的 `captureOutput` 能力。

### 密码哈希

- 新增轻量依赖 `bcryptjs`。
- 通过 `genSaltSync(10)` 与 `hashSync(password, salt)` 生成哈希，再把前缀从 `$2b$` 规范化为 `$2a$`，满足后端要求。

### 迁移执行

- 在命令层读取迁移目录文件列表。
- 过滤出 `V<number>__*.sql`，按数字版本排序。
- 每个文件单独调用一次 `mysql lumu99`，并把文件内容写入标准输入。
- 任何一个迁移失败都立刻终止后续步骤。

## 受影响模块

- `src/cli.js`
  - 新增 `mysql` 顶层路由
- `src/core/help-registry.js`
  - 新增 `mysql` 帮助域与顶层命令入口
- `src/ui/prompt.js`
  - 新增 MySQL 配置、库重建确认、用户角色选择等交互
- `src/core/executor.js`
  - 增加可选的 `stdinText`
- `src/commands/mysql.js`
  - 新增 mysql 命令实现
- `README.md`
  - 新增命令与行为说明
- `package.json`
  - 新增 `bcryptjs`

## 测试策略

- `src/cli.test.js`
  - 覆盖 `lm mysql`、`lm mysql help`、`lm mysql init`、`lm mysql user` 的路由
- `src/core/help-registry.test.js`
  - 覆盖顶层帮助与 `mysql` 子帮助
- `src/ui/prompt.test.js`
  - 覆盖带默认值的输入和角色选择方法暴露
- `src/commands/mysql.test.js`
  - 覆盖：
    - 配置缺失时的补录与保存
    - `lumu99` 已存在时的确认分支
    - 迁移排序与逐个执行
    - 取消初始化
    - 用户插入 SQL 与角色选择
    - bcrypt 哈希前缀为 `$2a$`
