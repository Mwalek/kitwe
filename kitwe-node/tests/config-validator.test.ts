/**
 * Unit tests for the config validator module.
 */

import { describe, it, expect } from 'vitest';
import { validateCreateParams } from '../src/core/config-validator.js';

describe('config-validator', () => {
  describe('validateCreateParams', () => {
    describe('basic validation', () => {
      it('accepts valid minimal params', () => {
        const result = validateCreateParams({
          projectPath: '/path/to/project',
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('rejects non-object params', () => {
        const result = validateCreateParams('invalid');

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('params: expected object');
      });

      it('rejects null params', () => {
        const result = validateCreateParams(null);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('params: expected object');
      });

      it('requires projectPath', () => {
        const result = validateCreateParams({});

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('projectPath: required');
      });

      it('rejects non-string projectPath', () => {
        const result = validateCreateParams({
          projectPath: 123,
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('projectPath: expected string');
      });

      it('rejects empty projectPath', () => {
        const result = validateCreateParams({
          projectPath: '   ',
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('projectPath: must not be empty');
      });
    });

    describe('project section validation', () => {
      it('accepts valid project section', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          project: {
            name: 'my-project',
            envFile: '.env.test',
            baseUrl: 'http://localhost:3000',
          },
        });

        expect(result.valid).toBe(true);
      });

      it('rejects non-string project.name', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          project: { name: 123 },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('project.name: expected string, got number');
      });

      it('rejects non-object project section', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          project: 'invalid',
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('project: expected object');
      });
    });

    describe('run section validation', () => {
      it('accepts valid run section', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: {
            script: 'test:e2e',
            timeoutSeconds: 600,
            artifactsDir: 'test-results',
            runner: 'npm',
          },
        });

        expect(result.valid).toBe(true);
      });

      it('rejects invalid runner enum value', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: { runner: 'invalid' },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run.runner: must be one of: npm, pnpm, yarn, npx');
      });

      it('rejects timeoutSeconds below minimum', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: { timeoutSeconds: 0 },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run.timeoutSeconds: must be at least 1');
      });

      it('rejects timeoutSeconds above maximum', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: { timeoutSeconds: 10000 },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run.timeoutSeconds: must be at most 7200');
      });

      it('accepts valid args array', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: { args: ['--workers=4', '--retries=2'] },
        });

        expect(result.valid).toBe(true);
      });

      it('rejects non-array args', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: { args: '--workers=4' },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run.args: expected array, got string');
      });

      it('rejects non-string items in args array', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: { args: [123] },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run.args[0]: expected string, got number');
      });

      it('accepts valid env record', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: { env: { CI: 'true', DEBUG: 'pw:api' } },
        });

        expect(result.valid).toBe(true);
      });

      it('rejects non-string values in env record', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: { env: { CI: true } },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run.env.CI: expected string, got boolean');
      });

      it('validates preCommands structure', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: {
            preCommands: [
              { argv: ['npm', 'run', 'db:reset'], cwd: './server' },
            ],
          },
        });

        expect(result.valid).toBe(true);
      });

      it('rejects preCommands without argv', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: {
            preCommands: [{ cwd: './server' }],
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run.preCommands[0].argv: required');
      });

      it('rejects empty argv in preCommands', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          run: {
            preCommands: [{ argv: [] }],
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run.preCommands[0].argv: must not be empty');
      });
    });

    describe('tests section validation', () => {
      it('accepts valid tests section', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          tests: {
            testDir: 'e2e',
            pattern: '**/*.spec.ts',
            defaultOutputPath: 'test-output',
          },
        });

        expect(result.valid).toBe(true);
      });

      it('accepts valid selectorPolicy', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          tests: {
            selectorPolicy: {
              prefer: ['data-testid', 'role'],
              avoid: ['class', 'xpath'],
            },
          },
        });

        expect(result.valid).toBe(true);
      });

      it('rejects non-array selectorPolicy.prefer', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          tests: {
            selectorPolicy: { prefer: 'data-testid' },
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('tests.selectorPolicy.prefer: expected array, got string');
      });
    });

    describe('auth section validation', () => {
      it('accepts valid auth section with default profile', () => {
        const result = validateCreateParams({
          projectPath: '/path',
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

        expect(result.valid).toBe(true);
      });

      it('rejects invalid auth strategy', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          auth: {
            default: { strategy: 'invalid' },
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'auth.default.strategy: must be one of: no_auth, login_in_test, login_before_test'
        );
      });

      it('requires credentials for login_in_test strategy', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          auth: {
            default: { strategy: 'login_in_test' },
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'auth.default: credentials required when strategy is "login_in_test"'
        );
      });

      it('requires storageStatePath for login_before_test strategy', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          auth: {
            default: { strategy: 'login_before_test' },
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'auth.default: storageStatePath required when strategy is "login_before_test"'
        );
      });

      it('accepts no_auth strategy without credentials', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          auth: {
            default: { strategy: 'no_auth' },
          },
        });

        expect(result.valid).toBe(true);
      });

      it('validates named profiles', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          auth: {
            profiles: {
              admin: {
                strategy: 'login_in_test',
                credentials: {
                  email: 'ADMIN_EMAIL',
                  password: 'ADMIN_PASSWORD',
                },
              },
            },
          },
        });

        expect(result.valid).toBe(true);
      });

      it('rejects invalid named profile', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          auth: {
            profiles: {
              admin: { strategy: 'login_in_test' },
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'auth.profiles.admin: credentials required when strategy is "login_in_test"'
        );
      });

      it('requires email and password in credentials', () => {
        const result = validateCreateParams({
          projectPath: '/path',
          auth: {
            default: {
              strategy: 'login_in_test',
              credentials: { email: 'E2E_EMAIL' },
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('auth.default.credentials.password: required');
      });
    });

    describe('multiple errors', () => {
      it('collects all validation errors', () => {
        const result = validateCreateParams({
          projectPath: 123,
          run: {
            runner: 'invalid',
            timeoutSeconds: 0,
          },
          auth: {
            default: { strategy: 'login_in_test' },
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(2);
        expect(result.errors).toContain('projectPath: expected string');
        expect(result.errors).toContain('run.runner: must be one of: npm, pnpm, yarn, npx');
        expect(result.errors).toContain('run.timeoutSeconds: must be at least 1');
      });
    });
  });
});
