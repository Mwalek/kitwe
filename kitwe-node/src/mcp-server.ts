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
  'List all registered Kitwe projects. Returns a dictionary mapping project names to their paths.',
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
  'Get the root path for a registered project.',
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
  'Get complete Kitwe context for this project. This should be the FIRST tool called when working with a project\'s tests. Returns a comprehensive markdown document explaining how to use Kitwe to run tests, interpret results, and access artifacts.',
  {
    project: z.string().describe('Project name (from registry) or path to the project root directory'),
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
  'Parse and return kitwe.yaml configuration for a project.',
  {
    project_root: z.string().describe('Path to the project root directory'),
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
  'Get the path to kitwe.yaml for a project.',
  {
    project_root: z.string().describe('Path to the project root directory'),
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
  'Create a new kitwe.yaml configuration file. Use get_config_schema first to understand available options. Fails if config already exists (use AI edit tools for existing configs).',
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
  'Get the configuration schema with descriptions and questions for each property. Use this to understand what values to collect before calling create_config.',
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
  'List available authentication profiles for a project.',
  {
    project_root: z.string().describe('Path to the project root directory'),
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
  'Resolve authentication configuration for a specific profile.',
  {
    project_root: z.string().describe('Path to the project root directory'),
    profile: z.string().optional().describe('Name of the auth profile to resolve. If not provided, uses the default profile.'),
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
  'Run Playwright tests and return results with artifacts.',
  {
    project_root: z.string().describe('Path to the project root directory'),
    artifacts_dir: z.string().optional().describe('Where to save logs and reports. Defaults to <project>/artifacts/kitwe.'),
    timeout_seconds: z.number().optional().default(300).describe('Maximum execution time (default: 300)'),
    script: z.string().optional().describe('npm script name to run (e.g., "test:e2e")'),
    config_path: z.string().optional().describe('Path to playwright config relative to project_root'),
    spec_file: z.string().optional().describe('Optional specific test file to run'),
    skip_setup: z.boolean().optional().default(false).describe('Skip pre_commands from config'),
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
  'List available artifacts for a test.',
  {
    project_root: z.string().describe('Path to the project root directory'),
    test_name: z.string().describe('Name of the test (used in artifact directory structure)'),
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
  'List all tests that have artifacts.',
  {
    project_root: z.string().describe('Path to the project root directory'),
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
  'Collect artifacts from Playwright output directories.',
  {
    project_root: z.string().describe('Path to the project root directory'),
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
  'Read the contents of an artifact file.',
  {
    artifact_path: z.string().describe('Path to the artifact file'),
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
