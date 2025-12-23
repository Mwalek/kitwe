/**
 * Main executor for the Validate module.
 *
 * Runs Playwright tests deterministically and returns structured results.
 * No AI/LLM reasoning - pure subprocess execution.
 *
 * Explicit entrypoint required. No auto-detection.
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import type { RunSpec, RunResult, RunStatus, ArtifactInfo, PreCommand } from '../types/index.js';
import {
  resolveRunSpec,
  isResolvedError,
  type ResolvedCommand,
} from './resolver.js';

// =============================================================================
// Constants
// =============================================================================

/** Default timeout for pre_commands (5 minutes) */
const PRE_COMMAND_TIMEOUT_MS = 5 * 60 * 1000;

// =============================================================================
// Pre-command Execution
// =============================================================================

/**
 * Run pre_commands sequentially before main test execution.
 *
 * Each command runs in its own subprocess with specified cwd and env.
 * Fails fast on first error.
 */
async function runPreCommands(
  preCommands: PreCommand[],
  baseEnv: NodeJS.ProcessEnv,
  logsDir: string,
  onProgress?: (step: string, detail: string) => void
): Promise<{ success: boolean; error?: string; logPath?: string }> {
  for (let i = 0; i < preCommands.length; i++) {
    const pc = preCommands[i];
    const logPath = join(logsDir, `pre_command_${i}.log`);
    const cmdStr = pc.argv.join(' ');

    if (onProgress) {
      onProgress('pre_command', `[${i + 1}/${preCommands.length}] ${cmdStr}`);
    }

    // Merge base env with command-specific env
    const cmdEnv = { ...baseEnv };
    if (pc.env) {
      Object.assign(cmdEnv, pc.env);
    }

    try {
      const result = await runCommand(pc.argv, {
        cwd: pc.cwd ?? process.cwd(),
        env: cmdEnv,
        timeoutMs: PRE_COMMAND_TIMEOUT_MS,
        logPath,
      });

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Pre-command ${i} failed with exit code ${result.exitCode}: ${cmdStr}\nSee log: ${logPath}`,
          logPath,
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Pre-command ${i} error: ${errorMsg}`,
        logPath,
      };
    }
  }

  return { success: true };
}

// =============================================================================
// Command Execution
// =============================================================================

interface CommandOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  logPath?: string;
}

interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

/**
 * Run a command with timeout and capture output.
 */
function runCommand(
  argv: string[],
  options: CommandOptions
): Promise<CommandResult> {
  return new Promise((resolvePromise) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child: ChildProcess | null = null;

    const [cmd, ...args] = argv;

    // Use login shell to ensure user's shell profile is loaded (nvm, etc.)
    // This is critical for MCP context where Claude Desktop may use old Node
    const userShell = options.env?.SHELL || '/bin/zsh';
    const fullCommand = [cmd, ...args].join(' ');

    child = spawn(userShell, ['-l', '-c', fullCommand], {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      if (child) {
        child.kill('SIGTERM');
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (child && !child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }
    }, options.timeoutMs);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      // Write to log if specified
      if (options.logPath) {
        const logContent = `# Command: ${argv.join(' ')}\n# CWD: ${options.cwd}\n# Error: ${err.message}\n\n${stdout}\n\n--- STDERR ---\n${stderr}`;
        writeFileSync(options.logPath, logContent);
      }

      resolvePromise({
        exitCode: null,
        stdout,
        stderr: stderr + '\n' + err.message,
        timedOut: false,
        durationMs,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      // Write to log if specified
      if (options.logPath) {
        const logContent = `# Command: ${argv.join(' ')}\n# CWD: ${options.cwd}\n# Exit code: ${code}\n# Duration: ${durationMs}ms\n${'='.repeat(60)}\n\n${stdout}\n\n--- STDERR ---\n${stderr}`;
        writeFileSync(options.logPath, logContent);
      }

      resolvePromise({
        exitCode: code,
        stdout,
        stderr,
        timedOut,
        durationMs,
      });
    });
  });
}

// =============================================================================
// Artifact Collection
// =============================================================================

/**
 * Collect artifacts from the test run.
 */
function collectArtifacts(projectRoot: string, outputDir: string): ArtifactInfo[] {
  const artifacts: ArtifactInfo[] = [];

  // Check common Playwright output locations
  const searchDirs = [
    join(projectRoot, 'test-results'),
    join(projectRoot, 'playwright-report'),
    outputDir,
  ];

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;

    try {
      collectArtifactsFromDir(dir, artifacts);
    } catch {
      // Ignore errors reading directories
    }
  }

  return artifacts;
}

/**
 * Recursively collect artifacts from a directory.
 */
function collectArtifactsFromDir(dir: string, artifacts: ArtifactInfo[], depth = 0): void {
  if (depth > 3) return; // Limit recursion depth

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    try {
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        collectArtifactsFromDir(fullPath, artifacts, depth + 1);
      } else if (stat.isFile()) {
        const type = getArtifactType(entry);
        if (type) {
          artifacts.push({
            type,
            path: fullPath,
            name: entry,
            size: stat.size,
          });
        }
      }
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Determine artifact type from filename.
 */
function getArtifactType(filename: string): ArtifactInfo['type'] | null {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'screenshot';
  }
  if (lower.endsWith('.zip') && lower.includes('trace')) {
    return 'trace';
  }
  if (lower.endsWith('.webm') || lower.endsWith('.mp4')) {
    return 'video';
  }
  if (lower.endsWith('.html') && lower.includes('report')) {
    return 'report';
  }
  if (lower.endsWith('.json') && lower.includes('report')) {
    return 'report';
  }

  return null;
}

// =============================================================================
// Main Executor
// =============================================================================

/**
 * Progress callback type.
 */
export type ProgressCallback = (step: string, detail: string) => void;

/**
 * Main entry point: Run Playwright validation deterministically.
 *
 * Steps:
 * 1. Create artifacts directory
 * 2. Resolve command from RunSpec
 * 3. Run pre_commands (if any) - db setup, docker, migrations
 * 4. Execute Playwright with timeout
 * 5. Collect artifacts
 * 6. Return schema-valid result
 */
export async function runValidate(
  spec: RunSpec,
  onProgress?: ProgressCallback
): Promise<RunResult> {
  const startedAt = new Date();
  const projectRoot = spec.projectRoot;

  // Create artifacts directory
  const artifactsDir = resolve(projectRoot, spec.artifactsDir);
  const logsDir = join(artifactsDir, 'logs');
  const reportsDir = join(artifactsDir, 'reports');

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });

  if (onProgress) {
    onProgress('resolve', 'Resolving test command...');
  }

  // Resolve what command to run
  const resolved = resolveRunSpec(spec);

  if (isResolvedError(resolved)) {
    return createErrorResult(startedAt, projectRoot, resolved.errorType, resolved.message);
  }

  // Build environment
  const runEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CI: 'true',
    PLAYWRIGHT_HTML_OPEN: 'never',
  };

  // Merge user-provided environment variables
  if (spec.env) {
    Object.assign(runEnv, spec.env);
  }

  // Merge config environment variables
  if (resolved.env) {
    Object.assign(runEnv, resolved.env);
  }

  // Run pre_commands if any
  if (resolved.preCommands && resolved.preCommands.length > 0) {
    if (onProgress) {
      onProgress('setup', `Running ${resolved.preCommands.length} setup command(s)...`);
    }

    const preResult = await runPreCommands(
      resolved.preCommands,
      runEnv,
      logsDir,
      onProgress
    );

    if (!preResult.success) {
      return createErrorResult(
        startedAt,
        projectRoot,
        'pre_command_failed',
        preResult.error || 'Pre-command failed'
      );
    }
  }

  // Prepare command with reporter injection
  const finalArgv = prepareCommandWithReporter(resolved);

  if (onProgress) {
    const cmdDisplay = finalArgv.slice(0, 3).join(' ') + (finalArgv.length > 3 ? '...' : '');
    onProgress('execute', `Running tests: ${cmdDisplay}`);
  }

  // Execute the command
  const timeoutMs = spec.timeoutSeconds * 1000;
  const stdoutPath = join(logsDir, 'stdout.log');
  const stderrPath = join(logsDir, 'stderr.log');

  let result: CommandResult;

  try {
    result = await runCommand(finalArgv, {
      cwd: resolved.cwd,
      env: runEnv,
      timeoutMs,
    });

    // Write stdout/stderr to files
    writeFileSync(stdoutPath, result.stdout);
    writeFileSync(stderrPath, result.stderr);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return createErrorResult(startedAt, projectRoot, 'execution_error', errorMsg);
  }

  if (onProgress) {
    onProgress('collect', 'Collecting artifacts...');
  }

  // Collect artifacts
  const artifacts = collectArtifacts(projectRoot, spec.outputDir || 'test-results');

  // Determine status
  let status: RunStatus;
  const errors: Array<{ type: string; message: string }> = [];

  if (result.timedOut) {
    status = 'timeout';
    errors.push({
      type: 'timeout',
      message: `Execution exceeded ${spec.timeoutSeconds}s timeout`,
    });
  } else if (result.exitCode === null) {
    status = 'error';
    errors.push({
      type: 'execution_error',
      message: 'Process terminated abnormally',
    });
  } else if (result.exitCode === 0) {
    status = 'passed';
  } else {
    status = 'failed';
  }

  if (onProgress) {
    onProgress('complete', `Tests ${status}`);
  }

  return {
    status,
    exitCode: result.exitCode ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
    artifacts,
    command: finalArgv,
    error: errors.length > 0 ? errors.map(e => e.message).join('\n') : undefined,
  };
}

/**
 * Prepare command, injecting non-blocking reporter for ALL Playwright runs.
 *
 * The --reporter CLI flag OVERRIDES the reporter setting in playwright.config.
 * This prevents HTML reporter from starting a blocking web server.
 */
function prepareCommandWithReporter(resolved: ResolvedCommand): string[] {
  const argv = [...resolved.argv];
  const argvStr = argv.join(' ');

  // Build list of flags to inject
  const flagsToInject: string[] = [];

  // Reporter flag (skip if already specified)
  if (!argvStr.includes('--reporter')) {
    flagsToInject.push('--reporter=list');
  }

  // Trace flag (skip if already specified)
  if (!argvStr.includes('--trace')) {
    flagsToInject.push('--trace=retain-on-failure');
  }

  // Nothing to inject
  if (flagsToInject.length === 0) {
    return argv;
  }

  const scriptModes = ['yaml_script', 'cli_script'];
  const directModes = ['cli_config', 'yaml_config'];

  if (scriptModes.includes(resolved.mode)) {
    // npm/pnpm/yarn script mode: need "--" separator before Playwright args
    if (!argv.includes('--')) {
      argv.push('--');
    }
    argv.push(...flagsToInject);
  } else if (directModes.includes(resolved.mode)) {
    // Direct npx playwright test mode: append directly
    argv.push(...flagsToInject);
  }

  return argv;
}

/**
 * Create a RunResult for errors.
 */
function createErrorResult(
  startedAt: Date,
  _projectRoot: string,
  errorType: string,
  errorMessage: string
): RunResult {
  const durationMs = Date.now() - startedAt.getTime();

  return {
    status: 'error',
    exitCode: -1,
    stdout: '',
    stderr: '',
    durationMs,
    artifacts: [],
    error: `[${errorType}] ${errorMessage}`,
  };
}
