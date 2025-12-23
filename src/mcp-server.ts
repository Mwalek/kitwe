#!/usr/bin/env node
/**
 * Kitwe MCP Server - Infrastructure tools for AI agents.
 *
 * This MCP server exposes Kitwe functionality for use by any AI agent:
 * - Project registry management
 * - Configuration parsing and validation
 * - Test validation and execution
 * - Artifact management
 *
 * Usage:
 *   # Start the MCP server
 *   kitwe-mcp
 *
 *   # Or run directly
 *   node dist/mcp-server.js
 *
 * Configuration for Claude Desktop (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "kitwe": {
 *         "command": "kitwe-mcp",
 *         "args": []
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import {
  listProjects,
  getProjectPath,
  ProjectNotFoundError,
} from './core/registry.js';

import {
  loadProjectConfig,
  loadAuthConfig,
  loadRunConfig,
  getConfigPath,
  ConfigLoadError,
  ConfigValidationError,
} from './core/config.js';

import { createConfig } from './core/config-builder.js';
import { validateCreateParams } from './core/config-validator.js';
import { formatSchemaForMcp } from './core/config-schema.js';

import {
  formatProjectContext,
  canRunTests,
  getProjectName,
} from './core/context-formatter.js';

import {
  runValidate,
} from './runner/executor.js';

import {
  ArtifactsDir,
  collectArtifacts,
  getPlaywrightOutputDirs,
} from './core/artifacts.js';

import type { RunSpec } from './types/index.js';

// =============================================================================
// Create MCP Server
// =============================================================================

const server = new McpServer({
  name: 'kitwe',
  version: '0.0.1',
});

// =============================================================================
// Project Registry Tools
// =============================================================================

server.tool(
  'list_projects',
  `List all registered Kitwe projects. Returns a dictionary mapping project names to their absolute paths.

WHEN TO USE: Call this FIRST when you don't know the project name. If user mentions a project by name, use get_project_context directly with that name.

NEXT STEP: After getting the project name, call get_project_context to get comprehensive test context.`,
  {},
  async () => {
    const projects = listProjects();
    const result: Record<string, string> = {};
    for (const [name, path] of projects) {
      result[name] = path;
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'get_project_root',
  `Get the root filesystem path for a registered project.

WHEN TO USE: Only use when you specifically need the path string. In most cases, use get_project_context instead - it accepts project names directly and provides much more useful information.`,
  {
    project_name: z.string().describe('Name of the registered project'),
  },
  async ({ project_name }) => {
    try {
      const pathStr = getProjectPath(project_name);
      const result = {
        path: pathStr,
        exists: existsSync(pathStr),
      };
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        const available = listProjects().map(([name]) => name);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              available_projects: available,
            }, null, 2),
          }],
        };
      }
      throw error;
    }
  }
);

// =============================================================================
// Project Context Tools
// =============================================================================

server.tool(
  'get_project_context',
  `★★★ PRIMARY TOOL - START HERE ★★★

Get complete Kitwe context for a project. Returns comprehensive markdown documentation explaining:
- How to run tests with Kitwe
- How to interpret test results
- How to access artifacts (traces, screenshots, logs)
- Authentication configuration
- Pre-test setup commands

ALWAYS CALL THIS FIRST when working with a project's tests. Do NOT call read_config, get_config_file_path, or other low-level tools directly.

INPUT: Accepts either a registered project name (e.g., "horatius") OR an absolute path to the project directory.

WORKFLOW:
1. If you know the project name → call this tool directly
2. If you don't know the project name → call list_projects first, then call this
3. If project has no config → response will guide you to use create_config`,
  {
    project: z.string().describe('Project name (from registry) or absolute path to the project root directory'),
  },
  async ({ project }) => {
    // Try to resolve as project name first, fall back to treating as path
    let projectRoot: string;
    try {
      projectRoot = getProjectPath(project);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        // Not a registered project name, treat as path
        projectRoot = project;
      } else {
        throw error;
      }
    }

    const context = formatProjectContext(projectRoot);
    const canRun = canRunTests(projectRoot);
    const projectName = getProjectName(projectRoot);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          context,
          can_run_tests: canRun,
          project_name: projectName,
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// Configuration Tools
// =============================================================================

server.tool(
  'read_config',
  `Parse and return the raw kitwe.yaml configuration for a project.

⚠️ LOW-LEVEL TOOL - Prefer get_project_context instead, which provides formatted context including this config.

WHEN TO USE: Only when you specifically need the raw YAML config structure (e.g., to understand what fields to edit). For test execution context, use get_project_context.`,
  {
    project_root: z.string().describe('Absolute path to the project root directory'),
  },
  async ({ project_root }) => {
    try {
      const config = loadProjectConfig(project_root);
      if (config) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(config, null, 2),
          }],
        };
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'No configuration found', path: project_root }, null, 2),
        }],
      };
    } catch (error) {
      if (error instanceof ConfigLoadError || error instanceof ConfigValidationError) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: error.message, path: project_root }, null, 2),
          }],
        };
      }
      throw error;
    }
  }
);

server.tool(
  'get_config_file_path',
  `Get the filesystem path to kitwe.yaml for a project. Returns the path and whether the file exists.

WHEN TO USE: Only when you need to edit an existing config file with AI file-editing tools. For creating new configs, use create_config instead.`,
  {
    project_root: z.string().describe('Absolute path to the project root directory'),
  },
  async ({ project_root }) => {
    const configPath = getConfigPath(project_root);
    const result = {
      path: configPath,
      exists: existsSync(configPath),
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'create_config',
  `Create a new kitwe.yaml configuration file for a project.

PREREQUISITE: Call get_config_schema first to understand what questions to ask the user about their test setup.

WHEN TO USE: When get_project_context indicates the project has no config (can_run_tests: false).

BEHAVIOR:
- Fails if kitwe.yaml already exists (use AI file-editing tools to modify existing configs)
- Only project_path is required; all other fields are optional
- Minimal config: just project_path with run.script

WORKFLOW:
1. Call get_config_schema to see available options
2. Ask user about their test setup (npm script, test directory, auth, etc.)
3. Call create_config with their answers
4. Call get_project_context to verify the config works`,
  {
    project_path: z.string().describe('Absolute path to the project directory'),
    project: z.object({
      name: z.string().optional().describe('Project name'),
      envFile: z.string().optional().describe('Path to environment file'),
      baseUrl: z.string().optional().describe('Base URL for tests'),
    }).optional().describe('Project identification settings'),
    run: z.object({
      script: z.string().optional().describe('npm script to run tests'),
      configPath: z.string().optional().describe('Path to Playwright config'),
      timeoutSeconds: z.number().optional().describe('Test timeout in seconds'),
      artifactsDir: z.string().optional().describe('Directory for test artifacts'),
      runner: z.enum(['npm', 'pnpm', 'yarn', 'npx']).optional().describe('Package manager'),
      args: z.array(z.string()).optional().describe('Additional CLI arguments'),
      env: z.record(z.string()).optional().describe('Environment variables'),
      preCommands: z.array(z.object({
        argv: z.array(z.string()).describe('Command and arguments'),
        cwd: z.string().optional().describe('Working directory'),
        env: z.record(z.string()).optional().describe('Command-specific env vars'),
      })).optional().describe('Commands to run before tests'),
      skipSetup: z.boolean().optional().describe('Skip pre-commands'),
      outputDir: z.string().optional().describe('Playwright output directory'),
    }).optional().describe('Test execution configuration'),
    tests: z.object({
      testDir: z.string().optional().describe('Directory containing test files'),
      pattern: z.string().optional().describe('Glob pattern for test files'),
      defaultOutputPath: z.string().optional().describe('Default output path'),
      selectorPolicy: z.object({
        prefer: z.array(z.string()).optional().describe('Preferred selector types'),
        avoid: z.array(z.string()).optional().describe('Selector types to avoid'),
      }).optional().describe('Selector preferences for AI'),
    }).optional().describe('Test file discovery settings'),
    auth: z.object({
      envFile: z.string().optional().describe('Auth credentials env file'),
      default: z.object({
        strategy: z.enum(['no_auth', 'login_in_test', 'login_before_test']).describe('Auth strategy'),
        credentials: z.object({
          email: z.string().describe('Email env var name'),
          password: z.string().describe('Password env var name'),
        }).optional().describe('Login credentials'),
        storageStatePath: z.string().optional().describe('Path to saved auth state'),
      }).optional().describe('Default auth profile'),
      profiles: z.record(z.object({
        strategy: z.enum(['no_auth', 'login_in_test', 'login_before_test']).describe('Auth strategy'),
        credentials: z.object({
          email: z.string().describe('Email env var name'),
          password: z.string().describe('Password env var name'),
        }).optional().describe('Login credentials'),
        storageStatePath: z.string().optional().describe('Path to saved auth state'),
      })).optional().describe('Named auth profiles'),
    }).optional().describe('Authentication configuration'),
  },
  async (params) => {
    // Validate input
    const validation = validateCreateParams({
      projectPath: params.project_path,
      project: params.project,
      run: params.run,
      tests: params.tests,
      auth: params.auth,
    });

    if (!validation.valid) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            configPath: '',
            message: 'Validation failed',
            validationErrors: validation.errors,
          }, null, 2),
        }],
      };
    }

    // Create config
    const result = createConfig({
      projectPath: params.project_path,
      project: params.project,
      run: params.run,
      tests: params.tests,
      auth: params.auth,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'get_config_schema',
  `Get the kitwe.yaml configuration schema with descriptions and suggested questions for each property.

WHEN TO USE: Before calling create_config, to understand what information to collect from the user.

RETURNS: Schema with field descriptions and AI-friendly prompts for gathering user requirements.`,
  {},
  async () => {
    const schema = formatSchemaForMcp();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(schema, null, 2),
      }],
    };
  }
);

// =============================================================================
// Authentication Tools
// =============================================================================

server.tool(
  'list_auth_profiles',
  `List available authentication profiles defined in kitwe.yaml for a project.

WHEN TO USE: When writing tests that need authentication and you need to know what profiles are available (e.g., "admin", "user", "guest").

NOTE: get_project_context already includes auth profile information in its output.`,
  {
    project_root: z.string().describe('Absolute path to the project root directory'),
  },
  async ({ project_root }) => {
    try {
      const authConfig = loadAuthConfig(project_root);
      if (!authConfig) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ default: null, profiles: [] }, null, 2),
          }],
        };
      }

      const result: Record<string, unknown> = {
        profiles: Object.keys(authConfig.profiles || {}),
      };

      if (authConfig.default) {
        result.default = authConfig.default;
      } else {
        result.default = null;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Failed to load auth config: ${error}` }, null, 2),
        }],
      };
    }
  }
);

server.tool(
  'resolve_auth_profile',
  `Resolve authentication configuration for a specific profile, returning strategy and credentials.

WHEN TO USE: When you need the actual credential environment variable names for a specific auth profile (e.g., to write login code in a test).

RETURNS: Auth strategy ("no_auth", "login_in_test", "login_before_test") and credential env var names.`,
  {
    project_root: z.string().describe('Absolute path to the project root directory'),
    profile: z.string().optional().describe('Name of the auth profile to resolve (e.g., "admin"). If not provided, uses the default profile.'),
  },
  async ({ project_root, profile }) => {
    try {
      const authConfig = loadAuthConfig(project_root);
      if (!authConfig) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ strategy: 'no_auth', credentials: {} }, null, 2),
          }],
        };
      }

      // Resolve profile
      let resolved;
      if (profile && authConfig.profiles && authConfig.profiles[profile]) {
        resolved = authConfig.profiles[profile];
      } else if (authConfig.default) {
        resolved = authConfig.default;
      } else {
        resolved = { strategy: 'no_auth', credentials: {} };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(resolved, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Failed to resolve auth: ${error}` }, null, 2),
        }],
      };
    }
  }
);

// =============================================================================
// Test Execution Tools
// =============================================================================

server.tool(
  'run_tests',
  `Execute Playwright tests and return structured results with artifact paths.

PREREQUISITE: Project must have a kitwe.yaml config. Call get_project_context first to verify can_run_tests: true.

RETURNS: Test results including:
- exit_code (0 = all passed)
- stdout/stderr
- Paths to artifacts (traces, screenshots, logs)

WORKFLOW:
1. Call get_project_context → verify can_run_tests: true
2. Call run_tests with project_root
3. If tests fail, use list_artifacts and read_artifact_file to analyze failures`,
  {
    project_root: z.string().describe('Absolute path to the project root directory'),
    artifacts_dir: z.string().optional().describe('Where to save logs and reports. Defaults to <project>/artifacts/kitwe.'),
    timeout_seconds: z.number().optional().default(300).describe('Maximum execution time in seconds (default: 300)'),
    script: z.string().optional().describe('npm script name to run (e.g., "test:e2e"). Uses config default if not specified.'),
    config_path: z.string().optional().describe('Path to playwright.config.ts relative to project_root'),
    spec_file: z.string().optional().describe('Specific test file to run (e.g., "auth.spec.ts")'),
    skip_setup: z.boolean().optional().default(false).describe('Skip pre_commands from config (e.g., db:reset)'),
  },
  async ({ project_root, artifacts_dir, timeout_seconds, script, config_path, spec_file, skip_setup }) => {
    // Load config for defaults (env vars, runner, pre_commands, etc.)
    const runConfig = loadRunConfig(project_root);

    const resolvedArtifacts = artifacts_dir
      || runConfig?.artifactsDir
      || resolve(project_root, 'artifacts', 'kitwe');

    const runSpec: RunSpec = {
      projectRoot: project_root,
      artifactsDir: resolvedArtifacts,
      timeoutSeconds: timeout_seconds ?? 300,
      script: script || runConfig?.script,
      configPath: config_path,
      args: spec_file ? [spec_file] : undefined,
      runner: runConfig?.runner,
      env: runConfig?.env,
      outputDir: runConfig?.outputDir,
      skipSetup: skip_setup,
    };

    try {
      const result = await runValidate(runSpec);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            error: String(error),
            exit_code: null,
          }, null, 2),
        }],
      };
    }
  }
);

// =============================================================================
// Artifact Tools
// =============================================================================

server.tool(
  'list_artifacts',
  `List available artifacts (traces, screenshots, logs) for a specific test.

WHEN TO USE: After run_tests returns failures, to find artifacts for a specific failing test.

WORKFLOW:
1. run_tests → test fails
2. list_test_artifacts → get list of tests with artifacts
3. list_artifacts with test_name → get artifact paths
4. read_artifact_file → read specific artifact content`,
  {
    project_root: z.string().describe('Absolute path to the project root directory'),
    test_name: z.string().describe('Name of the test (from Playwright output, e.g., "auth-login-success")'),
  },
  async ({ project_root, test_name }) => {
    const artifactsBase = resolve(project_root, 'artifacts', 'kitwe');
    const artifacts = new ArtifactsDir(artifactsBase, test_name);

    const result: Record<string, unknown> = {
      base_dir: artifacts.base,
      test_dir: artifacts.hasArtifacts() ? artifacts.testDir : null,
      logs: artifacts.logs,
      reports: artifacts.reports,
    };

    // Check which paths actually exist
    const existing: Record<string, boolean> = {};
    for (const [key, path] of Object.entries(result)) {
      if (typeof path === 'string') {
        existing[key] = existsSync(path);
      }
    }
    result.existing = existing;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'list_test_artifacts',
  `List all tests that have generated artifacts (from previous test runs).

WHEN TO USE: After run_tests, to see which tests have artifacts available for analysis.

RETURNS: List of test names that have artifact directories (traces, screenshots, etc.).`,
  {
    project_root: z.string().describe('Absolute path to the project root directory'),
  },
  async ({ project_root }) => {
    const artifactsBase = resolve(project_root, 'artifacts', 'kitwe');
    const artifacts = new ArtifactsDir(artifactsBase);
    const tests = artifacts.listTests();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          base_dir: artifactsBase,
          tests,
          count: tests.length,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'collect_test_artifacts',
  `Collect and organize artifacts from Playwright's raw output directories.

WHEN TO USE: When you need to find artifacts in Playwright's default output locations (test-results/, playwright-report/) rather than Kitwe's organized artifact directory.

NOTE: run_tests automatically organizes artifacts into a standard structure. Use this only for manual artifact discovery.`,
  {
    project_root: z.string().describe('Absolute path to the project root directory'),
  },
  async ({ project_root }) => {
    const searchDirs = getPlaywrightOutputDirs(project_root);
    const artifacts = collectArtifacts(searchDirs);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          search_dirs: searchDirs,
          artifacts: artifacts.map(a => ({
            type: a.type,
            name: a.name,
            path: a.path,
            size: a.size,
          })),
          count: artifacts.length,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'read_artifact_file',
  `Read the contents of an artifact file (log, trace summary, etc.).

WHEN TO USE: After list_artifacts returns file paths, to read specific artifact content for failure analysis.

SUPPORTS: Text files (logs, trace summaries). For binary files (screenshots, videos), use the path with AI vision tools.

RETURNS: File content with truncation info if file exceeds max_lines.`,
  {
    artifact_path: z.string().describe('Absolute path to the artifact file'),
    max_lines: z.number().optional().default(500).describe('Maximum number of lines to return (default: 500)'),
  },
  async ({ artifact_path, max_lines }) => {
    if (!existsSync(artifact_path)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            path: artifact_path,
            exists: false,
            error: 'File not found',
          }, null, 2),
        }],
      };
    }

    try {
      const content = readFileSync(artifact_path, 'utf-8');
      const lines = content.split('\n');
      const maxLinesToReturn = max_lines ?? 500;
      const truncated = lines.length > maxLinesToReturn;
      const resultLines = truncated ? lines.slice(0, maxLinesToReturn) : lines;
      const resultContent = resultLines.join('\n');

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            path: artifact_path,
            exists: true,
            content: resultContent,
            lines: resultLines.length,
            total_lines: lines.length,
            truncated,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            path: artifact_path,
            exists: true,
            error: `Failed to read file: ${error}`,
          }, null, 2),
        }],
      };
    }
  }
);

// =============================================================================
// Server Entry Point
// =============================================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
