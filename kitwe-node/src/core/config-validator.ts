/**
 * Config Validator Module
 *
 * Validates CreateConfigParams input for the create_config MCP tool.
 * Performs structural and type validation without checking project state.
 */

import type { CreateConfigParams } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a string value.
 */
function validateString(value: unknown, path: string, errors: string[]): boolean {
  if (value !== undefined && typeof value !== 'string') {
    errors.push(`${path}: expected string, got ${typeof value}`);
    return false;
  }
  return true;
}

/**
 * Validate a number value.
 */
function validateNumber(
  value: unknown,
  path: string,
  errors: string[],
  options?: { min?: number; max?: number }
): boolean {
  if (value === undefined) return true;

  if (typeof value !== 'number') {
    errors.push(`${path}: expected number, got ${typeof value}`);
    return false;
  }

  if (options?.min !== undefined && value < options.min) {
    errors.push(`${path}: must be at least ${options.min}`);
    return false;
  }

  if (options?.max !== undefined && value > options.max) {
    errors.push(`${path}: must be at most ${options.max}`);
    return false;
  }

  return true;
}

/**
 * Validate a boolean value.
 */
function validateBoolean(value: unknown, path: string, errors: string[]): boolean {
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${path}: expected boolean, got ${typeof value}`);
    return false;
  }
  return true;
}

/**
 * Validate an array of strings.
 */
function validateStringArray(value: unknown, path: string, errors: string[]): boolean {
  if (value === undefined) return true;

  if (!Array.isArray(value)) {
    errors.push(`${path}: expected array, got ${typeof value}`);
    return false;
  }

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      errors.push(`${path}[${i}]: expected string, got ${typeof value[i]}`);
      return false;
    }
  }

  return true;
}

/**
 * Validate a Record<string, string>.
 */
function validateStringRecord(value: unknown, path: string, errors: string[]): boolean {
  if (value === undefined) return true;

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${path}: expected object, got ${Array.isArray(value) ? 'array' : typeof value}`);
    return false;
  }

  for (const [key, val] of Object.entries(value)) {
    if (typeof val !== 'string') {
      errors.push(`${path}.${key}: expected string, got ${typeof val}`);
      return false;
    }
  }

  return true;
}

/**
 * Validate an enum value.
 */
function validateEnum<T extends string>(
  value: unknown,
  path: string,
  allowedValues: T[],
  errors: string[]
): boolean {
  if (value === undefined) return true;

  if (typeof value !== 'string') {
    errors.push(`${path}: expected string, got ${typeof value}`);
    return false;
  }

  if (!allowedValues.includes(value as T)) {
    errors.push(`${path}: must be one of: ${allowedValues.join(', ')}`);
    return false;
  }

  return true;
}

// =============================================================================
// Section Validators
// =============================================================================

/**
 * Validate the project section.
 */
function validateProjectSection(
  project: CreateConfigParams['project'],
  errors: string[]
): void {
  if (project === undefined) return;

  if (typeof project !== 'object' || project === null) {
    errors.push('project: expected object');
    return;
  }

  validateString(project.name, 'project.name', errors);
  validateString(project.envFile, 'project.envFile', errors);
  validateString(project.baseUrl, 'project.baseUrl', errors);
}

/**
 * Validate a pre-command.
 */
function validatePreCommand(
  cmd: unknown,
  path: string,
  errors: string[]
): void {
  if (typeof cmd !== 'object' || cmd === null) {
    errors.push(`${path}: expected object`);
    return;
  }

  const command = cmd as Record<string, unknown>;

  // argv is required
  if (command.argv === undefined) {
    errors.push(`${path}.argv: required`);
  } else if (!Array.isArray(command.argv)) {
    errors.push(`${path}.argv: expected array`);
  } else if (command.argv.length === 0) {
    errors.push(`${path}.argv: must not be empty`);
  } else {
    for (let i = 0; i < command.argv.length; i++) {
      if (typeof command.argv[i] !== 'string') {
        errors.push(`${path}.argv[${i}]: expected string`);
      }
    }
  }

  validateString(command.cwd, `${path}.cwd`, errors);
  validateStringRecord(command.env, `${path}.env`, errors);
}

/**
 * Validate the run section.
 */
function validateRunSection(
  run: CreateConfigParams['run'],
  errors: string[]
): void {
  if (run === undefined) return;

  if (typeof run !== 'object' || run === null) {
    errors.push('run: expected object');
    return;
  }

  validateString(run.script, 'run.script', errors);
  validateString(run.configPath, 'run.configPath', errors);
  validateNumber(run.timeoutSeconds, 'run.timeoutSeconds', errors, { min: 1, max: 7200 });
  validateString(run.artifactsDir, 'run.artifactsDir', errors);
  validateEnum(run.runner, 'run.runner', ['npm', 'pnpm', 'yarn', 'npx'], errors);
  validateStringArray(run.args, 'run.args', errors);
  validateStringRecord(run.env, 'run.env', errors);
  validateBoolean(run.skipSetup, 'run.skipSetup', errors);
  validateString(run.outputDir, 'run.outputDir', errors);

  // Validate preCommands array
  if (run.preCommands !== undefined) {
    if (!Array.isArray(run.preCommands)) {
      errors.push('run.preCommands: expected array');
    } else {
      for (let i = 0; i < run.preCommands.length; i++) {
        validatePreCommand(run.preCommands[i], `run.preCommands[${i}]`, errors);
      }
    }
  }
}

/**
 * Validate the tests section.
 */
function validateTestsSection(
  tests: CreateConfigParams['tests'],
  errors: string[]
): void {
  if (tests === undefined) return;

  if (typeof tests !== 'object' || tests === null) {
    errors.push('tests: expected object');
    return;
  }

  validateString(tests.testDir, 'tests.testDir', errors);
  validateString(tests.pattern, 'tests.pattern', errors);
  validateString(tests.defaultOutputPath, 'tests.defaultOutputPath', errors);

  // Validate selectorPolicy
  if (tests.selectorPolicy !== undefined) {
    if (typeof tests.selectorPolicy !== 'object' || tests.selectorPolicy === null) {
      errors.push('tests.selectorPolicy: expected object');
    } else {
      validateStringArray(tests.selectorPolicy.prefer, 'tests.selectorPolicy.prefer', errors);
      validateStringArray(tests.selectorPolicy.avoid, 'tests.selectorPolicy.avoid', errors);
    }
  }
}

/**
 * Validate an auth profile.
 */
function validateAuthProfile(
  profile: unknown,
  path: string,
  errors: string[]
): void {
  if (typeof profile !== 'object' || profile === null) {
    errors.push(`${path}: expected object`);
    return;
  }

  const p = profile as Record<string, unknown>;

  // strategy is required
  if (p.strategy === undefined) {
    errors.push(`${path}.strategy: required`);
  } else {
    validateEnum(
      p.strategy,
      `${path}.strategy`,
      ['no_auth', 'login_in_test', 'login_before_test'],
      errors
    );
  }

  // Validate credentials
  if (p.credentials !== undefined) {
    if (typeof p.credentials !== 'object' || p.credentials === null) {
      errors.push(`${path}.credentials: expected object`);
    } else {
      const creds = p.credentials as Record<string, unknown>;
      if (creds.email === undefined) {
        errors.push(`${path}.credentials.email: required`);
      } else {
        validateString(creds.email, `${path}.credentials.email`, errors);
      }
      if (creds.password === undefined) {
        errors.push(`${path}.credentials.password: required`);
      } else {
        validateString(creds.password, `${path}.credentials.password`, errors);
      }
    }
  }

  // Validate storageStatePath
  validateString(p.storageStatePath, `${path}.storageStatePath`, errors);

  // Semantic validation: login_in_test requires credentials
  if (p.strategy === 'login_in_test' && p.credentials === undefined) {
    errors.push(`${path}: credentials required when strategy is "login_in_test"`);
  }

  // Semantic validation: login_before_test requires storageStatePath
  if (p.strategy === 'login_before_test' && p.storageStatePath === undefined) {
    errors.push(`${path}: storageStatePath required when strategy is "login_before_test"`);
  }
}

/**
 * Validate the auth section.
 */
function validateAuthSection(
  auth: CreateConfigParams['auth'],
  errors: string[]
): void {
  if (auth === undefined) return;

  if (typeof auth !== 'object' || auth === null) {
    errors.push('auth: expected object');
    return;
  }

  validateString(auth.envFile, 'auth.envFile', errors);

  // Validate default profile
  if (auth.default !== undefined) {
    validateAuthProfile(auth.default, 'auth.default', errors);
  }

  // Validate named profiles
  if (auth.profiles !== undefined) {
    if (typeof auth.profiles !== 'object' || auth.profiles === null) {
      errors.push('auth.profiles: expected object');
    } else {
      for (const [name, profile] of Object.entries(auth.profiles)) {
        validateAuthProfile(profile, `auth.profiles.${name}`, errors);
      }
    }
  }
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate CreateConfigParams input.
 *
 * Performs structural and type validation:
 * - Checks all values are correct types
 * - Validates enum values
 * - Checks required nested fields
 * - Validates semantic rules (e.g., credentials required for login_in_test)
 *
 * Does NOT validate:
 * - Whether project path exists (handled by createConfig)
 * - Whether npm scripts exist
 * - Whether file paths are valid
 *
 * @param params - The input parameters to validate.
 * @returns ValidationResult with valid flag and error messages.
 */
export function validateCreateParams(params: unknown): ValidationResult {
  const errors: string[] = [];

  // Check params is an object
  if (typeof params !== 'object' || params === null) {
    return {
      valid: false,
      errors: ['params: expected object'],
    };
  }

  const p = params as Record<string, unknown>;

  // projectPath is required
  if (p.projectPath === undefined) {
    errors.push('projectPath: required');
  } else if (typeof p.projectPath !== 'string') {
    errors.push('projectPath: expected string');
  } else if (p.projectPath.trim() === '') {
    errors.push('projectPath: must not be empty');
  }

  // Validate sections
  validateProjectSection(p.project as CreateConfigParams['project'], errors);
  validateRunSection(p.run as CreateConfigParams['run'], errors);
  validateTestsSection(p.tests as CreateConfigParams['tests'], errors);
  validateAuthSection(p.auth as CreateConfigParams['auth'], errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}
