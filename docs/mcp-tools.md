# MCP Tools Reference

Kitwe's primary interface for AI agents is the MCP server.

## Installation

First, install Kitwe globally:

```bash
npm install -g @mwalek/kitwe
```

Then configure your AI tool below.

---

## Setup by Tool

### VS Code with Copilot

Add to your VS Code settings (JSON):

```json
{
  "mcp": {
    "servers": {
      "kitwe": {
        "command": "kitwe-mcp"
      }
    }
  }
}
```

Or via CLI:

```bash
code --add-mcp '{"name":"kitwe","command":"kitwe-mcp"}'
```

---

### Claude Desktop

Add to your Claude Desktop config:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kitwe": {
      "command": "kitwe-mcp"
    }
  }
}
```

---

### Claude Code

Run in your terminal:

```bash
claude mcp add --transport stdio kitwe -- kitwe-mcp
```

To share with your team (creates `.mcp.json`):

```bash
claude mcp add --transport stdio kitwe --scope project -- kitwe-mcp
```

---

### Cursor

Open **Cursor Settings** → **MCP** → **Add new MCP server**

- **Name**: `kitwe`
- **Type**: `command`
- **Command**: `kitwe-mcp`

Or add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "kitwe": {
      "command": "kitwe-mcp"
    }
  }
}
```

---

### Windsurf

Open **Windsurf Settings** → **Cascade** → **MCP Servers** → **Add Server** → **Add custom server**

```json
{
  "mcpServers": {
    "kitwe": {
      "command": "kitwe-mcp"
    }
  }
}
```

---

### Codex (OpenAI)

Run in your terminal:

```bash
codex mcp add kitwe -- kitwe-mcp
```

Or add to `~/.codex/config.toml`:

```toml
[mcp_servers.kitwe]
command = "kitwe-mcp"
```

---

### Using npx (without global install)

If you prefer not to install globally, use `npx`:

```json
{
  "mcpServers": {
    "kitwe": {
      "command": "npx",
      "args": ["-y", "-p", "@mwalek/kitwe", "kitwe-mcp"]
    }
  }
}
```

For Claude Code:

```bash
claude mcp add --transport stdio kitwe -- npx -y -p @mwalek/kitwe kitwe-mcp
```

---

## Tools Overview

| Category | Tools |
|----------|-------|
| Registry | `list_projects`, `get_project_root` |
| Context | `get_project_context` |
| Config | `read_config`, `get_config_file_path` |
| Auth | `list_auth_profiles`, `resolve_auth_profile` |
| Execution | `run_tests` |
| Artifacts | `list_artifacts`, `list_test_artifacts`, `collect_test_artifacts`, `read_artifact_file` |

---

## Project Registry Tools

### list_projects

List all registered Kitwe projects.

**Parameters:** None

**Returns:**

```json
{
  "myapp": "/path/to/myapp",
  "another": "/path/to/another"
}
```

---

### get_project_root

Get the root path for a registered project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_name` | string | Yes | Name of the registered project |

**Returns:**

```json
{
  "path": "/path/to/project",
  "exists": true
}
```

**Error Response:**

```json
{
  "error": "Project 'unknown' not found in registry",
  "available_projects": ["myapp", "another"]
}
```

---

## Context Tools

### get_project_context

**Recommended first call when working with a project.**

Get complete Kitwe context. Returns AI-readable markdown with configuration, usage examples, and capabilities.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project` | string | Yes | Project name (from registry) or path to project root |

**Returns:**

```json
{
  "context": "# Kitwe Project Context\n\n...",
  "can_run_tests": true,
  "project_name": "myapp"
}
```

**Notes:**

- Accepts either a registered project name or an absolute path
- The `context` field contains comprehensive markdown for the AI agent
- `can_run_tests` indicates whether `run.script` or `run.config_path` is configured

---

## Configuration Tools

### read_config

Parse and return `kitwe.yaml` configuration.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_root` | string | Yes | Path to the project root directory |

**Returns:** Full `KitweConfig` object

**Error Response:**

```json
{
  "error": "Failed to load config from /path: reason",
  "path": "/path/to/project"
}
```

---

### get_config_file_path

Get the path to `kitwe.yaml`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_root` | string | Yes | Path to the project root directory |

**Returns:**

```json
{
  "path": "/path/to/project/kitwe.yaml",
  "exists": true
}
```

---

## Authentication Tools

### list_auth_profiles

List available authentication profiles.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_root` | string | Yes | Path to the project root directory |

**Returns:**

```json
{
  "default": { "strategy": "login_in_test", "credentials": {...} },
  "profiles": ["admin", "subscriber"]
}
```

---

### resolve_auth_profile

Resolve authentication configuration for a specific profile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_root` | string | Yes | Path to the project root directory |
| `profile` | string | No | Name of auth profile. Defaults to `default`. |

**Returns:**

```json
{
  "strategy": "login_in_test",
  "credentials": {
    "email": "test@example.com",
    "password": "secret123"
  }
}
```

---

## Test Execution Tools

### run_tests

Run Playwright tests and return results with artifacts.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `project_root` | string | Yes | - | Path to the project root directory |
| `artifacts_dir` | string | No | `<project>/artifacts/kitwe` | Where to save logs and reports |
| `timeout_seconds` | number | No | `300` | Maximum execution time |
| `script` | string | No | - | npm script name (e.g., `test:e2e`) |
| `config_path` | string | No | - | Path to playwright config |
| `spec_file` | string | No | - | Specific test file to run |
| `skip_setup` | boolean | No | `false` | Skip pre_commands from config |

**Returns:**

```json
{
  "status": "passed",
  "exitCode": 0,
  "stdout": "...",
  "stderr": "",
  "durationMs": 45230,
  "artifacts": [
    { "type": "trace", "path": "/path/trace.zip", "name": "trace.zip", "size": 12345 }
  ],
  "command": ["npm", "run", "test:e2e", "--", "--reporter=list"],
  "error": null
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `passed` | Tests completed with exit code 0 |
| `failed` | Tests completed with non-zero exit code |
| `error` | Execution error (command failed to run) |
| `timeout` | Execution exceeded timeout |

---

## Artifact Tools

### list_artifacts

List available artifacts for a test.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_root` | string | Yes | Path to the project root directory |
| `test_name` | string | Yes | Name of the test |

**Returns:**

```json
{
  "base_dir": "/path/artifacts/kitwe",
  "test_dir": "/path/artifacts/kitwe/test-name",
  "spec": "/path/to/spec.ts",
  "logs": "/path/artifacts/kitwe/logs",
  "existing": { "base_dir": true, "test_dir": true, "logs": true }
}
```

---

### list_test_artifacts

List all tests that have artifacts.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_root` | string | Yes | Path to the project root directory |

**Returns:**

```json
{
  "base_dir": "/path/artifacts/kitwe",
  "tests": ["auth-login", "checkout-flow", "admin-dashboard"],
  "count": 3
}
```

---

### collect_test_artifacts

Collect artifacts from Playwright output directories.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_root` | string | Yes | Path to the project root directory |

**Returns:**

```json
{
  "search_dirs": ["test-results", "playwright-report"],
  "artifacts": [
    { "type": "screenshot", "name": "login-error.png", "path": "/full/path", "size": 45678 },
    { "type": "trace", "name": "trace.zip", "path": "/full/path", "size": 123456 }
  ],
  "count": 2
}
```

**Artifact Types:**

| Type | Extensions |
|------|------------|
| `screenshot` | `.png`, `.jpg`, `.jpeg` |
| `trace` | `.zip` (containing "trace") |
| `video` | `.webm`, `.mp4` |
| `report` | `.html`, `.json` (containing "report") |

---

### read_artifact_file

Read the contents of an artifact file.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `artifact_path` | string | Yes | - | Path to the artifact file |
| `max_lines` | number | No | `500` | Maximum lines to return |

**Returns:**

```json
{
  "path": "/path/to/file",
  "exists": true,
  "content": "file contents here...",
  "lines": 150,
  "total_lines": 150,
  "truncated": false
}
```

---

## Typical Agent Workflow

1. **Get context first:**
   ```
   get_project_context(project="myapp")
   ```

2. **Run tests:**
   ```
   run_tests(project_root="/path/to/myapp")
   ```

3. **On failure, investigate artifacts:**
   ```
   collect_test_artifacts(project_root="/path/to/myapp")
   read_artifact_file(artifact_path="/path/to/trace.zip")
   ```

4. **Check auth if needed:**
   ```
   list_auth_profiles(project_root="/path/to/myapp")
   resolve_auth_profile(project_root="/path/to/myapp", profile="admin")
   ```
