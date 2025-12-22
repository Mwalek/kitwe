# Kitwe

**Deterministic infrastructure for AI coding agents.** Kitwe provides the context AI agents need to create Playwright tests that actually work.

## The Problem

When AI agents write Playwright tests, they fail because:

- They don't understand project setup (auth, env, test structure)
- They don't know how to run tests correctly
- They can't analyze traces when tests fail
- They can't do pre-test setup (DB reset, seeding)

## The Solution

Kitwe provides:

- **Project context** — translates `kitwe.yaml` into AI-readable markdown
- **Test execution** — deterministic test running with structured JSON output
- **Artifact management** — organizes paths to screenshots, traces, and logs
- **Environment prep** — runs pre-test commands (DB reset, seeding, servers)

## What Kitwe Is NOT

- **Not a test generator** — AI agents generate tests; Kitwe provides context
- **Not a test healer** — AI agents fix tests; Kitwe provides failure info
- **Not a browser automator** — Playwright does that; Kitwe runs Playwright
- **Not AI-powered** — Kitwe is deterministic; same input = same output

## Architecture

```
AI Coding Agent (Claude, Cursor, etc.)
         │
         │ MCP Tools
         ▼
    ┌─────────────────────────────────────┐
    │           Kitwe                 │
    │                                     │
    │  Project Context │ Test Execution   │
    │  Artifacts       │ Environment Prep │
    │                                     │
    │         kitwe.yaml              │
    └─────────────────────────────────────┘
         │
         ▼
    Your Project (Playwright tests, DB, app)
```

## Quick Links

- [Getting Started](getting-started.md) — Install and configure Kitwe
- [Configuration](configuration.md) — Full `kitwe.yaml` reference
- [CLI Reference](cli.md) — Command-line interface
- [MCP Tools](mcp-tools.md) — AI agent interface
- [Architecture](architecture.md) — System design
