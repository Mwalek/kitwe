# Kitwe

> **Kitwe helps AI agents understand your test suite.**

Kitwe is **deterministic infrastructure** for AI coding agents. It provides the context and execution environment they need to create Playwright tests that actually work.

## The Problem

When AI coding agents (Claude, Cursor, Copilot) write Playwright tests, they often fail because:

- **They don't understand your project setup** — auth flows, environment config, test structure
- **They don't know how to run tests** — which npm script, what pre-commands to run
- **They can't analyze failures** — traces are zipped, screenshots are scattered, errors are unparsed
- **They can't do pre-test setup** — database reset, seeding, starting servers

## The Solution

| Capability | What Kitwe Does |
|------------|---------------------|
| **Project Context** | Translates your `kitwe.yaml` into AI-readable markdown |
| **Test Execution** | Runs tests with structured JSON output (pass/fail, artifact paths) |
| **Artifact Management** | Collects screenshots, traces, and logs with organized paths |
| **Environment Prep** | Runs your pre-test commands (DB reset, seeding, servers) |

Kitwe doesn't generate tests or fix them — that's the AI agent's job. Kitwe provides the information and infrastructure to do it well.

---

## Quick Start

### 1. Install Kitwe

```bash
npm install -g kitwe
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kitwe": {
      "command": "kitwe-mcp",
      "args": []
    }
  }
}
```

### 3. Register Your Project

```bash
kitwe project add my-app /path/to/my-app
```

### 4. Add Configuration

Create `kitwe.yaml` in your project root:

```yaml
version: 1

run:
  script: test:e2e

auth:
  default:
    strategy: login_in_test
    credentials:
      email: E2E_TEST_EMAIL
      password: E2E_TEST_PASSWORD
```

### 5. Your AI Assistant Now Understands Your Tests

Claude can now use Kitwe's MCP tools to:
- Get full project context with `get_project_context`
- Run tests with `run_tests`
- Analyze failures with artifact tools

---

## Configuration Reference

### Minimal Configuration

```yaml
version: 1

run:
  script: test:e2e
```

### Full Configuration

```yaml
version: 1

project:
  name: my-project
  env_file: .env.test
  base_url: $PLAYWRIGHT_BASE_URL    # Supports $VAR and ${VAR} syntax

setup:
  pre_commands:
    - argv: ["npm", "run", "db:reset"]
    - argv: ["npm", "run", "db:seed"]

run:
  script: test:e2e                  # OR config_path: playwright.config.ts
  runner: npm                       # npm | pnpm | yarn | npx (auto-detected)
  timeout_seconds: 1200
  artifacts_dir: test-results
  args: ["--workers=4"]
  env:
    CI: "true"

tests:
  language: typescript
  test_dir: e2e
  pattern: "**/*.spec.ts"

auth:
  env_file: .env.test
  default:
    strategy: login_in_test         # no_auth | login_in_test | login_before_test
    credentials:
      email: E2E_TEST_EMAIL
      password: E2E_TEST_PASSWORD
  profiles:
    admin:
      strategy: login_in_test
      credentials:
        email: E2E_ADMIN_EMAIL
        password: E2E_ADMIN_PASSWORD
```

### Configuration Sections

| Section | Purpose |
|---------|---------|
| `project` | Project metadata: name, base URL, env file |
| `setup` | Shared pre-commands (runs before all phases) |
| `run` | Test execution: script, timeout, artifacts directory |
| `tests` | Test structure: directory, patterns, language |
| `auth` | Authentication profiles with credentials (env var names) |

### Authentication Strategies

| Strategy | Behavior |
|----------|----------|
| `no_auth` | No authentication needed |
| `login_in_test` | Login steps are included in the generated test file |
| `login_before_test` | AI logs in via browser before test; test assumes authenticated |

---

## CLI Commands

The CLI is available as `kitwe` or `tp` (alias).

### Project Registry

```bash
# Register a project
kitwe project add myapp /path/to/project

# List all registered projects
kitwe project list

# Show project details
kitwe project show myapp

# Remove a project (doesn't delete files)
kitwe project remove myapp
```

### Configuration

```bash
# Show current config
kitwe config show --project myapp

# Create a new config file
kitwe config init --project myapp

# Create config with auth templates
kitwe config init --project myapp --with-auth

# Validate config file
kitwe config validate --project myapp
```

### Test Execution

```bash
# Run using config defaults
kitwe run --project myapp

# Run specific npm script
kitwe run --project myapp --script test:e2e

# Run specific test file
kitwe run --project myapp auth.spec.ts

# Full options
kitwe run --project myapp \
  --script test:e2e \
  --timeout 600 \
  --artifacts-dir ./custom-artifacts \
  --verbose \
  --json-out results.json
```

#### Run Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--project <name>` | - | Registered project name |
| `--project-root <path>` | `-p` | Path to project root |
| `--script <name>` | `-s` | npm script to run |
| `--config <path>` | `-c` | Playwright config path |
| `--timeout <seconds>` | `-t` | Max execution time (default: 1200) |
| `--artifacts-dir <path>` | `-a` | Artifacts output directory |
| `--runner <type>` | `-r` | Package manager: npm, pnpm, yarn, npx |
| `--json-out <path>` | `-j` | Write result JSON to file |
| `--verbose` | `-v` | Enable verbose output |
| `--skip-setup` | - | Skip pre_commands |

---

## MCP Server Tools

The MCP server is the primary interface for AI agents.

### Project & Context

| Tool | Purpose |
|------|---------|
| `list_projects` | List all registered projects |
| `get_project_root` | Get project path by name |
| `get_project_context` | **Recommended first call** - Get full AI-readable project context |
| `read_config` | Get raw kitwe.yaml contents |
| `get_config_file_path` | Get path to config file |

### Authentication

| Tool | Purpose |
|------|---------|
| `list_auth_profiles` | List available auth profiles |
| `resolve_auth_profile` | Get credentials for a specific profile |

### Test Execution

| Tool | Purpose |
|------|---------|
| `run_tests` | Run Playwright tests, return structured results |

**Parameters**: `project_root`, `artifacts_dir?`, `timeout_seconds?`, `script?`, `config_path?`, `spec_file?`, `skip_setup?`

**Returns**:
```json
{
  "status": "passed|failed|error|timeout",
  "exitCode": 0,
  "stdout": "...",
  "stderr": "...",
  "durationMs": 45230,
  "artifacts": [
    { "type": "screenshot", "path": "...", "name": "failure.png", "size": 123456 },
    { "type": "trace", "path": "...", "name": "trace.zip", "size": 789012 }
  ],
  "command": ["npm", "run", "test:e2e"],
  "error": null
}
```

### Artifacts

| Tool | Purpose |
|------|---------|
| `list_artifacts` | List artifact paths for a test |
| `list_test_artifacts` | List all tests that have artifacts |
| `collect_test_artifacts` | Collect artifacts from Playwright output dirs |
| `read_artifact_file` | Read artifact file contents |

---

## Architecture

```
AI Coding Agent (Claude, Cursor, etc.)
         │
         │ MCP Protocol
         ▼
    ┌─────────────────────────────────────┐
    │           Kitwe                 │
    │                                     │
    │  ┌───────────┐  ┌───────────────┐   │
    │  │   MCP     │  │     CLI       │   │
    │  │  Server   │  │  (kitwe)  │   │
    │  └─────┬─────┘  └───────┬───────┘   │
    │        │                │           │
    │        ▼                ▼           │
    │  ┌─────────────────────────────┐    │
    │  │        Core Layer           │    │
    │  │  Registry │ Config │ Paths  │    │
    │  │  Artifacts │ Context        │    │
    │  └─────────────────────────────┘    │
    │                                     │
    │         kitwe.yaml              │
    └─────────────────────────────────────┘
         │
         ▼
    Your Project (Playwright tests, DB, app)
```

### Design Principles

1. **Deterministic Execution** — Same input always produces same output. No AI reasoning inside Kitwe.
2. **Explicit Configuration** — No auto-detection of test files. Requires `run.script` or `run.config_path`.
3. **Structured Output** — All results are JSON for reliable AI parsing.
4. **AI Agent Ownership** — Kitwe is infrastructure; the AI agent owns the workflow.

### Project Structure

```
kitwe-node/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── mcp-server.ts       # MCP server entry point
│   ├── commands/           # CLI command handlers
│   ├── core/               # Core infrastructure
│   │   ├── registry.ts     # Project registry
│   │   ├── config.ts       # Configuration loading
│   │   ├── artifacts.ts    # Artifact management
│   │   └── context-formatter.ts  # AI context generation
│   ├── validate/           # Test execution
│   │   ├── executor.ts     # Main execution engine
│   │   └── resolver.ts     # Command resolution
│   └── types/              # TypeScript definitions
└── tests/                  # Unit tests
```

---

## Programmatic API

```typescript
import {
  // Registry
  addProject,
  listProjects,
  getProjectPath,

  // Config
  loadProjectConfig,
  loadRunConfig,

  // Execution
  runValidate,
  resolveRunSpec,

  // Artifacts
  ArtifactsDir,
  collectArtifacts,

  // Formatting
  formatResult,
  printResult,
} from 'kitwe';

// Run tests
const result = await runValidate({
  projectRoot: '/path/to/project',
  artifactsDir: '/path/to/artifacts',
  timeoutSeconds: 300,
  script: 'test:e2e',
});

console.log(result.status); // 'passed' | 'failed' | 'error' | 'timeout'
```

---

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| "No entrypoint" error | Missing `run.script` | Add `run.script` or `run.config_path` to config |
| Tests timeout | Long-running tests | Increase `timeout_seconds` |
| Can't find project | Not registered | Run `kitwe project add` |
| Config validation fails | Invalid YAML | Check syntax with `config validate` |
| Pre-command fails | Setup issue | Check command output in logs |
| nvm/node not found | Shell environment | Kitwe uses login shell; check shell profile |

---

## What Kitwe Is NOT

- **Not a test generator** — AI agents generate tests; Kitwe provides context
- **Not a test healer** — AI agents fix tests; Kitwe provides failure info
- **Not a browser automator** — Playwright does that; Kitwe runs Playwright
- **Not AI-powered** — Kitwe is deterministic; same input always gives same output

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

---

## License

MIT
