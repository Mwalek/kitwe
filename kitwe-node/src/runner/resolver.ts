/**
 * RunSpec resolver for deterministic command selection.
 *
 * Resolves a RunSpec to exactly one executable command using
 * a strict priority order without any AI/LLM reasoning.
 *
 * Explicit wins; fallback is minimal.
 * - Run NEVER consults tests config (test_dir, pattern, etc.)
 * - Run ONLY uses RunConfig from kitwe.yaml
 * - If no explicit entrypoint: fail with actionable error
 *
 * Priority order:
 * 1. CLI-provided entrypoint (spec.script or spec.configPath)
 * 2. kitwe.yaml run.script or run.config_path
 * 3. Return structured error requiring explicit entrypoint
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import type { RunSpec, RunnerType, PreCommand } from '../types/index.js';
import { loadRunConfig, getRunPreCommands } from '../core/config.js';

// =============================================================================
// Types
// =============================================================================

export interface ResolvedCommand {
  /** Command and arguments to execute */
  argv: string[];
  /** Working directory for execution */
  cwd: string;
  /** How the command was resolved (for debugging) */
  mode: 'cli_script' | 'cli_config' | 'yaml_script' | 'yaml_config';
  /** Optional environment variable overrides from config */
  env?: Record<string, string>;
  /** Commands to run before main execution */
  preCommands?: PreCommand[];
}

export interface ResolvedError {
  /** Error type for categorization */
  errorType: string;
  /** Human-readable error message */
  message: string;
}

export type ResolveResult = ResolvedCommand | ResolvedError;

// =============================================================================
// Type Guards
// =============================================================================

export function isResolvedCommand(result: ResolveResult): result is ResolvedCommand {
  return 'argv' in result;
}

export function isResolvedError(result: ResolveResult): result is ResolvedError {
  return 'errorType' in result;
}

// =============================================================================
// Package Manager Detection
// =============================================================================

/**
 * Detect package manager from lock files.
 *
 * This is the ONLY auto-detection performed.
 * It affects how scripts are run, NOT what tests are selected.
 *
 * Priority: pnpm > yarn > npm
 */
export function detectPackageManager(projectRoot: string): RunnerType {
  if (existsSync(resolve(projectRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(resolve(projectRoot, 'yarn.lock'))) {
    return 'yarn';
  }
  return 'npm';
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve cwd to absolute path relative to project_root.
 */
function resolveCwd(cwd: string | undefined, projectRoot: string): string {
  if (!cwd) {
    return projectRoot;
  }
  if (cwd.startsWith('/')) {
    return cwd;
  }
  return resolve(projectRoot, cwd);
}

/**
 * Extract merged pre_commands for run phase.
 */
function extractPreCommands(spec: RunSpec): PreCommand[] | undefined {
  // Skip if user requested --skip-setup via CLI
  if (spec.skipSetup) {
    return undefined;
  }

  // Get merged pre_commands (setup + run phase)
  const configCommands = getRunPreCommands(spec.projectRoot);

  if (configCommands.length === 0) {
    return undefined;
  }

  return configCommands.map(pc => ({
    argv: pc.argv,
    cwd: resolveCwd(pc.cwd, spec.projectRoot),
    env: pc.env,
  }));
}

// =============================================================================
// Main Resolver
// =============================================================================

/**
 * Deterministically resolve RunSpec to exactly one executable command.
 *
 * Explicit wins; fallback is minimal.
 *
 * Priority order:
 * 1. CLI-provided entrypoint (spec.script or spec.configPath)
 * 2. kitwe.yaml run.script or run.config_path
 * 3. Return structured error requiring explicit entrypoint
 */
export function resolveRunSpec(spec: RunSpec): ResolveResult {
  const projectRoot = spec.projectRoot;

  if (!existsSync(projectRoot)) {
    return {
      errorType: 'project_not_found',
      message: `Project root does not exist: ${projectRoot}`,
    };
  }

  // Load run config once - used for pre_commands and entrypoint fallback
  const runConfig = loadRunConfig(projectRoot);

  // Priority 1: CLI-provided explicit script
  if (spec.script) {
    return resolveFromScript(spec);
  }

  // Priority 2: CLI-provided explicit config path
  if (spec.configPath) {
    return resolveFromConfig(spec);
  }

  // Priority 3: Use kitwe.yaml run section for entrypoint
  if (runConfig) {
    const result = resolveFromRunConfig(runConfig, spec);
    if (result) {
      return result;
    }
  }

  // Priority 4: No explicit entrypoint - return actionable error
  return {
    errorType: 'no_entrypoint',
    message: `Run entrypoint not configured.

An explicit entrypoint is required. Set one of:
  1. run.script in kitwe.yaml (e.g., 'test:e2e')
  2. run.config_path in kitwe.yaml (e.g., 'playwright.config.ts')
  3. CLI flag: --script <name> or --config <path>

Example kitwe.yaml:
  version: 1
  run:
    script: test:e2e

Or:
  version: 1
  run:
    config_path: playwright.config.ts`,
  };
}

/**
 * Resolve when spec.script is provided (CLI override).
 *
 * Runs: <runner> run <script> [args...]
 */
function resolveFromScript(spec: RunSpec): ResolvedCommand {
  const runner = spec.runner || detectPackageManager(spec.projectRoot);
  const argv = [runner, 'run', spec.script!];

  if (spec.args && spec.args.length > 0) {
    // For npm, need -- to pass args to the script
    if (runner === 'npm') {
      argv.push('--');
    }
    argv.push(...spec.args);
  }

  return {
    argv,
    cwd: spec.projectRoot,
    mode: 'cli_script',
    preCommands: extractPreCommands(spec),
  };
}

/**
 * Resolve when spec.configPath is provided (CLI override).
 *
 * Runs: npx playwright test --config=<path> [args...]
 */
function resolveFromConfig(spec: RunSpec): ResolveResult {
  const configPath = spec.configPath!;
  const configAbs = resolve(spec.projectRoot, configPath);

  if (!existsSync(configAbs)) {
    return {
      errorType: 'config_not_found',
      message: `Playwright config not found: ${configAbs}`,
    };
  }

  const argv = ['npx', 'playwright', 'test', `--config=${configPath}`];

  if (spec.args && spec.args.length > 0) {
    argv.push(...spec.args);
  }

  return {
    argv,
    cwd: spec.projectRoot,
    mode: 'cli_config',
    preCommands: extractPreCommands(spec),
  };
}

/**
 * Resolve from kitwe.yaml run configuration ONLY.
 *
 * This function reads ONLY RunConfig.
 * It NEVER accesses TestsConfig (test_dir, pattern, etc.).
 *
 * Returns null if run section has no explicit entrypoint.
 */
function resolveFromRunConfig(
  runConfig: NonNullable<ReturnType<typeof loadRunConfig>>,
  spec: RunSpec
): ResolveResult | null {
  // Check if explicit entrypoint is configured
  const hasEntrypoint = runConfig.script || runConfig.configPath;
  if (!hasEntrypoint) {
    return null;
  }

  const preCommands = extractPreCommands(spec);

  // Try script first (takes precedence over config_path)
  if (runConfig.script) {
    const runner = runConfig.runner || detectPackageManager(spec.projectRoot);
    const argv = [runner, 'run', runConfig.script];

    // Merge args: config args + CLI args
    const allArgs: string[] = [];
    if (runConfig.args && runConfig.args.length > 0) {
      allArgs.push(...runConfig.args);
    }
    if (spec.args && spec.args.length > 0) {
      allArgs.push(...spec.args);
    }

    if (allArgs.length > 0) {
      if (runner === 'npm') {
        argv.push('--');
      }
      argv.push(...allArgs);
    }

    return {
      argv,
      cwd: spec.projectRoot,
      mode: 'yaml_script',
      env: runConfig.env,
      preCommands,
    };
  }

  // Try config_path
  if (runConfig.configPath) {
    const configAbs = resolve(spec.projectRoot, runConfig.configPath);

    if (!existsSync(configAbs)) {
      return {
        errorType: 'config_not_found',
        message: `Playwright config from kitwe.yaml not found: ${configAbs}`,
      };
    }

    const argv = ['npx', 'playwright', 'test', `--config=${runConfig.configPath}`];

    // Merge args: config args + CLI args
    const allArgs: string[] = [];
    if (runConfig.args && runConfig.args.length > 0) {
      allArgs.push(...runConfig.args);
    }
    if (spec.args && spec.args.length > 0) {
      allArgs.push(...spec.args);
    }

    if (allArgs.length > 0) {
      argv.push(...allArgs);
    }

    return {
      argv,
      cwd: spec.projectRoot,
      mode: 'yaml_config',
      env: runConfig.env,
      preCommands,
    };
  }

  return null;
}
