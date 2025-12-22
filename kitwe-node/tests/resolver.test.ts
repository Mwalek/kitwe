/**
 * Unit tests for the RunSpec resolver module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  resolveRunSpec,
  detectPackageManager,
  isResolvedCommand,
  isResolvedError,
} from '../src/runner/resolver.js';
import type { RunSpec } from '../src/types/index.js';

describe('resolver', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kitwe-resolver-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('detectPackageManager', () => {
    it('detects npm (default when no lock file)', () => {
      expect(detectPackageManager(tempDir)).toBe('npm');
    });

    it('detects pnpm from pnpm-lock.yaml', () => {
      writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
      expect(detectPackageManager(tempDir)).toBe('pnpm');
    });

    it('detects yarn from yarn.lock', () => {
      writeFileSync(join(tempDir, 'yarn.lock'), '');
      expect(detectPackageManager(tempDir)).toBe('yarn');
    });

    it('prefers pnpm over yarn when both exist', () => {
      writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
      writeFileSync(join(tempDir, 'yarn.lock'), '');
      expect(detectPackageManager(tempDir)).toBe('pnpm');
    });
  });

  describe('resolveRunSpec', () => {
    it('returns error for non-existent project root', () => {
      const spec: RunSpec = {
        projectRoot: '/nonexistent/path',
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedError(result)).toBe(true);
      if (isResolvedError(result)) {
        expect(result.errorType).toBe('project_not_found');
      }
    });

    it('resolves CLI script to runner command', () => {
      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
        script: 'test:e2e',
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedCommand(result)).toBe(true);
      if (isResolvedCommand(result)) {
        expect(result.argv).toEqual(['npm', 'run', 'test:e2e']);
        expect(result.mode).toBe('cli_script');
        expect(result.cwd).toBe(tempDir);
      }
    });

    it('resolves CLI script with pnpm when pnpm-lock.yaml exists', () => {
      writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');

      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
        script: 'test:e2e',
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedCommand(result)).toBe(true);
      if (isResolvedCommand(result)) {
        expect(result.argv).toEqual(['pnpm', 'run', 'test:e2e']);
      }
    });

    it('resolves CLI script with additional args', () => {
      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
        script: 'test:e2e',
        args: ['--headed', '--debug'],
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedCommand(result)).toBe(true);
      if (isResolvedCommand(result)) {
        // npm needs -- to pass args to scripts
        expect(result.argv).toEqual(['npm', 'run', 'test:e2e', '--', '--headed', '--debug']);
      }
    });

    it('resolves CLI config path to npx playwright command', () => {
      // Create the config file
      writeFileSync(join(tempDir, 'playwright.config.ts'), 'export default {}');

      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
        configPath: 'playwright.config.ts',
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedCommand(result)).toBe(true);
      if (isResolvedCommand(result)) {
        expect(result.argv).toEqual([
          'npx', 'playwright', 'test', '--config=playwright.config.ts'
        ]);
        expect(result.mode).toBe('cli_config');
      }
    });

    it('returns error for non-existent config path', () => {
      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
        configPath: 'nonexistent.config.ts',
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedError(result)).toBe(true);
      if (isResolvedError(result)) {
        expect(result.errorType).toBe('config_not_found');
      }
    });

    it('resolves from kitwe.yaml run.script', () => {
      // Create kitwe.yaml with run section
      const yamlContent = `
version: 1
run:
  script: test:e2e
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedCommand(result)).toBe(true);
      if (isResolvedCommand(result)) {
        expect(result.argv).toEqual(['npm', 'run', 'test:e2e']);
        expect(result.mode).toBe('yaml_script');
      }
    });

    it('resolves from kitwe.yaml run.config_path', () => {
      // Create e2e directory and playwright config
      mkdirSync(join(tempDir, 'e2e'), { recursive: true });
      writeFileSync(join(tempDir, 'e2e', 'playwright.config.ts'), 'export default {}');

      // Create kitwe.yaml with config_path
      const yamlContent = `
version: 1
run:
  config_path: e2e/playwright.config.ts
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedCommand(result)).toBe(true);
      if (isResolvedCommand(result)) {
        expect(result.argv).toContain('--config=e2e/playwright.config.ts');
        expect(result.mode).toBe('yaml_config');
      }
    });

    it('returns no_entrypoint error when no config exists', () => {
      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedError(result)).toBe(true);
      if (isResolvedError(result)) {
        expect(result.errorType).toBe('no_entrypoint');
        expect(result.message).toContain('explicit entrypoint is required');
      }
    });

    it('respects explicit runner override', () => {
      const spec: RunSpec = {
        projectRoot: tempDir,
        artifactsDir: join(tempDir, 'artifacts'),
        timeoutSeconds: 300,
        script: 'test:e2e',
        runner: 'yarn',
      };

      const result = resolveRunSpec(spec);

      expect(isResolvedCommand(result)).toBe(true);
      if (isResolvedCommand(result)) {
        expect(result.argv[0]).toBe('yarn');
      }
    });
  });

  describe('type guards', () => {
    it('isResolvedCommand identifies command results', () => {
      const cmd = { argv: ['test'], cwd: '/tmp', mode: 'cli_script' as const };
      const err = { errorType: 'test', message: 'test error' };

      expect(isResolvedCommand(cmd)).toBe(true);
      expect(isResolvedCommand(err)).toBe(false);
    });

    it('isResolvedError identifies error results', () => {
      const cmd = { argv: ['test'], cwd: '/tmp', mode: 'cli_script' as const };
      const err = { errorType: 'test', message: 'test error' };

      expect(isResolvedError(err)).toBe(true);
      expect(isResolvedError(cmd)).toBe(false);
    });
  });
});
