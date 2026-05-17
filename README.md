# lm-tool

`lm-tool` is a DevOps CLI for the lumu99 projects.

Current commands:

- `lm init`
- `lm build server`
- `lm build web`
- `lm build admin`
- `lm build`
- `lm help`

## Direct `lm` command

If you want to type `lm build` directly, run this once:

```bash
npm run setup:global
```

On Windows, this does two things:

- runs `npm link`
- disables npm's generated `lm.ps1` shim so PowerShell falls back to `lm.cmd`

After that you can run:

```bash
lm help
lm init
lm build
```

## Run from source

```bash
node src/index.js help
node src/index.js init
node src/index.js build server
node src/index.js build
```

You can also use:

```bash
npm start -- help
```

## Initialization

Run `lm init` first.

The init flow will:

- let you choose the current platform with arrow keys
- let you choose whether all, some, or none of the repositories already exist
- ask for local repository paths for existing repositories
- ask for a parent directory and clone missing repositories
- save `lm.config.json`

If repository clone permissions are missing, the tool prints:

`仓库拉取失败，如无权限请联系 @幻仔`

## Build behavior

`lm build server`:

- `git pull`
- `mvn clean package -DskipTests`
- locate the versioned server jar in `target`
- copy it to `target/lumu99-server.jar`
- restart the server

`lm build web` and `lm build admin`:

- `git pull`
- `npm install`
- `npm run build`

`lm build` runs:

1. `server`
2. `web`
3. `admin`

The tool streams the original command output to the terminal and stops on the first failure.

## Config file location

`lm.config.json` is stored beside the invoked CLI entry.

When you run from source with `node src/index.js`, that means it is written beside `src/index.js`.

## Packaging status

The current repository is wired for source execution.

Standalone executable packaging for Windows, macOS, and Linux still needs a verified packager workflow in this environment.
