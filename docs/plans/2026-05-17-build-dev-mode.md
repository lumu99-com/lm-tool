# Frontend Build Dev Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `lm build web/admin` use `npm run build` on Linux but launch visible `npm run dev` terminal windows on Windows and macOS.

**Architecture:** Keep platform branching in `src/core/build-plan.js` using `config.platform`, then teach `src/commands/build.js` how to execute a new frontend-dev-window step. Linux remains synchronous build-only; Windows/macOS frontends become window-launch steps that return after successfully opening a visible terminal running `npm run dev`.

**Tech Stack:** Node.js ESM, built-in `node:test`, PowerShell, AppleScript via `osascript`, existing executor/build pipeline.

---

### Task 1: 为 build plan 写失败测试

**Files:**
- Modify: `src/core/build-plan.test.js`
- Modify: `src/core/build-plan.js`

**Step 1: Write the failing test**

在 `src/core/build-plan.test.js` 增加断言：

- Linux 的 `lm build web` 仍然包含 `npm run build`
- Windows 的 `lm build web` 不再包含 `npm run build`，而是包含新的前端 dev 窗口步骤
- macOS 的 `lm build admin` 同样包含前端 dev 窗口步骤

**Step 2: Run test to verify it fails**

Run:

```bash
node --test src/core/build-plan.test.js
```

Expected: FAIL because the current build plan always emits `npm run build` for `web` and `admin`.

**Step 3: Write minimal implementation**

- 在 `createBuildPlan()` 中读取 `config.platform`
- 为 `web` / `admin` 生成 Linux build 步骤或 Windows/macOS dev 窗口步骤

**Step 4: Run test to verify it passes**

Run:

```bash
node --test src/core/build-plan.test.js
```

Expected: PASS

### Task 2: 为 build command 写失败测试

**Files:**
- Modify: `src/commands/build.test.js`
- Modify: `src/commands/build.js`

**Step 1: Write the failing test**

在 `src/commands/build.test.js` 增加断言：

- Windows 的 `lm build web` 执行 `git pull`、`npm install`、启动 dev 窗口，不执行 `npm run build`
- Windows/macOS 的 `lm build all` 在 `server` 成功后继续为 `web` 和 `admin` 启动 dev 窗口

**Step 2: Run test to verify it fails**

Run:

```bash
node --test src/commands/build.test.js
```

Expected: FAIL because `build.js` 还不支持新的 step kind。

**Step 3: Write minimal implementation**

- 在 `runStep()` 中新增前端 dev 窗口分支
- 通过 `executor.run()` 执行窗口启动命令
- 成功后输出当前命令已有的 `[INFO] ...` 与分隔线

**Step 4: Run test to verify it passes**

Run:

```bash
node --test src/commands/build.test.js
```

Expected: PASS

### Task 3: 处理窗口启动命令细节

**Files:**
- Modify: `src/commands/build.js`

**Step 1: Write the failing test**

如果 Task 2 已经覆盖命令参数，则直接复用；否则补充最小断言：

- Windows 使用 `powershell.exe`
- macOS 使用 `osascript`
- 启动命令包含 `npm run dev`

**Step 2: Run test to verify it fails**

Run:

```bash
node --test src/commands/build.test.js
```

Expected: FAIL with wrong command/args until platform-specific launcher is implemented.

**Step 3: Write minimal implementation**

- 为 Windows 构建 `Start-Process powershell.exe` 命令
- 为 macOS 构建 `osascript` 命令
- 统一由新 step 携带 `platform`、`projectDir`、`project`

**Step 4: Run test to verify it passes**

Run:

```bash
node --test src/commands/build.test.js
```

Expected: PASS

### Task 4: 更新 README

**Files:**
- Modify: `README.md`

**Step 1: Update docs**

- 说明 Linux 与 Windows/macOS 的前端 `build` 差异
- 说明 Windows/macOS 会打开新终端窗口执行 `npm run dev`
- 说明关闭该窗口即可停止 dev 服务

### Task 5: 聚焦验证与全量验证

**Files:**
- Test: `src/core/build-plan.test.js`
- Test: `src/commands/build.test.js`

**Step 1: Run the focused tests**

Run:

```bash
node --test src/core/build-plan.test.js src/commands/build.test.js
```

Expected: PASS

**Step 2: Run the full suite**

Run:

```bash
npm test
```

Expected: PASS

**Step 3: Commit**

```bash
git add docs/plans/2026-05-17-build-dev-mode-design.md docs/plans/2026-05-17-build-dev-mode.md src/core/build-plan.js src/core/build-plan.test.js src/commands/build.js src/commands/build.test.js README.md
git commit -m "feat: start frontend dev windows on local build"
```
