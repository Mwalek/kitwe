# Architecture

System design and architectural decisions for Kitwe.

## Overview

Kitwe is deterministic infrastructure for AI coding agents. It provides the context AI agents need to create Playwright tests that actually work.

```
AI Coding Agent (Claude, Cursor, etc.)
         │
         │ MCP Tools
         ▼
    ┌───────────────────────────────────┐
    │           Kitwe               │
    │                                   │
    │  ┌──────────┐  ┌───────────────┐  │
    │  │MCP Server│  │     CLI       │  │
    │  └────┬─────┘  └───────┬───────┘  │
    │       │                │          │
    │       ▼                ▼          │
    │  ┌────────────────────────────┐   │
    │  │          Core              │   │
    │  │ registry│config│paths      │   │
    │  │ artifacts│context-format   │   │
    │  └────────────┬───────────────┘   │
    │               │                   │
    │               ▼                   │
    │  ┌────────────────────────────┐   │
    │  │        Runner              │   │
    │  │   executor │ resolver      │   │
    │  └────────────────────────────┘   │
    └───────────────────────────────────┘
         │
         ▼
    Your Project (Playwright tests, DB, app)
```

---

## Design Principles

### 1. Deterministic Execution

**Same input produces same output.** Kitwe contains no AI reasoning—it's pure infrastructure.

- AI agent decides what to run
- Kitwe executes exactly as configured
- Results are structured JSON for parsing

### 2. Explicit Entrypoint (Policy A)

**No magic auto-detection.** The run phase requires explicit configuration.

| Policy | Description |
|--------|-------------|
| **Policy A** | Run phase only uses `run.script` or `run.config_path` |
| **Policy A1** | Return actionable error if no entrypoint configured |

**Rationale:** AI agents work better with explicit, predictable behavior. Auto-detection introduces ambiguity.

### 3. AI Agent Ownership

**Kitwe is infrastructure, not intelligence.**

- AI agents own test generation decisions
- AI agents own test healing decisions
- AI agents interpret results
- Kitwe only executes and reports

### 4. Structured Communication

**All outputs follow schemas for reliable parsing.**

| Output Type | Schema |
|-------------|--------|
| Test Result | `RunResult` |
| Artifact | `ArtifactInfo` |
| Config | `KitweConfig` |

---

## Component Architecture

### Layer 1: MCP Server

**File:** `src/mcp-server.ts`

Primary interface for AI agents. Exposes 12 tools via Model Context Protocol.

**Responsibilities:**

- Tool registration and parameter validation (Zod schemas)
- Request routing to core modules
- JSON response formatting
- Error translation to structured responses

### Layer 2: CLI

**Files:** `src/cli.ts`, `src/commands/*.ts`

Human-facing interface using Commander.js.

| Command | Purpose |
|---------|---------|
| `project` | Registry management |
| `config` | Configuration management |
| `run` | Test execution |

### Layer 3: Core

**Directory:** `src/core/`

Shared infrastructure modules.

| Module | Purpose |
|--------|---------|
| `registry.ts` | Project registry |
| `config.ts` | Config loading/validation |
| `artifacts.ts` | Artifact management |
| `context-formatter.ts` | AI context generation |
| `paths.ts` | Path resolution |

### Layer 4: Runner

**Directory:** `src/runner/`

Test execution engine.

| Module | Purpose |
|--------|---------|
| `executor.ts` | Main execution logic |
| `resolver.ts` | Command resolution |
| `formatter.ts` | Output formatting |

---

## Data Flows

### Test Execution Flow

```
1. Request
   MCP: run_tests(project_root, script, ...)
   CLI: kitwe run --project x --script test:e2e

2. Configuration Loading
   loadRunConfig(projectRoot)
     → Read kitwe.yaml
     → Parse with Zod schema
     → Return RunConfig

3. Command Resolution
   resolveRunSpec(spec)
     → Determine mode (yaml_script, cli_script, etc.)
     → Build argv array
     → Return ResolvedCommand

4. Pre-Command Execution (if not skipped)
   runPreCommands(preCommands, env, logsDir)
     → Execute each command sequentially
     → Fail fast on error

5. Test Execution
   runCommand(argv, options)
     → Spawn login shell for nvm/node support
     → Stream stdout/stderr
     → Apply timeout

6. Artifact Collection
   collectArtifacts(projectRoot, outputDir)
     → Search test-results/, playwright-report/
     → Categorize by type

7. Result Assembly
   Return RunResult {
     status, exitCode, stdout, stderr,
     durationMs, artifacts, command, error
   }
```

### Configuration Flow

```
1. loadProjectConfig(projectRoot)

2. File Resolution
   getConfigPath(projectRoot)
     → /project/kitwe.yaml

3. YAML Parsing
   yaml.load(content)

4. Schema Validation
   KitweConfigSchema.safeParse(data)
     → Zod validation
     → Type coercion
     → Default values

5. Return KitweConfig
```

---

## Directory Structure

```
src/
├── cli.ts              # CLI entry point
├── mcp-server.ts       # MCP server (primary interface)
├── index.ts            # Package exports
│
├── commands/           # CLI command handlers
│   ├── project.ts      # project add/list/show/remove
│   ├── config.ts       # config show/init/validate
│   └── run.ts          # run command
│
├── core/               # Core infrastructure
│   ├── registry.ts     # Project registry management
│   ├── config.ts       # Configuration loading/validation
│   ├── artifacts.ts    # Artifact collection/management
│   ├── context-formatter.ts  # AI context generation
│   └── paths.ts        # Path resolution utilities
│
├── validate/           # Test execution
│   ├── executor.ts     # Main execution engine
│   ├── resolver.ts     # Command resolution
│   └── formatter.ts    # Output formatting
│
└── types/              # TypeScript definitions
    └── index.ts        # All type exports

tests/                  # Unit tests
package.json
tsconfig.json
```

---

## Key Implementation Details

### Shell Execution

Commands run in a login shell to ensure user's shell profile is loaded:

```typescript
const userShell = options.env?.SHELL || '/bin/zsh';
child = spawn(userShell, ['-l', '-c', fullCommand], {
  cwd: options.cwd,
  env: options.env,
});
```

**Rationale:** MCP servers may run in environments where nvm/node aren't in PATH.

### Reporter Injection

Kitwe automatically injects `--reporter=list` to prevent HTML reporter from blocking:

```typescript
if (!argvStr.includes('--reporter')) {
  flagsToInject.push('--reporter=list');
}
```

### Environment Variable Resolution

Config values can reference environment variables:

```yaml
project:
  base_url: $PLAYWRIGHT_BASE_URL
```

Resolution pattern: `$VAR` or `${VAR}`

### Project Registry Storage

Registry is stored at:

```
~/.kitwe/registry.json
```

Format:

```json
{
  "version": 1,
  "projects": {
    "myapp": {
      "path": "/path/to/myapp",
      "addedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

---

## Error Handling

### Error Categories

| Category | Error Class | Recovery |
|----------|-------------|----------|
| Config Loading | `ConfigLoadError` | Check file path, permissions |
| Config Validation | `ConfigValidationError` | Fix schema issues |
| Config Missing | `ConfigNotFoundError` | Create kitwe.yaml |
| Project Not Found | `ProjectNotFoundError` | Register project |
| Project Exists | `ProjectExistsError` | Use --force flag |
| Invalid Path | `InvalidProjectPathError` | Verify path exists |

### MCP Error Responses

All MCP tools return errors as structured JSON:

```json
{
  "error": "Project 'unknown' not found in registry",
  "available_projects": ["myapp", "another"]
}
```
