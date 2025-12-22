/**
 * Unit tests for the artifacts module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  ArtifactsDir,
  getArtifactType,
  collectArtifacts,
  getPlaywrightOutputDirs,
  findJsonReport,
  parseJsonReport,
} from '../src/core/artifacts.js';

describe('artifacts', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kitwe-artifacts-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('ArtifactsDir', () => {
    it('creates instance with base path only', () => {
      const artifacts = new ArtifactsDir(tempDir);

      expect(artifacts.base).toBe(tempDir);
      expect(artifacts.testName).toBeUndefined();
    });

    it('creates instance with test name', () => {
      const artifacts = new ArtifactsDir(tempDir, 'login-test');

      expect(artifacts.base).toBe(tempDir);
      expect(artifacts.testName).toBe('login-test');
      expect(artifacts.testDir).toBe(join(tempDir, 'login-test'));
    });

    it('throws when accessing testDir without testName', () => {
      const artifacts = new ArtifactsDir(tempDir);

      expect(() => artifacts.testDir).toThrow('testName required');
    });

    it('provides correct path properties', () => {
      const artifacts = new ArtifactsDir(tempDir, 'my-test');

      expect(artifacts.logs).toBe(join(tempDir, 'my-test', 'logs'));
      expect(artifacts.reports).toBe(join(tempDir, 'my-test', 'reports'));
    });

    it('ensureDirs creates all subdirectories', () => {
      const artifacts = new ArtifactsDir(tempDir, 'ensure-test');

      artifacts.ensureDirs();

      expect(existsSync(artifacts.testDir)).toBe(true);
      expect(existsSync(artifacts.logs)).toBe(true);
      expect(existsSync(artifacts.reports)).toBe(true);
    });

    it('ensureBase creates only base directory', () => {
      const basePath = join(tempDir, 'new-base');
      const artifacts = new ArtifactsDir(basePath);

      artifacts.ensureBase();

      expect(existsSync(basePath)).toBe(true);
    });

    it('withTestName creates new instance with test name', () => {
      const artifacts = new ArtifactsDir(tempDir);
      const withName = artifacts.withTestName('new-test');

      expect(withName.base).toBe(tempDir);
      expect(withName.testName).toBe('new-test');
    });

    it('listTests returns test directories', () => {
      mkdirSync(join(tempDir, 'test-a'));
      mkdirSync(join(tempDir, 'test-b'));
      mkdirSync(join(tempDir, 'test-c'));
      writeFileSync(join(tempDir, 'not-a-dir.txt'), '');

      const artifacts = new ArtifactsDir(tempDir);
      const tests = artifacts.listTests();

      expect(tests).toContain('test-a');
      expect(tests).toContain('test-b');
      expect(tests).toContain('test-c');
      expect(tests).not.toContain('not-a-dir.txt');
    });

    it('hasArtifacts returns true when testDir exists', () => {
      mkdirSync(join(tempDir, 'existing-test'));
      const artifacts = new ArtifactsDir(tempDir, 'existing-test');

      expect(artifacts.hasArtifacts()).toBe(true);
    });

    it('hasArtifacts returns false when testDir does not exist', () => {
      const artifacts = new ArtifactsDir(tempDir, 'nonexistent');

      expect(artifacts.hasArtifacts()).toBe(false);
    });

  });

  describe('getArtifactType', () => {
    it('detects screenshots', () => {
      expect(getArtifactType('failure.png')).toBe('screenshot');
      expect(getArtifactType('test.jpg')).toBe('screenshot');
      expect(getArtifactType('image.webp')).toBe('screenshot');
    });

    it('detects traces', () => {
      expect(getArtifactType('trace.zip')).toBe('trace');
      expect(getArtifactType('test-trace.zip')).toBe('trace');
    });

    it('detects videos', () => {
      expect(getArtifactType('recording.webm')).toBe('video');
      expect(getArtifactType('test.mp4')).toBe('video');
    });

    it('detects reports', () => {
      expect(getArtifactType('report.html')).toBe('report');
      expect(getArtifactType('report.json')).toBe('report');
      expect(getArtifactType('results.json')).toBe('report');
      expect(getArtifactType('junit.xml')).toBe('report');
    });

    it('returns null for unknown types', () => {
      expect(getArtifactType('file.txt')).toBeNull();
      expect(getArtifactType('data.csv')).toBeNull();
    });
  });

  describe('collectArtifacts', () => {
    it('collects artifacts from directories', () => {
      // Create test artifacts
      mkdirSync(join(tempDir, 'results'));
      writeFileSync(join(tempDir, 'results', 'screenshot.png'), '');
      writeFileSync(join(tempDir, 'results', 'trace.zip'), '');
      writeFileSync(join(tempDir, 'results', 'ignored.txt'), '');

      const artifacts = collectArtifacts([join(tempDir, 'results')]);

      expect(artifacts).toHaveLength(2);
      expect(artifacts.map(a => a.type)).toContain('screenshot');
      expect(artifacts.map(a => a.type)).toContain('trace');
    });

    it('collects recursively up to maxDepth', () => {
      mkdirSync(join(tempDir, 'level1', 'level2'), { recursive: true });
      writeFileSync(join(tempDir, 'level1', 'test.png'), '');
      writeFileSync(join(tempDir, 'level1', 'level2', 'deep.png'), '');

      const artifacts = collectArtifacts([tempDir], 3);

      expect(artifacts).toHaveLength(2);
    });

    it('returns empty array for non-existent directory', () => {
      const artifacts = collectArtifacts(['/nonexistent/path']);
      expect(artifacts).toEqual([]);
    });
  });

  describe('getPlaywrightOutputDirs', () => {
    it('returns standard Playwright directories', () => {
      const dirs = getPlaywrightOutputDirs(tempDir);

      expect(dirs).toContain(join(tempDir, 'test-results'));
      expect(dirs).toContain(join(tempDir, 'playwright-report'));
    });
  });

  describe('findJsonReport', () => {
    it('finds results.json in test-results', () => {
      mkdirSync(join(tempDir, 'test-results'));
      writeFileSync(join(tempDir, 'test-results', 'results.json'), '{}');

      const report = findJsonReport(tempDir);
      expect(report).toBe(join(tempDir, 'test-results', 'results.json'));
    });

    it('finds report.json in playwright-report', () => {
      mkdirSync(join(tempDir, 'playwright-report'));
      writeFileSync(join(tempDir, 'playwright-report', 'report.json'), '{}');

      const report = findJsonReport(tempDir);
      expect(report).toBe(join(tempDir, 'playwright-report', 'report.json'));
    });

    it('returns null when no report found', () => {
      const report = findJsonReport(tempDir);
      expect(report).toBeNull();
    });
  });

  describe('parseJsonReport', () => {
    it('parses Playwright stats format', () => {
      const report = {
        stats: {
          expected: 8,
          unexpected: 2,
          skipped: 1,
          flaky: 0,
          duration: 5000,
        },
      };
      const reportPath = join(tempDir, 'report.json');
      writeFileSync(reportPath, JSON.stringify(report));

      const summary = parseJsonReport(reportPath);

      expect(summary).not.toBeNull();
      expect(summary?.total).toBe(11);
      expect(summary?.passed).toBe(8);
      expect(summary?.failed).toBe(2);
      expect(summary?.skipped).toBe(1);
      expect(summary?.durationMs).toBe(5000);
    });

    it('returns null for invalid JSON', () => {
      const reportPath = join(tempDir, 'bad.json');
      writeFileSync(reportPath, 'not valid json');

      const summary = parseJsonReport(reportPath);
      expect(summary).toBeNull();
    });

    it('returns null for non-existent file', () => {
      const summary = parseJsonReport('/nonexistent/report.json');
      expect(summary).toBeNull();
    });
  });
});
