/**
 * Kitwe Project Context Formatter.
 *
 * Generates AI-readable markdown context documents that explain how to use
 * Kitwe for a specific project. This is the entry point for AI agents -
 * after reading the context, an agent should have everything needed to
 * successfully run tests.
 *
 * Design Principles:
 * - Condition-based guidance: "When you need X, use tool Y"
 * - Professional/authoritative tone
 * - Kitwe is a visible, branded tool
 * - AI owns the workflow loop
 */

import {
  loadProjectConfig,
  getConfigPath,
  resolveEnvValue,
  ConfigLoadError,
  ConfigValidationError,
} from './config.js';
import type { KitweConfig } from '../types/index.js';

/**
 * Generate AI-readable context document for Kitwe usage.
 *
 * This is the main entry point. Returns a complete markdown document
 * that tells AI agents how to use Kitwe for this project.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns Markdown document with full project context.
 */
export function formatProjectContext(projectRoot: string): string {
  try {
    const config = loadProjectConfig(projectRoot);

    if (config === null) {
      return formatNoConfigError(projectRoot);
    }

    return formatFullContext(projectRoot, config);
  } catch (error) {
    if (error instanceof ConfigLoadError || error instanceof ConfigValidationError) {
      return formatConfigError(projectRoot, error.message);
    }
    throw error;
  }
}

/**
 * Return helpful error when config is missing.
 */
function formatNoConfigError(projectRoot: string): string {
  const configPath = getConfigPath(projectRoot);

  return `# Kitwe: Configuration Required

## Status: Not Configured

Kitwe requires a \`kitwe.yaml\` configuration file to run tests.

**Project Root**: \`${projectRoot}\`
**Expected Config**: \`${configPath}\`

---

## How to Create Configuration

Create a \`kitwe.yaml\` file in the project root with at minimum:

\`\`\`yaml
version: 1

run:
  script: test:e2e  # Your npm script that runs Playwright
\`\`\`

Or if you prefer to specify the Playwright config directly:

\`\`\`yaml
version: 1

run:
  config_path: playwright.config.ts
\`\`\`

---

## Full Configuration Example

\`\`\`yaml
version: 1

project:
  name: my-project
  base_url: $PLAYWRIGHT_BASE_URL
  env_file: .env.test

run:
  script: test:e2e
  timeout_seconds: 600
  artifacts_dir: test-results

auth:
  default:
    strategy: login_in_test
    credentials:
      email: E2E_TEST_EMAIL
      password: E2E_TEST_PASSWORD
\`\`\`

---

## Next Steps

1. Create \`kitwe.yaml\` in \`${projectRoot}\`
2. Call \`get_project_context\` again to get full context
`;
}

/**
 * Return error when config exists but is invalid.
 */
function formatConfigError(projectRoot: string, error: string): string {
  const configPath = getConfigPath(projectRoot);

  return `# Kitwe: Configuration Error

## Status: Invalid Configuration

Kitwe found a configuration file but encountered an error loading it.

**Project Root**: \`${projectRoot}\`
**Config File**: \`${configPath}\`

---

## Error Details

\`\`\`
${error}
\`\`\`

---

## How to Fix

Check your \`kitwe.yaml\` for:
- Valid YAML syntax
- Required \`version: 1\` field
- Valid \`run.script\` or \`run.config_path\`

After fixing, call \`get_project_context\` again.
`;
}

/**
 * Assemble complete context document.
 */
function formatFullContext(projectRoot: string, config: KitweConfig): string {
  const sections = [
    formatHeader(),
    formatOverview(),
    formatWhenToUse(projectRoot, config),
    formatProjectConfig(projectRoot, config),
    formatPreCommands(config),
    formatAuthentication(config),
    formatAllTools(),
    formatResultsSchema(),
    formatErrorHandling(),
  ];

  return sections.join('\n');
}

/**
 * Format the document header.
 */
function formatHeader(): string {
  return '# Kitwe: E2E Test Execution Infrastructure';
}

/**
 * Format the overview section.
 */
function formatOverview(): string {
  return `
## Overview

Kitwe is deterministic infrastructure for AI agents to execute and analyze
E2E tests. It provides:

- **Reliable Execution**: Consistent, predictable test runs
- **Structured Results**: JSON output with pass/fail, failures, and artifacts
- **Authentication Support**: Configured auth profiles with credential management
- **Artifact Access**: Direct access to traces, screenshots, and reports

**Your role**: You own the testing workflow. Kitwe executes tests and provides
structured feedback. You interpret results and decide next actions (retry, fix, report).
`;
}

/**
 * Format the condition-based tool usage section.
 */
function formatWhenToUse(projectRoot: string, config: KitweConfig): string {
  const timeout = config.run?.timeoutSeconds ?? 1200;

  return `
---

## When to Use Each Tool

**When you need to run tests:**
\`\`\`
run_tests(
    project_root="${projectRoot}",
    spec_file="optional/path/to/test.spec.ts",
    timeout=${timeout}
)
\`\`\`

**When you need to analyze a failure:**
- Check the \`failures\` array in the run result
- Call \`read_artifact_file(path)\` to view screenshots
- Call \`get_trace_summary(trace_path)\` to analyze the Playwright trace

**When you need authentication details:**
\`\`\`
resolve_auth_profile(project_root="${projectRoot}", profile="default")
\`\`\`

**When you need to find test artifacts:**
\`\`\`
list_artifacts(project_root="${projectRoot}", test_name="example.spec.ts")
\`\`\`
`;
}

/**
 * Format the project configuration section.
 */
function formatProjectConfig(projectRoot: string, config: KitweConfig): string {
  const runConfig = config.run;
  const project = config.project;

  // Resolve base URL
  const baseUrl = resolveEnvValue(project?.baseUrl) || '(not configured)';

  // Determine entrypoint
  let entrypoint: string;
  if (runConfig?.script) {
    entrypoint = `npm script: \`${runConfig.script}\``;
  } else if (runConfig?.configPath) {
    entrypoint = `config file: \`${runConfig.configPath}\``;
  } else {
    entrypoint = '(not configured)';
  }

  const runner = runConfig?.runner || '(auto-detected)';
  const artifactsDir = runConfig?.artifactsDir ?? 'artifacts/kitwe';
  const timeoutSeconds = runConfig?.timeoutSeconds ?? 1200;
  const configPath = getConfigPath(projectRoot);

  return `
---

## Project Configuration

| Setting | Value |
|---------|-------|
| Project Name | ${project?.name || '(not set)'} |
| Project Root | \`${projectRoot}\` |
| Config File | \`${configPath}\` |
| Base URL | ${baseUrl} |
| Test Timeout | ${timeoutSeconds}s |

### Test Execution

**Entrypoint**: ${entrypoint}
**Runner**: ${runner}
**Artifacts Directory**: \`${artifactsDir}\`
`;
}

/**
 * Format the pre-commands section.
 */
function formatPreCommands(config: KitweConfig): string {
  const runCommands = config.run?.preCommands;

  if (!runCommands || runCommands.length === 0) {
    return `
### Pre-Test Setup

No setup commands configured. Tests execute immediately.
`;
  }

  const lines = ['\n### Pre-Test Setup\n'];
  lines.push('The following commands execute automatically before tests:\n');
  lines.push('```bash');

  for (const cmd of runCommands) {
    lines.push(cmd.argv.join(' '));
  }

  lines.push('```');

  return lines.join('\n');
}

/**
 * Format the authentication section.
 */
function formatAuthentication(config: KitweConfig): string {
  const auth = config.auth;

  if (!auth?.default && Object.keys(auth?.profiles || {}).length === 0) {
    return `
---

## Authentication

No authentication configured for this project.
`;
  }

  const lines = ['\n---\n\n## Authentication\n'];

  if (auth?.default) {
    const strategy = auth.default.strategy;
    lines.push(`**Default Strategy**: \`${strategy}\`\n`);

    if (strategy === 'no_auth') {
      lines.push('> No authentication required. Tests run without login.\n');
    } else if (strategy === 'login_in_test') {
      lines.push('> Tests should include login steps.\n');
      if (auth.default.credentials) {
        lines.push('>\n> **Credentials** (environment variable names):');
        lines.push(`> - Email: \`${auth.default.credentials.email}\``);
        lines.push(`> - Password: \`${auth.default.credentials.password}\`\n`);
      }
    } else if (strategy === 'login_before_test') {
      lines.push('> AI agent logs in before test execution. Tests assume authenticated state.\n');
      if (auth.default.credentials) {
        lines.push('>\n> **Credentials** (environment variable names):');
        lines.push(`> - Email: \`${auth.default.credentials.email}\``);
        lines.push(`> - Password: \`${auth.default.credentials.password}\`\n`);
      }
    }
  }

  const profileNames = Object.keys(auth?.profiles || {});
  if (profileNames.length > 0) {
    const profileList = profileNames.map(name => `\`${name}\``).join(', ');
    lines.push(`\n**Available Profiles**: ${profileList}`);
    lines.push('\nUse `resolve_auth_profile(project_root, "profile_name")` to get details.');
  }

  return lines.join('\n');
}

/**
 * Format the available tools section.
 */
function formatAllTools(): string {
  return `
---

## All Available Tools

| Tool | Use When... |
|------|-------------|
| \`run_tests(project_root, spec_file?, timeout?)\` | You need to execute tests |
| \`list_artifacts(project_root, test_name)\` | You need to find artifact paths |
| \`read_artifact_file(path)\` | You need to read a specific artifact |
| \`get_trace_summary(trace_path)\` | You need to analyze test execution |
| \`resolve_auth_profile(project_root, profile)\` | You need credentials for a specific user type |
| \`list_auth_profiles(project_root)\` | You need to see available auth profiles |
`;
}

/**
 * Format the test results schema section.
 */
function formatResultsSchema(): string {
  return `
---

## Test Results Schema

After calling \`run_tests\`, you receive:

\`\`\`json
{
    "status": "passed | failed | error",
    "exit_code": 0,
    "summary": {
        "total": 5,
        "passed": 4,
        "failed": 1,
        "skipped": 0,
        "duration_ms": 12345
    },
    "failures": [{
        "title": "should login successfully",
        "file": "e2e/auth.spec.ts",
        "line": 15,
        "message": "Expected element to be visible",
        "stack": "..."
    }],
    "artifacts": {
        "json_report": "test-results/results.json",
        "traces": ["test-results/trace.zip"],
        "screenshots": ["test-results/failure-1.png"]
    }
}
\`\`\`
`;
}

/**
 * Format the error handling section.
 */
function formatErrorHandling(): string {
  return `
---

## Error Handling

**Test Failures**: Examine the \`failures\` array for error details. Use
\`read_artifact_file\` to access screenshots or \`get_trace_summary\` for traces.

**Execution Errors**: Check \`status: "error"\` cases for environment or
configuration issues separate from test failures.

**Pre-command Failures**: If setup commands fail, tests won't run. Check the
error message for details about which command failed.
`;
}

/**
 * Check if tests can be run (config exists with explicit entrypoint).
 */
export function canRunTests(projectRoot: string): boolean {
  try {
    const config = loadProjectConfig(projectRoot);
    if (!config) return false;

    return !!(config.run?.script || config.run?.configPath);
  } catch {
    return false;
  }
}

/**
 * Get project name from config, if available.
 */
export function getProjectName(projectRoot: string): string | null {
  try {
    const config = loadProjectConfig(projectRoot);
    return config?.project?.name || null;
  } catch {
    return null;
  }
}
