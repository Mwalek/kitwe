/**
 * Unit tests for the configuration loading module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  loadProjectConfig,
  loadRunConfig,
  loadTestsConfig,
  loadAuthConfig,
  getConfigPath,
  getProjectBaseUrl,
  resolveEnvValue,
  validateConfigFile,
  ConfigLoadError,
  ConfigValidationError,
  ConfigNotFoundError,
} from '../src/core/config.js';

describe('config', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kitwe-config-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('getConfigPath', () => {
    it('returns path to kitwe.yaml in project root', () => {
      const configPath = getConfigPath(tempDir);
      expect(configPath).toBe(join(tempDir, 'kitwe.yaml'));
    });
  });

  describe('loadProjectConfig', () => {
    it('returns null when config does not exist', () => {
      const config = loadProjectConfig(tempDir);
      expect(config).toBeNull();
    });

    it('loads valid config from YAML', () => {
      const yamlContent = `
version: 1
project:
  name: test-project
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const config = loadProjectConfig(tempDir);

      expect(config).not.toBeNull();
      expect(config?.version).toBe(1);
      expect(config?.project?.name).toBe('test-project');
    });

    it('loads config with run section', () => {
      const yamlContent = `
version: 1
run:
  script: test:e2e
  timeout_seconds: 600
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const config = loadProjectConfig(tempDir);

      expect(config?.run?.script).toBe('test:e2e');
      expect(config?.run?.timeoutSeconds).toBe(600);
    });

    it('throws ConfigValidationError for invalid config', () => {
      const yamlContent = `
version: "invalid"
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      expect(() => loadProjectConfig(tempDir)).toThrow(ConfigValidationError);
    });

    it('throws ConfigLoadError for malformed YAML', () => {
      // Actual malformed YAML syntax (tabs/indentation error)
      const yamlContent = `version: 1
\t- invalid: yaml
  mixed: indentation`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      expect(() => loadProjectConfig(tempDir)).toThrow(ConfigLoadError);
    });
  });

  describe('loadRunConfig', () => {
    it('returns null when no config exists', () => {
      const config = loadRunConfig(tempDir);
      expect(config).toBeNull();
    });

    it('returns default config when config has no run section', () => {
      const yamlContent = `
version: 1
project:
  name: test
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const config = loadRunConfig(tempDir);
      // Config file exists so defaults are applied
      expect(config).not.toBeNull();
      expect(config?.timeoutSeconds).toBe(1200);
      expect(config?.artifactsDir).toBe('artifacts/kitwe');
    });

    it('returns run config when present', () => {
      const yamlContent = `
version: 1
run:
  script: test:e2e
  runner: pnpm
  artifacts_dir: test-results
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const config = loadRunConfig(tempDir);

      expect(config).not.toBeNull();
      expect(config?.script).toBe('test:e2e');
      expect(config?.runner).toBe('pnpm');
      expect(config?.artifactsDir).toBe('test-results');
    });
  });

  describe('loadTestsConfig', () => {
    it('returns null when no tests section exists', () => {
      const config = loadTestsConfig(tempDir);
      expect(config).toBeNull();
    });

    it('returns tests config when present', () => {
      const yamlContent = `
version: 1
tests:
  test_dir: e2e
  pattern: "**/*.spec.ts"
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const config = loadTestsConfig(tempDir);

      expect(config).not.toBeNull();
      expect(config?.testDir).toBe('e2e');
      expect(config?.pattern).toBe('**/*.spec.ts');
    });
  });

  describe('loadAuthConfig', () => {
    it('returns null when no auth section exists', () => {
      const config = loadAuthConfig(tempDir);
      expect(config).toBeNull();
    });

    it('returns auth config with profiles', () => {
      const yamlContent = `
version: 1
auth:
  default:
    strategy: login_in_test
    credentials:
      email: TEST_EMAIL
      password: TEST_PASSWORD
  profiles:
    admin:
      strategy: login_in_test
      credentials:
        email: ADMIN_EMAIL
        password: ADMIN_PASSWORD
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const config = loadAuthConfig(tempDir);

      expect(config).not.toBeNull();
      expect(config?.default?.strategy).toBe('login_in_test');
      expect(config?.profiles?.admin?.credentials?.email).toBe('ADMIN_EMAIL');
    });
  });

  describe('getProjectBaseUrl', () => {
    it('returns null when no config exists', () => {
      const baseUrl = getProjectBaseUrl(tempDir);
      expect(baseUrl).toBeNull();
    });

    it('returns base_url from project section', () => {
      const yamlContent = `
version: 1
project:
  base_url: http://localhost:3000
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const baseUrl = getProjectBaseUrl(tempDir);
      expect(baseUrl).toBe('http://localhost:3000');
    });

    it('resolves environment variables in base_url', () => {
      process.env.TEST_PORT = '8080';

      const yamlContent = `
version: 1
project:
  base_url: http://localhost:$TEST_PORT
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const baseUrl = getProjectBaseUrl(tempDir);
      expect(baseUrl).toBe('http://localhost:8080');

      delete process.env.TEST_PORT;
    });
  });

  describe('resolveEnvValue', () => {
    it('returns value unchanged when no env vars', () => {
      expect(resolveEnvValue('hello world')).toBe('hello world');
    });

    it('resolves $VAR syntax', () => {
      process.env.MY_VAR = 'resolved';
      expect(resolveEnvValue('value is $MY_VAR')).toBe('value is resolved');
      delete process.env.MY_VAR;
    });

    it('resolves ${VAR} syntax', () => {
      process.env.ANOTHER_VAR = 'works';
      expect(resolveEnvValue('this ${ANOTHER_VAR} too')).toBe('this works too');
      delete process.env.ANOTHER_VAR;
    });

    it('returns null when env var is not set', () => {
      // resolveEnvValue returns null when any env var is not found
      expect(resolveEnvValue('missing $NONEXISTENT_VAR here')).toBeNull();
    });
  });

  describe('validateConfigFile', () => {
    it('returns valid for correct config', () => {
      const yamlContent = `
version: 1
run:
  script: test
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const result = validateConfigFile(tempDir);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns invalid with errors for bad config', () => {
      const yamlContent = `
version: "wrong"
`;
      writeFileSync(join(tempDir, 'kitwe.yaml'), yamlContent);

      const result = validateConfigFile(tempDir);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns not_found when config missing', () => {
      const result = validateConfigFile(tempDir);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Config file not found');
    });
  });
});
