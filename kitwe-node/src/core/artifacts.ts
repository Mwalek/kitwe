/**
 * Artifacts directory management for Kitwe.
 *
 * Organizes outputs by test name:
 *     artifacts/kitwe/
 *     └── {test-name}/
 *         ├── logs/               # Test execution logs
 *         │   ├── stdout.log
 *         │   └── stderr.log
 *         └── reports/            # Machine-readable reports
 *             └── playwright-report.json
 */

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import type { ArtifactInfo } from '../types/index.js';

// =============================================================================
// ArtifactsDir Class
// =============================================================================

/**
 * Manages the artifacts directory structure for a specific test.
 *
 * Usage:
 *   // For a specific test
 *   const artifacts = new ArtifactsDir('/path/to/artifacts/kitwe', 'login-test');
 *   artifacts.ensureDirs();
 *
 *   // Get paths for different artifact types
 *   artifacts.logs      // -> artifacts/kitwe/login-test/logs
 *   artifacts.reports   // -> artifacts/kitwe/login-test/reports
 *
 *   // For base-level operations (before test name is known)
 *   const artifacts = new ArtifactsDir('/path/to/artifacts/kitwe');
 *   artifacts.ensureBase();
 */
export class ArtifactsDir {
  /** Base artifacts directory (e.g., artifacts/kitwe) */
  readonly base: string;

  /** Optional test name for organizing outputs */
  readonly testName: string | undefined;

  constructor(basePath: string, testName?: string) {
    this.base = resolve(basePath);
    this.testName = testName;
  }

  // ===========================================================================
  // Path Properties
  // ===========================================================================

  /**
   * Directory for this specific test's artifacts.
   * @throws Error if testName is not set
   */
  get testDir(): string {
    if (!this.testName) {
      throw new Error('testName required for testDir access');
    }
    return join(this.base, this.testName);
  }

  /**
   * Directory for test execution logs (stdout, stderr).
   */
  get logs(): string {
    return join(this.testDir, 'logs');
  }

  /**
   * Directory for machine-readable reports (JSON, JUnit).
   */
  get reports(): string {
    return join(this.testDir, 'reports');
  }

  // ===========================================================================
  // Directory Management
  // ===========================================================================

  /**
   * Create all artifact subdirectories for this test.
   * @throws Error if testName is not set
   */
  ensureDirs(): void {
    if (!this.testName) {
      throw new Error('testName required for ensureDirs');
    }
    mkdirSync(this.testDir, { recursive: true });
    mkdirSync(this.logs, { recursive: true });
    mkdirSync(this.reports, { recursive: true });
  }

  /**
   * Create only the base directory (before test name is known).
   */
  ensureBase(): void {
    mkdirSync(this.base, { recursive: true });
  }

  /**
   * Create a new ArtifactsDir instance with a specific test name.
   *
   * Useful when the test name becomes known after initial creation.
   */
  withTestName(testName: string): ArtifactsDir {
    return new ArtifactsDir(this.base, testName);
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * List all test names that have artifacts.
   */
  listTests(): string[] {
    if (!existsSync(this.base)) {
      return [];
    }

    try {
      const entries = readdirSync(this.base);
      return entries.filter(entry => {
        if (entry.startsWith('.')) return false;
        const fullPath = join(this.base, entry);
        try {
          return statSync(fullPath).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }

  /**
   * Check if this test has artifacts.
   */
  hasArtifacts(): boolean {
    if (!this.testName) return false;
    return existsSync(this.testDir);
  }
}

// =============================================================================
// Artifact Collection Functions
// =============================================================================

/**
 * Artifact type detection patterns.
 */
const ARTIFACT_PATTERNS: Array<{
  pattern: RegExp;
  type: ArtifactInfo['type'];
}> = [
  { pattern: /\.(png|jpg|jpeg|webp)$/i, type: 'screenshot' },
  { pattern: /trace.*\.zip$/i, type: 'trace' },
  { pattern: /\.(webm|mp4)$/i, type: 'video' },
  { pattern: /report.*\.html$/i, type: 'report' },
  { pattern: /report.*\.json$/i, type: 'report' },
  { pattern: /results.*\.json$/i, type: 'report' },
  { pattern: /junit.*\.xml$/i, type: 'report' },
];

/**
 * Determine artifact type from filename.
 */
export function getArtifactType(filename: string): ArtifactInfo['type'] | null {
  for (const { pattern, type } of ARTIFACT_PATTERNS) {
    if (pattern.test(filename)) {
      return type;
    }
  }
  return null;
}

/**
 * Collect artifacts from a directory recursively.
 */
export function collectArtifacts(
  searchDirs: string[],
  maxDepth = 3
): ArtifactInfo[] {
  const artifacts: ArtifactInfo[] = [];
  const visited = new Set<string>();

  function collectFromDir(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    if (!existsSync(dir)) return;
    if (visited.has(dir)) return;
    visited.add(dir);

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);

        try {
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            collectFromDir(fullPath, depth + 1);
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
          // Ignore errors for individual files
        }
      }
    } catch {
      // Ignore errors reading directory
    }
  }

  for (const dir of searchDirs) {
    collectFromDir(dir, 0);
  }

  return artifacts;
}

/**
 * Copy artifacts to a destination directory.
 */
export function copyArtifacts(
  artifacts: ArtifactInfo[],
  destDir: string
): ArtifactInfo[] {
  mkdirSync(destDir, { recursive: true });

  const copied: ArtifactInfo[] = [];

  for (const artifact of artifacts) {
    try {
      const destPath = join(destDir, artifact.name);
      copyFileSync(artifact.path, destPath);
      copied.push({
        ...artifact,
        path: destPath,
      });
    } catch {
      // Skip files that can't be copied
    }
  }

  return copied;
}

/**
 * Get standard Playwright output directories relative to project root.
 */
export function getPlaywrightOutputDirs(projectRoot: string): string[] {
  return [
    join(projectRoot, 'test-results'),
    join(projectRoot, 'playwright-report'),
  ];
}

/**
 * Find JSON report in standard locations.
 */
export function findJsonReport(projectRoot: string): string | null {
  const candidates = [
    join(projectRoot, 'test-results', 'results.json'),
    join(projectRoot, 'playwright-report', 'report.json'),
    join(projectRoot, 'test-results.json'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Parse JSON report and extract summary.
 */
export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  durationMs: number;
}

export function parseJsonReport(reportPath: string): TestSummary | null {
  try {
    const content = readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(content);

    // Playwright JSON report format
    if (report.stats) {
      return {
        total: report.stats.expected + report.stats.unexpected + report.stats.skipped + report.stats.flaky,
        passed: report.stats.expected,
        failed: report.stats.unexpected,
        skipped: report.stats.skipped,
        flaky: report.stats.flaky,
        durationMs: report.stats.duration,
      };
    }

    // Simple format with suites
    if (Array.isArray(report.suites)) {
      let passed = 0;
      let failed = 0;
      const skipped = 0;

      function countSpecs(suites: any[]): void {
        for (const suite of suites) {
          if (suite.specs) {
            for (const spec of suite.specs) {
              if (spec.ok) passed++;
              else failed++;
            }
          }
          if (suite.suites) {
            countSpecs(suite.suites);
          }
        }
      }

      countSpecs(report.suites);

      return {
        total: passed + failed + skipped,
        passed,
        failed,
        skipped,
        flaky: 0,
        durationMs: 0,
      };
    }

    return null;
  } catch {
    return null;
  }
}
