# lm-tool 自更新与输出规范实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `lm-tool` 增加执行前自更新检查、统一外部命令结束输出，并同步帮助与文档规则。

**Architecture:** 在 CLI 入口前增加一个独立的自更新前置流程模块，负责 git 仓库检测、远端更新判断、脏工作区交互和更新执行。现有执行器负责统一透传 stdout/stderr，并在每个外部命令结束后追加 `[INFO]` 与分隔线。

**Tech Stack:** Node.js ESM、内置 `child_process`、`fs`、`path`

---

### Task 1: 增加自更新前置模块

**Files:**
- Create: `src/core/self-update.js`
- Modify: `src/cli.js`

**Step 1: 定义自更新输入输出结构**

- 明确 `toolDir`
- 明确 `executor`
- 明确 `prompts`
- 明确 `writeLine`
- 明确 `writeStdout` / `writeStderr`

**Step 2: 实现 git 仓库检测与远端领先判断**

- 使用 `git rev-parse --is-inside-work-tree`
- 使用 `git rev-parse --abbrev-ref HEAD`
- 使用 `git rev-parse --abbrev-ref --symbolic-full-name @{u}`
- 使用 `git fetch`
- 使用 `git rev-list --left-right --count HEAD...@{u}`

**Step 3: 实现脏工作区选择流程**

- 使用 `git status --porcelain`
- 若远端领先且本地有变更，使用上下键选择：
  - `回退本地变更并更新`
  - `跳过更新，继续执行当前命令`

**Step 4: 在 CLI 入口接入**

- `help`、`init`、`build`、空命令错误前统一先走自更新检查

**Step 5: 提交**

```bash
git add src/core/self-update.js src/cli.js
git commit -m "feat: add lm-tool self-update preflight"
```

### Task 2: 统一外部命令结束输出

**Files:**
- Modify: `src/core/executor.js`
- Modify: `src/commands/init.js`
- Modify: `src/commands/build.js`
- Modify: `src/core/build-plan.js`

**Step 1: 在执行器增加结束输出**

- 成功时输出 `[INFO] <label> 执行成功`
- 失败时输出 `[INFO] <label> 执行失败`
- 追加 `=======================`

**Step 2: 补充详细中文提示**

- `正在拉取 lm-tool 最新代码`
- `正在拉取 server 仓库最新代码`
- `正在拉取 web 仓库最新代码`
- `正在拉取 admin 仓库最新代码`
- `正在克隆 <project> 仓库到 <path>`

**Step 3: 确保所有外部命令都带 label**

- `git fetch`
- `git pull`
- `git restore`
- `git clone`
- `mvn clean package -DskipTests`
- `npm install`
- `npm run build`
- server 重启相关命令

**Step 4: 提交**

```bash
git add src/core/executor.js src/commands/init.js src/commands/build.js src/core/build-plan.js
git commit -m "feat: standardize external command output"
```

### Task 3: 扩展交互与帮助文档

**Files:**
- Modify: `src/ui/prompt.js`
- Modify: `src/core/help-registry.js`
- Modify: `README.md`
- Create: `AGENTS.md`

**Step 1: 增加自更新冲突选择提示**

- `lm-tool 有更新，但是 lm-tool 本地仓库有变更`
- 选项：
  - `回退本地变更并更新`
  - `跳过更新，继续执行当前命令`

**Step 2: 更新帮助文案**

- 中文说明自更新规则
- 中文说明 build 才更新业务仓库
- 中文说明原始输出和 `[INFO]` 规则

**Step 3: 更新 README 与 AGENTS**

- README 写中文使用教程和行为说明
- AGENTS 固化长期规则

**Step 4: 提交**

```bash
git add src/ui/prompt.js src/core/help-registry.js README.md AGENTS.md
git commit -m "docs: document self-update and output rules"
```

### Task 4: 验证并提交最终结果

**Files:**
- Modify: `docs/plans/2026-05-17-lm-tool-self-update.md`

**Step 1: 运行基础验证**

Run: `npm test`
Expected: exit code `0`

**Step 2: 运行命令冒烟验证**

Run:

```bash
node src/index.js help
node src/index.js
```

Expected:

- `help` 能输出中文帮助
- 空命令能输出 `命令错误，请使用 lm help 查看帮助`

**Step 3: 查看变更并提交**

```bash
git add .
git commit -m "feat: add self-update preflight and output rules"
```
