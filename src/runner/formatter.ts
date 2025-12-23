/**
 * Reporter module for formatting RunResult into user-facing output.
 *
 * Provides deterministic, predictable formatting with zero AI reasoning.
 * Never modifies tests, never reruns them, never invents details.
 */

import chalk from 'chalk';
import type { RunResult, RunStatus, ArtifactInfo } from '../types/index.js';
import { parseJsonReport, findJsonReport, type TestSummary } from '../core/artifacts.js';

// =============================================================================
// Types
// =============================================================================

export enum Verbosity {
  NORMAL = 'normal',
  VERBOSE = 'verbose',
}

export interface ReportContext {
  /** Current attempt number (1-indexed) */
  attempt?: number;
  /** Maximum retry attempts allowed */
  maxAttempts?: number;
  /** Project root path for relative path display */
  projectRoot?: string;
  /** Directory where artifacts are stored */
  artifactsDir?: string;
  /** Output detail level */
  verbosity?: Verbosity;
}

export interface ReportOutput {
  /** Exit code: 0 for passed, 1 for any failure/error */
  exitCode: number;
  /** Single-line status headline with emoji */
  headline: string;
  /** Full formatted message for CLI output */
  message: string;
  /** Key details for programmatic access */
  highlights: Record<string, string | number | boolean | null>;
}

export interface FailureInfo {
  title: string;
  message?: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  stack?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum stdout/stderr lines to show */
const MAX_OUTPUT_LINES = 20;

// =============================================================================
// ReportFormatter Class
// =============================================================================

/**
 * Deterministic formatter for RunResult objects.
 *
 * Converts structured test results into predictable CLI output.
 * No AI reasoning, no test modifications, no external calls.
 */
export class ReportFormatter {
  private result: RunResult;
  private context: Required<ReportContext>;
  private summary: TestSummary | null = null;

  constructor(result: RunResult, context: ReportContext = {}) {
    this.result = result;
    this.context = {
      attempt: context.attempt ?? 0,
      maxAttempts: context.maxAttempts ?? 0,
      projectRoot: context.projectRoot ?? '',
      artifactsDir: context.artifactsDir ?? '',
      verbosity: context.verbosity ?? Verbosity.NORMAL,
    };

    // Try to extract summary from JSON report if available
    if (this.context.projectRoot) {
      const jsonReport = findJsonReport(this.context.projectRoot);
      if (jsonReport) {
        this.summary = parseJsonReport(jsonReport);
      }
    }
  }

  /**
   * Format the RunResult into a ReportOutput.
   */
  format(): ReportOutput {
    const lines: string[] = [];

    // Headline
    const headline = this.getHeadline();
    lines.push(headline);
    lines.push('');

    // Attempt info (only if provided)
    const attemptLine = this.formatAttempt();
    if (attemptLine) {
      lines.push(attemptLine);
    }

    // Duration and exit code
    lines.push(this.formatTiming());
    lines.push(`Exit code: ${this.result.exitCode}`);

    // Summary (if we have parsed it from JSON report)
    if (this.summary) {
      lines.push('');
      lines.push(this.formatSummary());
    }

    // Artifacts block
    const artifactsBlock = this.formatArtifacts();
    if (artifactsBlock.length > 0) {
      lines.push('');
      lines.push(...artifactsBlock);
    }

    // Error details
    if (this.result.error) {
      lines.push('');
      lines.push(chalk.red('Error:'));
      lines.push(chalk.red(`  ${this.result.error}`));
    }

    // Verbose: show stdout/stderr excerpts
    if (this.context.verbosity === Verbosity.VERBOSE) {
      const outputBlock = this.formatOutput();
      if (outputBlock.length > 0) {
        lines.push('');
        lines.push(...outputBlock);
      }

      // Command used
      if (this.result.command) {
        lines.push('');
        lines.push(chalk.gray(`Command: ${this.result.command.join(' ')}`));
      }
    }

    const message = lines.join('\n');
    const exitCode = this.result.status === 'passed' ? 0 : 1;

    return {
      exitCode,
      headline,
      message,
      highlights: this.getHighlights(),
    };
  }

  // ===========================================================================
  // Formatting Methods
  // ===========================================================================

  private getHeadline(): string {
    const total = this.summary?.total ?? 0;
    const failed = this.summary?.failed ?? 0;

    switch (this.result.status) {
      case 'passed':
        if (total > 0) {
          return chalk.green(`✓ ${total} TEST${total !== 1 ? 'S' : ''} PASSED`);
        }
        return chalk.green('✓ Tests PASSED');

      case 'failed':
        if (total > 0) {
          return chalk.red(`✗ ${failed}/${total} TEST${total !== 1 ? 'S' : ''} FAILED`);
        }
        return chalk.red('✗ Tests FAILED');

      case 'timeout':
        return chalk.yellow('⏱ Tests TIMED OUT');

      case 'error':
        return chalk.red('⚠ Test run ERROR');

      default:
        return chalk.gray('? Unknown status');
    }
  }

  private formatAttempt(): string | null {
    if (this.context.attempt > 0 && this.context.maxAttempts > 0) {
      return `Attempt: ${this.context.attempt}/${this.context.maxAttempts}`;
    }
    return null;
  }

  private formatTiming(): string {
    const durationSec = (this.result.durationMs / 1000).toFixed(2);
    return `Duration: ${durationSec}s`;
  }

  private formatSummary(): string {
    if (!this.summary) return '';

    const parts = [
      `total=${this.summary.total}`,
      `passed=${this.summary.passed}`,
      `failed=${this.summary.failed}`,
    ];

    if (this.summary.skipped > 0) {
      parts.push(`skipped=${this.summary.skipped}`);
    }

    if (this.summary.flaky > 0) {
      parts.push(`flaky=${this.summary.flaky}`);
    }

    return `Summary: ${parts.join(', ')}`;
  }

  private formatArtifacts(): string[] {
    const lines: string[] = [];
    const artifacts = this.result.artifacts;

    if (!artifacts || artifacts.length === 0) {
      return lines;
    }

    lines.push('Artifacts:');

    // Group by type
    const byType: Record<string, ArtifactInfo[]> = {};
    for (const artifact of artifacts) {
      if (!byType[artifact.type]) {
        byType[artifact.type] = [];
      }
      byType[artifact.type].push(artifact);
    }

    // Display order
    const typeOrder: ArtifactInfo['type'][] = ['report', 'screenshot', 'trace', 'video'];

    for (const type of typeOrder) {
      const items = byType[type];
      if (!items || items.length === 0) continue;

      for (const item of items) {
        const relativePath = this.context.projectRoot
          ? item.path.replace(this.context.projectRoot, '.')
          : item.path;
        lines.push(`  ${type}: ${relativePath}`);
      }
    }

    return lines;
  }

  private formatOutput(): string[] {
    const lines: string[] = [];

    if (this.result.stdout && this.result.stdout.trim()) {
      lines.push(chalk.gray('--- STDOUT (last 20 lines) ---'));
      const stdoutLines = this.result.stdout.split('\n').slice(-MAX_OUTPUT_LINES);
      lines.push(chalk.gray(stdoutLines.join('\n')));
    }

    if (this.result.stderr && this.result.stderr.trim()) {
      lines.push(chalk.gray('--- STDERR (last 20 lines) ---'));
      const stderrLines = this.result.stderr.split('\n').slice(-MAX_OUTPUT_LINES);
      lines.push(chalk.gray(stderrLines.join('\n')));
    }

    return lines;
  }

  private getHighlights(): Record<string, string | number | boolean | null> {
    return {
      status: this.result.status,
      exitCode: this.result.exitCode,
      durationMs: this.result.durationMs,
      artifactCount: this.result.artifacts?.length ?? 0,
      hasError: !!this.result.error,
      totalTests: this.summary?.total ?? null,
      passedTests: this.summary?.passed ?? null,
      failedTests: this.summary?.failed ?? null,
    };
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Format a RunResult for CLI output.
 */
export function formatResult(
  result: RunResult,
  context?: ReportContext
): ReportOutput {
  const formatter = new ReportFormatter(result, context);
  return formatter.format();
}

/**
 * Print a RunResult to the console.
 */
export function printResult(
  result: RunResult,
  context?: ReportContext
): void {
  const output = formatResult(result, context);
  console.log(output.message);
}

// =============================================================================
// Simple Status Formatting
// =============================================================================

/**
 * Get a colored status string.
 */
export function formatStatus(status: RunStatus): string {
  switch (status) {
    case 'passed':
      return chalk.green('PASSED');
    case 'failed':
      return chalk.red('FAILED');
    case 'timeout':
      return chalk.yellow('TIMEOUT');
    case 'error':
      return chalk.red('ERROR');
    default:
      return chalk.gray('UNKNOWN');
  }
}

/**
 * Get a status icon.
 */
export function formatStatusIcon(status: RunStatus): string {
  switch (status) {
    case 'passed':
      return chalk.green('✓');
    case 'failed':
      return chalk.red('✗');
    case 'timeout':
      return chalk.yellow('⏱');
    case 'error':
      return chalk.red('⚠');
    default:
      return chalk.gray('?');
  }
}

/**
 * Format duration in a human-readable way.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format file size in a human-readable way.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// Progress Formatting
// =============================================================================

/**
 * Format a progress step for verbose output.
 */
export function formatProgressStep(step: string, detail: string): string {
  const stepColors: Record<string, (s: string) => string> = {
    resolve: chalk.blue,
    setup: chalk.yellow,
    pre_command: chalk.yellow,
    execute: chalk.cyan,
    collect: chalk.magenta,
    complete: chalk.green,
    error: chalk.red,
  };

  const colorFn = stepColors[step] || chalk.white;
  return `${colorFn(`[${step}]`)} ${detail}`;
}

/**
 * Create a progress callback that formats and prints steps.
 */
export function createProgressPrinter(): (step: string, detail: string) => void {
  return (step: string, detail: string) => {
    console.log(formatProgressStep(step, detail));
  };
}
