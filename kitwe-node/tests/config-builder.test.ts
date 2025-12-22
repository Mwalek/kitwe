/**
 * Unit tests for the config builder module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  buildConfig,
  configToYaml,
  writeConfig,
  createConfig,
} from '../src/core/config-builder.js';

describe('config-builder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kitwe-builder-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('buildConfig', () => {
    it('creates minimal config with just version', () => {
      const config = buildConfig({ projectPath: tempDir });

      expect(config.version).toBe(1);
      expect(config.project).toBeUndefined();
      expect(config.run).toBeUndefined();
      expect(config.tests).toBeUndefined();
      expect(config.auth).toBeUndefined();
    });

    it('includes project section when provided', () => {
      const config = buildConfig({
        projectPath: tempDir,
        project: {
          name: 'my-project',
          envFile: '.env.test',
          baseUrl: 'http://localhost:3000',
        },
      });

      expect(config.project).toEqual({
        name: 'my-project',
        envFile: '.env.test',
        baseUrl: 'http://localhost:3000',
      });
    });

    it('includes run section with defaults', () => {
      const config = buildConfig({
        projectPath: tempDir,
        run: {
          script: 'test:e2e',
        },
      });

      expect(config.run?.script).toBe('test:e2e');
      expect(config.run?.timeoutSeconds).toBe(300);
      expect(config.run?.artifactsDir).toBe('test-results');
    });

    it('includes run section with all options', () => {
      const config = buildConfig({
        projectPath: tempDir,
        run: {
          script: 'test:e2e',
          configPath: 'playwright.config.ts',
          timeoutSeconds: 600,
          artifactsDir: 'artifacts',
          runner: 'pnpm',
          args: ['--workers=4'],
          env: { CI: 'true' },
          preCommands: [{ argv: ['npm', 'run', 'db:reset'] }],
          skipSetup: true,
          outputDir: 'playwright-report',
        },
      });

      expect(config.run?.script).toBe('test:e2e');
      expect(config.run?.configPath).toBe('playwright.config.ts');
      expect(config.run?.timeoutSeconds).toBe(600);
      expect(config.run?.artifactsDir).toBe('artifacts');
      expect(config.run?.runner).toBe('pnpm');
      expect(config.run?.args).toEqual(['--workers=4']);
      expect(config.run?.env).toEqual({ CI: 'true' });
      expect(config.run?.preCommands).toEqual([{ argv: ['npm', 'run', 'db:reset'] }]);
      expect(config.run?.skipSetup).toBe(true);
      expect(config.run?.outputDir).toBe('playwright-report');
    });

    it('includes tests section', () => {
      const config = buildConfig({
        projectPath: tempDir,
        tests: {
          testDir: 'e2e',
          pattern: '**/*.spec.ts',
          defaultOutputPath: 'test-output',
          selectorPolicy: {
            prefer: ['data-testid', 'role'],
            avoid: ['class', 'xpath'],
          },
        },
      });

      expect(config.tests?.testDir).toBe('e2e');
      expect(config.tests?.pattern).toBe('**/*.spec.ts');
      expect(config.tests?.defaultOutputPath).toBe('test-output');
      expect(config.tests?.selectorPolicy?.prefer).toEqual(['data-testid', 'role']);
      expect(config.tests?.selectorPolicy?.avoid).toEqual(['class', 'xpath']);
    });

    it('includes auth section with default profile', () => {
      const config = buildConfig({
        projectPath: tempDir,
        auth: {
          envFile: '.env.auth',
          default: {
            strategy: 'login_in_test',
            credentials: {
              email: 'E2E_EMAIL',
              password: 'E2E_PASSWORD',
            },
          },
        },
      });

      expect(config.auth?.envFile).toBe('.env.auth');
      expect(config.auth?.default?.strategy).toBe('login_in_test');
      expect(config.auth?.default?.credentials?.email).toBe('E2E_EMAIL');
    });

    it('includes auth section with named profiles', () => {
      const config = buildConfig({
        projectPath: tempDir,
        auth: {
          profiles: {
            admin: {
              strategy: 'login_in_test',
              credentials: {
                email: 'ADMIN_EMAIL',
                password: 'ADMIN_PASSWORD',
              },
            },
            user: {
              strategy: 'login_before_test',
              storageStatePath: '.auth/user.json',
            },
          },
        },
      });

      expect(config.auth?.profiles?.admin?.strategy).toBe('login_in_test');
      expect(config.auth?.profiles?.user?.strategy).toBe('login_before_test');
      expect(config.auth?.profiles?.user?.storageStatePath).toBe('.auth/user.json');
    });
  });

  describe('configToYaml', () => {
    it('converts minimal config to YAML', () => {
      const config = buildConfig({ projectPath: tempDir });
      const yaml = configToYaml(config);

      expect(yaml).toContain('version: 1');
    });

    it('converts config with project section to YAML', () => {
      const config = buildConfig({
        projectPath: tempDir,
        project: { name: 'my-project' },
      });
      const yaml = configToYaml(config);

      expect(yaml).toContain('version: 1');
      expect(yaml).toContain('project:');
      expect(yaml).toContain('name: my-project');
    });

    it('uses snake_case in YAML output', () => {
      const config = buildConfig({
        projectPath: tempDir,
        run: {
          timeoutSeconds: 600,
          artifactsDir: 'test-results',
        },
        project: {
          envFile: '.env.test',
          baseUrl: 'http://localhost:3000',
        },
      });
      const yaml = configToYaml(config);

      expect(yaml).toContain('timeout_seconds: 600');
      expect(yaml).toContain('artifacts_dir: test-results');
      expect(yaml).toContain('env_file:');
      expect(yaml).toContain('base_url:');
      // Should not contain camelCase
      expect(yaml).not.toContain('timeoutSeconds');
      expect(yaml).not.toContain('artifactsDir');
      expect(yaml).not.toContain('envFile');
      expect(yaml).not.toContain('baseUrl');
    });

    it('converts auth profiles with snake_case', () => {
      const config = buildConfig({
        projectPath: tempDir,
        auth: {
          default: {
            strategy: 'login_before_test',
            storageStatePath: '.auth/state.json',
          },
        },
      });
      const yaml = configToYaml(config);

      expect(yaml).toContain('storage_state_path:');
      expect(yaml).not.toContain('storageStatePath');
    });

    it('excludes undefined values from YAML', () => {
      const config = buildConfig({
        projectPath: tempDir,
        run: {
          script: 'test:e2e',
        },
      });
      const yaml = configToYaml(config);

      // Should have script
      expect(yaml).toContain('script: test:e2e');
      // Should not have undefined optional values as explicit keys
      expect(yaml).not.toContain('config_path:');
      expect(yaml).not.toContain('output_dir:');
    });
  });

  describe('writeConfig', () => {
    it('writes config to kitwe.yaml', () => {
      const config = buildConfig({
        projectPath: tempDir,
        run: { script: 'test:e2e' },
      });

      const configPath = writeConfig(tempDir, config);

      expect(configPath).toBe(join(tempDir, 'kitwe.yaml'));
      expect(existsSync(configPath)).toBe(true);

      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('version: 1');
      expect(content).toContain('script: test:e2e');
    });

    it('throws error if config already exists', () => {
      writeFileSync(join(tempDir, 'kitwe.yaml'), 'version: 1');

      const config = buildConfig({ projectPath: tempDir });

      expect(() => writeConfig(tempDir, config)).toThrow('Config file already exists');
    });
  });

  describe('createConfig', () => {
    it('creates config successfully', () => {
      const result = createConfig({
        projectPath: tempDir,
        run: {
          script: 'test:e2e',
          artifactsDir: 'test-results',
        },
      });

      expect(result.success).toBe(true);
      expect(result.configPath).toBe(join(tempDir, 'kitwe.yaml'));
      expect(result.message).toContain('Successfully created');
      expect(existsSync(result.configPath)).toBe(true);
    });

    it('fails when project path does not exist', () => {
      const result = createConfig({
        projectPath: '/nonexistent/path',
        run: { script: 'test:e2e' },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
    });

    it('fails when config already exists', () => {
      writeFileSync(join(tempDir, 'kitwe.yaml'), 'version: 1');

      const result = createConfig({
        projectPath: tempDir,
        run: { script: 'test:e2e' },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.message).toContain('AI edit tools');
    });

    it('creates minimal config with no sections', () => {
      const result = createConfig({
        projectPath: tempDir,
      });

      expect(result.success).toBe(true);

      const content = readFileSync(result.configPath, 'utf-8');
      expect(content).toContain('version: 1');
    });

    it('creates complete config with all sections', () => {
      const result = createConfig({
        projectPath: tempDir,
        project: {
          name: 'full-project',
          envFile: '.env.test',
          baseUrl: 'http://localhost:3000',
        },
        run: {
          script: 'test:e2e',
          timeoutSeconds: 600,
          artifactsDir: 'artifacts',
          runner: 'npm',
        },
        tests: {
          testDir: 'e2e',
          pattern: '**/*.spec.ts',
        },
        auth: {
          default: {
            strategy: 'login_in_test',
            credentials: {
              email: 'E2E_EMAIL',
              password: 'E2E_PASSWORD',
            },
          },
        },
      });

      expect(result.success).toBe(true);

      const content = readFileSync(result.configPath, 'utf-8');
      expect(content).toContain('name: full-project');
      expect(content).toContain('script: test:e2e');
      expect(content).toContain('test_dir: e2e');
      expect(content).toContain('strategy: login_in_test');
    });
  });
});
