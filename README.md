# Kitwe

[![npm version](https://img.shields.io/npm/v/@mwalek/kitwe.svg)](https://www.npmjs.com/package/@mwalek/kitwe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/Mwalek/kitwe/actions/workflows/ci.yml/badge.svg)](https://github.com/Mwalek/kitwe/actions/workflows/ci.yml)

**Deterministic infrastructure for AI coding agents.** Kitwe provides the context AI agents need to create Playwright tests that actually work.

## The Problem

When AI agents write Playwright tests, they fail because:
- They don't understand project setup (auth, env, test structure)
- They don't know how to run tests correctly
- They can't analyze traces when tests fail
- They can't do pre-test setup (DB reset, seeding)

## The Solution

Kitwe provides:
- **Project context** - translates `kitwe.yaml` into AI-readable markdown
- **Test execution** - deterministic test running with structured JSON output
- **Artifact management** - organizes paths to screenshots, traces, and logs
- **Environment prep** - runs pre-test commands (DB reset, seeding, servers)

## What Kitwe Is NOT

- **Not a test generator** - AI agents generate tests; Kitwe provides context
- **Not a test healer** - AI agents fix tests; Kitwe provides failure info
- **Not a browser automator** - Playwright does that; Kitwe runs Playwright
- **Not AI-powered** - Kitwe is deterministic; same input = same output

## Quick Start

### Installation

```bash
npm install -g @mwalek/kitwe
```

Or for development:

```bash
git clone https://github.com/Mwalek/kitwe.git
cd kitwe/kitwe-node
npm install && npm run build && npm link
```

### Register a Project

```bash
kitwe project add myapp /path/to/project
```

### Create Configuration

Create `kitwe.yaml` in your project root:

```yaml
version: 1

run:
  script: test:e2e
  timeout_seconds: 1200

tests:
  language: typescript
```

### Run Tests

```bash
# Via CLI
kitwe run --project myapp

# Or use the tp alias
tp run --project myapp
```

## MCP Server (AI Agent Interface)

Kitwe's primary interface is the MCP server for AI agents.

### Configuration

Add to Claude Desktop config (`claude_desktop_config.json`):

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

### Available Tools

| Tool | Purpose |
|------|---------|
| `get_project_context` | Get AI-readable project context (recommended first call) |
| `list_projects` | List all registered projects |
| `get_project_root` | Get filesystem path for a registered project |
| `read_config` | Read kitwe.yaml configuration |
| `get_config_file_path` | Get path to config file |
| `create_config` | Create a new kitwe.yaml from parameters |
| `get_config_schema` | Get config schema with field descriptions |
| `run_tests` | Run Playwright tests, return structured results |
| `list_auth_profiles` | List available auth profiles |
| `resolve_auth_profile` | Resolve credentials for an auth profile |
| `list_artifacts` | List artifact paths for a specific test |
| `list_test_artifacts` | List all tests that have artifacts |
| `collect_test_artifacts` | Collect artifacts from Playwright output dirs |
| `read_artifact_file` | Read artifact file contents |

## CLI Commands

```bash
# Project management
kitwe project add <name> <path>    # Register a project
kitwe project list                  # List projects
kitwe project show <name>           # Show project details
kitwe project remove <name>         # Unregister project

# Configuration
kitwe config show --project <name>  # Display config
kitwe config init --project <name>  # Create template
kitwe config validate --project <name>  # Validate config

# Test execution
kitwe run --project <name> --script test:e2e
kitwe run --project <name> auth.spec.ts  # Run specific file
kitwe run --project <name> -v -j results.json  # Verbose + JSON output
```

## Configuration Reference

### Minimal Config

```yaml
version: 1
run:
  script: test:e2e
```

### Full Config

```yaml
version: 1

project:
  name: my-project
  env_file: .env.test
  base_url: $PLAYWRIGHT_BASE_URL

setup:
  pre_commands:
    - argv: ["npm", "run", "db:reset"]
    - argv: ["npm", "run", "db:seed"]

run:
  script: test:e2e
  timeout_seconds: 1200
  artifacts_dir: test-results
  runner: npm

tests:
  test_dir: e2e
  pattern: "**/*.spec.ts"
  language: typescript

auth:
  default:
    strategy: login_in_test
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

## Architecture

```
AI Coding Agent (Claude, Cursor, etc.)
         |
         | MCP Tools
         v
    +-----------------------------------+
    |           Kitwe               |
    |                                   |
    |  Project Context | Test Execution |
    |  Artifacts       | Environment    |
    |                                   |
    |         kitwe.yaml            |
    +-----------------------------------+
         |
         v
    Your Project (Playwright tests, DB, app)
```

### Directory Structure

```
kitwe-node/
  src/
    cli.ts              # CLI entry point
    mcp-server.ts       # MCP server (primary interface)
    core/               # Infrastructure modules
      registry.ts       # Project registry
      config.ts         # Configuration loading
      artifacts.ts      # Artifact management
      context-formatter.ts  # AI context generation
    runner/             # Test execution
      executor.ts       # Main execution engine
      resolver.ts       # Command resolution
    types/              # TypeScript definitions
```

## Development

```bash
cd kitwe-node

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode (watch)
npm run dev
```

## Requirements

- Node.js 18+
- npm (or pnpm/yarn)

## License

MIT
