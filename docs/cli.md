# CLI Reference

Kitwe provides a command-line interface available as `kitwe` or `tp` (alias).

## Commands Overview

```
kitwe (tp)
├── project   # Manage project registry
├── config    # Manage configuration
└── run       # Execute tests
```

---

## project

Manage the Kitwe project registry.

### project add

Register a project in the Kitwe registry.

```bash
kitwe project add <name> <path> [--force]
```

| Argument | Description |
|----------|-------------|
| `name` | Unique identifier for the project |
| `path` | Path to the project directory |

| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite existing project entry |

**Example:**

```bash
tp project add myapp /Users/me/code/myapp
```

---

### project list

List all registered projects.

```bash
kitwe project list
```

**Output:**

```
Name       Path
---------- ----------------------------------------
myapp      /Users/me/code/myapp
another    /Users/me/code/another

Registry: /Users/me/.kitwe/registry.json
```

---

### project show

Show details for a registered project.

```bash
kitwe project show <name>
```

**Output:**

```
Project: myapp
Path:    /Users/me/code/myapp
Added:   2024-01-15T10:30:00Z

Markers:
  package.json:        ✓
  playwright.config.*: ✓
  kitwe.yaml:      ✓
```

---

### project remove

Remove a project from the registry. Does NOT delete files.

```bash
kitwe project remove <name>
```

---

## config

Manage project configuration.

### config show

Display configuration for a project.

```bash
kitwe config show [options]
```

| Option | Description |
|--------|-------------|
| `--project <name>` | Registered project name |
| `-p, --project-root <path>` | Path to project root |
| `--json` | Output as JSON |

**Example:**

```bash
tp config show --project myapp
tp config show --project-root /path/to/project --json
```

---

### config init

Create a `kitwe.yaml` template.

```bash
kitwe config init [options]
```

| Option | Description |
|--------|-------------|
| `--project <name>` | Registered project name |
| `-p, --project-root <path>` | Path to project root |
| `--force` | Overwrite existing config file |
| `--with-auth` | Include authentication template |

**Example:**

```bash
tp config init --project myapp
tp config init --project myapp --with-auth
```

---

### config validate

Validate `kitwe.yaml` configuration.

```bash
kitwe config validate [options]
```

| Option | Description |
|--------|-------------|
| `--project <name>` | Registered project name |
| `-p, --project-root <path>` | Path to project root |

**Output:**

```
✓ Configuration valid

Warnings:
  - No run.script or run.config_path set - run command will require CLI flags
```

---

## run

Run Playwright tests and return structured results.

```bash
kitwe run [spec-file] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `spec-file` | Optional spec file name or path |

### Options

| Option | Description |
|--------|-------------|
| `--project <name>` | Registered project name |
| `-p, --project-root <path>` | Path to project root |
| `-s, --script <name>` | npm script name (e.g., `test:e2e`) |
| `-c, --config <path>` | Path to Playwright config |
| `-t, --timeout <seconds>` | Maximum execution time (default: 1200) |
| `-a, --artifacts-dir <path>` | Directory to write artifacts |
| `-r, --runner <type>` | Package manager: `npm`, `pnpm`, `yarn`, `npx` |
| `--args <args...>` | Additional arguments to pass to Playwright |
| `-j, --json-out <path>` | Write result JSON to this path |
| `-v, --verbose` | Enable verbose output |
| `-q, --quiet` | Suppress progress output |
| `--skip-setup` | Skip pre_commands |

### Examples

Run all E2E tests:

```bash
tp run --project myapp --script test:e2e
```

Run specific spec file:

```bash
tp run --project myapp auth.spec.ts
```

Run with verbose output and save JSON:

```bash
tp run --project myapp -v -j results.json
```

Run with extended timeout:

```bash
tp run --project myapp --timeout 600
```

Run with additional Playwright args:

```bash
tp run --project myapp --args "--workers=4" "--headed"
```

Skip setup commands:

```bash
tp run --project myapp --skip-setup
```

---

## Global Options

These options are available for all commands:

| Option | Description |
|--------|-------------|
| `-V, --version` | Output version number |
| `-h, --help` | Display help for command |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (invalid args, missing config, etc.) |
| `1` | Tests failed (for `run` command) |
