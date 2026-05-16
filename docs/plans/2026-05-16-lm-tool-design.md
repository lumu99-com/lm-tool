# lm-tool Design

## Goal

Build a cross-platform DevOps CLI tool named `lm` for the lumu99 projects. The tool should support interactive first-time initialization, optional repository cloning, one-command build/update flows for `server`, `web`, and `admin`, and real-time passthrough of original command output.

## Scope

The first version includes:

- `lm init`
- `lm build server`
- `lm build web`
- `lm build admin`
- `lm build`
- `lm help`

The first version will be developed with Node.js and packaged into standalone executables for Windows, macOS, and Linux so end users do not need a local Node.js installation.

## User Experience

### Distribution

Release artifacts:

- Windows: `lm.exe`
- macOS: `lm`
- Linux: `lm`

Users place the binary in a writable directory that is on `PATH`, then run `lm init` before any build command.

### Initialization Flow

`lm init` is the required first step. It writes configuration to a file in the same directory as the `lm` executable.

Initialization steps:

1. Select current platform with arrow keys:
   - `Windows`
   - `macOS`
   - `Linux`
   Prompt text: `使用 ↑/↓ 选择，Enter 确认`
2. Select repository state with arrow keys:
   - `已拉取三个仓库`
   - `拉取了部分仓库`
   - `未拉取仓库`
   Prompt text: `使用 ↑/↓ 选择，Enter 确认`
3. Branch by repository state:

#### Case A: 已拉取三个仓库

- Prompt for the local path of each repository:
  - `server`
  - `web`
  - `admin`
- Validate each directory exists.

#### Case B: 拉取了部分仓库

- Show a multi-select list for the repositories that already exist:
  - `server`
  - `web`
  - `admin`
- Prompt text: `使用 ↑/↓ 移动，Space 勾选/取消，Enter 确认`
- For selected existing repositories:
  - prompt for each repository path
  - validate each directory exists
- For missing repositories:
  - prompt once for the parent directory
  - create it if it does not exist
  - clone missing repositories into that directory

#### Case C: 未拉取仓库

- Prompt once for the parent directory
- Create it if it does not exist
- Clone all three repositories into that directory

### Clone Behavior

Fixed clone URLs:

- `git@github.com:lumu99-com/lumu99-server.git`
- `git@github.com:lumu99-com/lumu-web.git`
- `git@github.com:lumu99-com/lumu-admin.git`

Fixed directory names after clone:

- `lumu99-server`
- `lumu-web`
- `lumu-admin`

If `git clone` fails with a permission-related error, print:

`仓库拉取失败，如无权限请联系 @幻仔`

### Path Handling

Users do not need to worry about slash or backslash differences.

Rules:

- Accept native path input for the current platform
- Accept both `\` and `/` on Windows
- Normalize to absolute paths during `lm init`
- Validate path existence for repos that are claimed to already exist
- Use the resolved path as the process `cwd` when running commands instead of building `cd ...` strings

## Commands

### `lm help`

Shows available commands, initialization requirements, and usage examples. Help text should be generated from a central command registry so future commands stay in sync with help output.

### `lm build server`

Run inside the configured `server` repository directory.

Command flow:

1. `git pull`
2. `mvn clean package -DskipTests`
3. Locate the built versioned jar in `target`, such as `lumu99-server-1.1.8.jar`
4. Copy it to a fixed name: `target/lumu99-server.jar`
5. Restart according to platform:
   - Linux: `systemctl restart lumu99-server`
   - Windows: stop the old `java -jar ...lumu99-server.jar` process, then start `java -jar target/lumu99-server.jar`
   - macOS: stop the old `java -jar ...lumu99-server.jar` process, then start `java -jar target/lumu99-server.jar`
6. Print `server 编译成功` on success

### `lm build web`

Run inside the configured `web` repository directory.

Command flow:

1. `git pull`
2. `npm install`
3. `npm run build`
4. Print `web 编译成功` on success

### `lm build admin`

Run inside the configured `admin` repository directory.

Command flow:

1. `git pull`
2. `npm install`
3. `npm run build`
4. Print `admin 编译成功` on success

### `lm build`

Run the three build commands sequentially in this order:

1. `server`
2. `web`
3. `admin`

Stop immediately on the first failure and report which module and step failed.

## Runtime Behavior

### Output

All short-lived commands must stream original stdout and stderr directly to the current terminal:

- `git pull`
- `mvn clean package -DskipTests`
- `npm install`
- `npm run build`

For Windows and macOS server restarts, the new `java -jar` process is long-running and should not hold the current terminal. Its output should be redirected to:

- `<server>/logs/lm-tool-server.log`

If startup fails, print the log file path and the recent tail of the log to help diagnose the problem.

### Failure Handling

- Any command returning a non-zero exit code aborts the current build flow immediately
- Missing prerequisites such as `git`, `mvn`, `npm`, or `java` should produce explicit error messages
- `lm build` stops at the first failed module
- Running `lm build...` without a config file should print a clear message telling the user to run `lm init` first

### Windows and macOS Server Process Detection

Do not kill all Java processes. Only stop a process whose command line contains the fixed jar name:

- `lumu99-server.jar`

This avoids terminating unrelated Java applications.

After starting the new process, wait briefly and verify it is still alive before reporting success.

## Configuration

Configuration file name:

- `lm.config.json`

Configuration location:

- Same directory as the `lm` executable

Example shape:

```json
{
  "schemaVersion": 1,
  "platform": "linux",
  "projects": {
    "server": "/opt/lumu99/lumu99-server",
    "web": "/opt/lumu99/lumu-web",
    "admin": "/opt/lumu99/lumu-admin"
  },
  "server": {
    "fixedJarName": "lumu99-server.jar",
    "linuxServiceName": "lumu99-server",
    "logFile": "logs/lm-tool-server.log"
  }
}
```

## Architecture

Recommended project structure:

```text
lm-tool/
  package.json
  README.md
  src/
    index.ts
    commands/
      init.ts
      build.ts
      help.ts
    core/
      config.ts
      executor.ts
      platform.ts
      path.ts
      clone.ts
      jar.ts
      server-runtime.ts
      help-registry.ts
    ui/
      prompt.ts
      output.ts
  tests/
    config.test.ts
    path.test.ts
    jar.test.ts
    build-plan.test.ts
    help.test.ts
    init.test.ts
  docs/
    plans/
```

Responsibilities:

- `commands/init.ts`: interactive initialization workflow
- `commands/build.ts`: command dispatch for build flows
- `commands/help.ts`: help output
- `core/config.ts`: config load/save/validate
- `core/executor.ts`: child process execution with streaming output
- `core/path.ts`: path normalization and validation
- `core/clone.ts`: repository clone orchestration
- `core/jar.ts`: locate versioned jar and copy to fixed filename
- `core/server-runtime.ts`: platform-specific server restart logic
- `core/help-registry.ts`: single source of truth for commands/help text
- `ui/prompt.ts`: arrow-key and multiselect prompts

## Testing Strategy

Unit tests:

- config load/save and validation
- path normalization rules
- clone planning logic
- jar discovery and fixed-name copy planning
- command registry and help generation
- build sequence planning and stop-on-failure behavior

Integration-style tests should mock the command executor instead of running real `git`, `mvn`, `npm`, or `java`. These tests verify:

- expected command order
- early abort on failure
- correct platform-specific restart plan
- init flow behavior for full, partial, and missing repo states

## Non-Goals

The first version does not include:

- user-specific custom build command templates
- per-platform path sets stored in a single config
- child help commands such as `lm help build`
- service management frameworks for Windows or macOS

## Open Decisions Closed in This Design

- Tool implementation language: Node.js
- User distribution model: standalone executables
- Config location: same directory as executable
- `web` and `admin` builds also run `git pull`
- Windows and macOS server restart via `java -jar target/lumu99-server.jar`
- `lm init` may optionally clone missing repositories
