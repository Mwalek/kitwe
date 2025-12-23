/**
 * Run command
 *
 * kitwe run --project <name> --script <script>
 * kitwe run --project <name> --config <path>
 * kitwe run --project <name> <spec-file>
 */

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import chalk from 'chalk';
import { resolveProjectRoot, ProjectRootError } from '../core/paths.js';
import { loadRunConfig } from '../core/config.js';
import { runValidate } from '../runner/executor.js';
import type { RunSpec, RunnerType, RunResult } from '../types/index.js';

export function createRunCommand(): Command {
  const cmd = new Command('run')
    .description('Run Playwright tests and return structured results')
    .argument('[spec-file]', 'Spec file name or path (optional)')
    .option('-p, --project-root <path>', 'Path to the project root directory')
    .option('--project <name>', 'Registered project name')
    .option('-s, --script <name>', 'npm script name to run (e.g., test:e2e)')
    .option('-c, --config <path>', 'Path to Playwright config')
    .option('-t, --timeout <seconds>', 'Maximum execution time in seconds', '1200')
    .option('-a, --artifacts-dir <path>', 'Directory to write artifacts')
    .option('-r, --runner <type>', 'Package manager: npm, pnpm, yarn, npx')
    .option('--args <args...>', 'Additional arguments to pass to Playwright')
    .option('-j, --json-out <path>', 'Write result JSON to this path')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress progress output')
    .option('--skip-setup', 'Skip pre_commands')
    .action(async (specFile: string | undefined, options: {
      projectRoot?: string;
      project?: string;
      script?: string;
      config?: string;
      timeout?: string;
      artifactsDir?: string;
      runner?: string;
      args?: string[];
      jsonOut?: string;
      verbose?: boolean;
      quiet?: boolean;
      skipSetup?: boolean;
    }) => {
      try {
        // Resolve project root
        const projectRoot = resolveProjectRoot({
          project: options.project,
          projectRoot: options.projectRoot,
        });

        // Load config for defaults
        const runConfig = loadRunConfig(projectRoot);

        // Build RunSpec from CLI options + config defaults
        const spec: RunSpec = {
          projectRoot,
          artifactsDir: options.artifactsDir
            || runConfig?.artifactsDir
            || 'artifacts/kitwe',
          timeoutSeconds: parseInt(options.timeout || '1200', 10),
          script: options.script,
          configPath: options.config,
          runner: parseRunner(options.runner) || runConfig?.runner,
          args: buildArgs(options.args, specFile),
          env: runConfig?.env,
          skipSetup: options.skipSetup,
          outputDir: runConfig?.outputDir,
        };

        // Show what we're about to do
        if (options.verbose) {
          console.log(chalk.cyan('Run configuration:'));
          console.log(`  Project root: ${projectRoot}`);
          if (spec.script) console.log(`  Script: ${spec.script}`);
          if (spec.configPath) console.log(`  Config: ${spec.configPath}`);
          console.log(`  Timeout: ${spec.timeoutSeconds}s`);
          console.log(`  Artifacts: ${spec.artifactsDir}`);
          if (specFile) console.log(`  Spec file: ${specFile}`);
          console.log('');
        }

        // Track step timing
        const stepStartTimes: Record<string, number> = {};

        // Progress callback - always enabled unless --quiet
        const onProgress = options.quiet
          ? undefined
          : (step: string, detail: string) => {
              const now = Date.now();

              // Show step completion time for previous step if applicable
              const prevStep = Object.keys(stepStartTimes).pop();
              if (prevStep && prevStep !== step && stepStartTimes[prevStep]) {
                const elapsed = ((now - stepStartTimes[prevStep]) / 1000).toFixed(1);
                if (options.verbose) {
                  console.log(chalk.gray(`  └─ completed in ${elapsed}s`));
                }
              }

              // Record start time for this step
              stepStartTimes[step] = now;

              // Step icons and colors
              const stepConfig: Record<string, { icon: string; color: (s: string) => string }> = {
                resolve: { icon: '🔍', color: chalk.blue },
                setup: { icon: '🔧', color: chalk.yellow },
                pre_command: { icon: '⚙️ ', color: chalk.yellow },
                execute: { icon: '▶️ ', color: chalk.cyan },
                collect: { icon: '📦', color: chalk.magenta },
                complete: { icon: '✅', color: chalk.green },
              };

              const config = stepConfig[step] || { icon: '•', color: chalk.white };

              if (options.verbose) {
                // Verbose: show full detail with step name
                console.log(`${config.icon} ${config.color(`[${step}]`)} ${detail}`);
              } else {
                // Normal: show concise progress
                console.log(`${config.icon} ${detail}`);
              }
            };

        // Initial message
        if (!options.quiet) {
          console.log(chalk.cyan.bold('Kitwe') + chalk.gray(' — Running tests'));
          console.log('');
        }

        const result = await runValidate(spec, onProgress);

        // Add spacing before results
        if (!options.quiet) {
          console.log('');
        }

        // Output results
        printResult(result, options.verbose);

        // Write JSON output if requested
        if (options.jsonOut) {
          writeFileSync(options.jsonOut, JSON.stringify(result, null, 2));
          console.log('');
          console.log(chalk.gray(`Results written to: ${options.jsonOut}`));
        }

        // Exit with appropriate code
        if (result.status === 'passed') {
          process.exit(0);
        } else {
          process.exit(1);
        }
      } catch (error) {
        handleError(error);
      }
    });

  return cmd;
}

// =============================================================================
// Helper Functions
// =============================================================================

function parseRunner(runner: string | undefined): RunnerType | undefined {
  if (!runner) return undefined;
  const valid: RunnerType[] = ['npm', 'pnpm', 'yarn', 'npx'];
  if (valid.includes(runner as RunnerType)) {
    return runner as RunnerType;
  }
  console.error(chalk.red(`Invalid runner: ${runner}. Use: npm, pnpm, yarn, or npx`));
  process.exit(1);
}

function buildArgs(args: string[] | undefined, specFile: string | undefined): string[] | undefined {
  const result: string[] = [];

  if (args && args.length > 0) {
    result.push(...args);
  }

  if (specFile) {
    result.push(specFile);
  }

  return result.length > 0 ? result : undefined;
}

function printResult(result: RunResult, verbose?: boolean): void {
  // Status banner
  const statusColors: Record<string, (s: string) => string> = {
    passed: chalk.green,
    failed: chalk.red,
    error: chalk.red,
    timeout: chalk.yellow,
  };
  const colorFn = statusColors[result.status] || chalk.white;
  const statusIcon = result.status === 'passed' ? '✓' : '✗';

  console.log(colorFn(`${statusIcon} Tests ${result.status.toUpperCase()}`));
  console.log('');

  // Duration
  const durationSec = (result.durationMs / 1000).toFixed(2);
  console.log(`Duration: ${durationSec}s`);
  console.log(`Exit code: ${result.exitCode}`);

  // Artifacts
  if (result.artifacts.length > 0) {
    console.log('');
    console.log('Artifacts:');
    for (const artifact of result.artifacts) {
      console.log(`  ${artifact.type}: ${artifact.path}`);
    }
  }

  // Error details
  if (result.error) {
    console.log('');
    console.log(chalk.red('Error:'));
    console.log(chalk.red(`  ${result.error}`));
  }

  // Verbose: show stdout/stderr excerpts
  if (verbose && (result.stdout || result.stderr)) {
    if (result.stdout) {
      console.log('');
      console.log(chalk.gray('--- STDOUT (last 20 lines) ---'));
      const lines = result.stdout.split('\n').slice(-20);
      console.log(chalk.gray(lines.join('\n')));
    }
    if (result.stderr && result.stderr.trim()) {
      console.log('');
      console.log(chalk.gray('--- STDERR (last 20 lines) ---'));
      const lines = result.stderr.split('\n').slice(-20);
      console.log(chalk.gray(lines.join('\n')));
    }
  }
}

function handleError(error: unknown): never {
  if (error instanceof ProjectRootError) {
    console.error(chalk.red('Error: ') + error.message);
    process.exit(1);
  }
  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
  throw error;
}
