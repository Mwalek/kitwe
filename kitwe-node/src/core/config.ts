/**
 * Kitwe Project Configuration
 *
 * Loads and validates kitwe.yaml configuration files with Zod schemas.
 * Supports environment variable substitution ($VAR or ${VAR} syntax).
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type {
  KitweConfig,
  RunConfig,
  TestsConfig,
  AuthConfig,
  PreCommand,
} from '../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const PreCommandSchema = z.object({
  argv: z.array(z.string()).min(1),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

const RunConfigSchema = z.object({
  runner: z.enum(['npm', 'pnpm', 'yarn', 'npx']).optional(),
  script: z.string().optional(),
  config_path: z.string().optional(),
  args: z.array(z.string()).default([]),
  timeout_seconds: z.number().min(1).max(7200).default(1200),
  artifacts_dir: z.string().default('artifacts/kitwe'),
  output_dir: z.string().optional(),
  env: z.record(z.string()).optional(),
  skip_setup: z.boolean().default(false),
  pre_commands: z.array(PreCommandSchema).optional(),
});

const SelectorPolicySchema = z.object({
  prefer: z.array(z.string()).default(['data-testid', 'role', 'aria-label']),
  avoid: z.array(z.string()).default(['class', 'xpath']),
});

const TestsConfigSchema = z.object({
  language: z.enum(['typescript', 'javascript']).default('typescript'),
  test_dir: z.string().optional(),
  pattern: z.string().optional(),
  default_output_path: z.string().optional(),
  selector_policy: SelectorPolicySchema.default({}),
});

const CredentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
});

const AuthProfileSchema = z.object({
  strategy: z.enum(['no_auth', 'login_in_test', 'login_before_test']).default('login_in_test'),
  credentials: CredentialsSchema.optional(),
  storage_state_path: z.string().optional(),
});

const AuthConfigSchema = z.object({
  default: AuthProfileSchema.optional(),
  profiles: z.record(AuthProfileSchema).default({}),
  env_file: z.string().optional(),
});

const ProjectSectionSchema = z.object({
  name: z.string().optional(),
  env_file: z.string().optional(),
  base_url: z.string().optional(),
});

const SetupConfigSchema = z.object({
  pre_commands: z.array(PreCommandSchema).optional(),
});

const KitweConfigSchema = z.object({
  version: z.number().min(1).max(1),
  project: ProjectSectionSchema.default({}),
  setup: SetupConfigSchema.default({}),
  run: RunConfigSchema.default({}),
  tests: TestsConfigSchema.default({}),
  auth: AuthConfigSchema.default({}),
});

// =============================================================================
// Environment Variable Resolution
// =============================================================================

/**
 * Pattern for env var syntax: $VAR or ${VAR}
 */
const ENV_VAR_REF_PATTERN = /\$\{?([A-Z_][A-Z0-9_]*)\}?/g;

/**
 * Resolve environment variable references in a string value.
 *
 * @param value - String that may contain env var reference(s).
 * @returns Resolved value with all env vars substituted, or null if any env var not found.
 */
export function resolveEnvValue(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  // Find all env var references
  const matches = [...value.matchAll(ENV_VAR_REF_PATTERN)];

  // No env var references, return as-is
  if (matches.length === 0) {
    return value;
  }

  // Check that all referenced env vars are set
  for (const match of matches) {
    const envVarName = match[1];
    if (!(envVarName in process.env)) {
      return null;
    }
  }

  // Replace all env var references with their values
  return value.replace(ENV_VAR_REF_PATTERN, (_, envVarName) => {
    return process.env[envVarName] || '';
  });
}

// =============================================================================
// Error Classes
// =============================================================================

export class ConfigLoadError extends Error {
  constructor(
    public readonly path: string,
    public readonly reason: string
  ) {
    super(`Failed to load config from ${path}: ${reason}`);
    this.name = 'ConfigLoadError';
  }
}

export class ConfigValidationError extends Error {
  constructor(
    public readonly path: string,
    public readonly errors: string[]
  ) {
    const errorList = errors.map(e => `  - ${e}`).join('\n');
    super(`Invalid config at ${path}:\n${errorList}`);
    this.name = 'ConfigValidationError';
  }
}

export class ConfigNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`Configuration file not found: ${path}`);
    this.name = 'ConfigNotFoundError';
  }
}

// =============================================================================
// Type Conversion (snake_case YAML to camelCase TS)
// =============================================================================

/**
 * Convert snake_case YAML config to camelCase TypeScript interfaces.
 */
function convertToTypescript(raw: z.infer<typeof KitweConfigSchema>): KitweConfig {
  return {
    version: raw.version,
    project: {
      name: raw.project?.name,
      envFile: raw.project?.env_file,
      baseUrl: raw.project?.base_url,
    },
    run: {
      runner: raw.run?.runner,
      script: raw.run?.script,
      configPath: raw.run?.config_path,
      args: raw.run?.args,
      timeoutSeconds: raw.run?.timeout_seconds ?? 1200,
      artifactsDir: raw.run?.artifacts_dir ?? 'artifacts/kitwe',
      outputDir: raw.run?.output_dir,
      env: raw.run?.env,
      skipSetup: raw.run?.skip_setup,
      preCommands: raw.run?.pre_commands?.map(cmd => ({
        argv: cmd.argv,
        cwd: cmd.cwd,
        env: cmd.env,
      })),
    },
    tests: {
      testDir: raw.tests?.test_dir,
      pattern: raw.tests?.pattern,
      defaultOutputPath: raw.tests?.default_output_path,
      selectorPolicy: raw.tests?.selector_policy ? {
        prefer: raw.tests.selector_policy.prefer,
        avoid: raw.tests.selector_policy.avoid,
      } : undefined,
    },
    auth: {
      default: raw.auth?.default ? {
        strategy: raw.auth.default.strategy,
        credentials: raw.auth.default.credentials,
        storageStatePath: raw.auth.default.storage_state_path,
      } : undefined,
      profiles: Object.fromEntries(
        Object.entries(raw.auth?.profiles ?? {}).map(([name, profile]) => [
          name,
          {
            strategy: profile.strategy,
            credentials: profile.credentials,
            storageStatePath: profile.storage_state_path,
          },
        ])
      ),
      envFile: raw.auth?.env_file,
    },
  };
}

// =============================================================================
// Config Loading Functions
// =============================================================================

/**
 * Get the expected path to the config file.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns Path to kitwe.yaml (may not exist).
 */
export function getConfigPath(projectRoot: string): string {
  return resolve(projectRoot, 'kitwe.yaml');
}

/**
 * Load project configuration from kitwe.yaml.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns KitweConfig if file exists and is valid, null if file doesn't exist.
 * @throws ConfigLoadError if file exists but cannot be read/parsed.
 * @throws ConfigValidationError if file exists but fails validation.
 */
export function loadProjectConfig(projectRoot: string): KitweConfig | null {
  const configPath = getConfigPath(projectRoot);

  if (!existsSync(configPath)) {
    return null;
  }

  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new ConfigLoadError(configPath, `Cannot read file: ${err}`);
  }

  let data: unknown;
  try {
    data = yaml.load(content);
  } catch (err) {
    throw new ConfigLoadError(configPath, `YAML parse error: ${err}`);
  }

  if (data == null) {
    throw new ConfigLoadError(configPath, 'File is empty');
  }

  if (typeof data !== 'object') {
    throw new ConfigLoadError(configPath, 'Root must be a YAML mapping');
  }

  // Validate with Zod
  const result = KitweConfigSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    throw new ConfigValidationError(configPath, errors);
  }

  return convertToTypescript(result.data);
}

/**
 * Load ONLY the run configuration section.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns RunConfig if kitwe.yaml exists, null otherwise.
 */
export function loadRunConfig(projectRoot: string): RunConfig | null {
  const config = loadProjectConfig(projectRoot);
  return config?.run ?? null;
}

/**
 * Load ONLY the tests configuration section.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns TestsConfig if kitwe.yaml exists, null otherwise.
 */
export function loadTestsConfig(projectRoot: string): TestsConfig | null {
  const config = loadProjectConfig(projectRoot);
  return config?.tests ?? null;
}

/**
 * Load ONLY the auth configuration section.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns AuthConfig if kitwe.yaml exists, null otherwise.
 */
export function loadAuthConfig(projectRoot: string): AuthConfig | null {
  const config = loadProjectConfig(projectRoot);
  return config?.auth ?? null;
}

/**
 * Get merged pre_commands for the run phase.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns Array of PreCommand to execute (may be empty).
 */
export function getRunPreCommands(projectRoot: string): PreCommand[] {
  const configPath = getConfigPath(projectRoot);

  if (!existsSync(configPath)) {
    return [];
  }

  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch {
    return [];
  }

  let data: unknown;
  try {
    data = yaml.load(content);
  } catch {
    return [];
  }

  const result = KitweConfigSchema.safeParse(data);
  if (!result.success) {
    return [];
  }

  const raw = result.data;
  const commands: PreCommand[] = [];

  // Add shared setup commands (unless skipped)
  if (!raw.run?.skip_setup && raw.setup?.pre_commands) {
    commands.push(...raw.setup.pre_commands.map(cmd => ({
      argv: cmd.argv,
      cwd: cmd.cwd,
      env: cmd.env,
    })));
  }

  // Add phase-specific commands
  if (raw.run?.pre_commands) {
    commands.push(...raw.run.pre_commands.map(cmd => ({
      argv: cmd.argv,
      cwd: cmd.cwd,
      env: cmd.env,
    })));
  }

  return commands;
}

/**
 * Get the resolved base_url from project config.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns Resolved base URL, or null if not configured or env var not found.
 */
export function getProjectBaseUrl(projectRoot: string): string | null {
  const config = loadProjectConfig(projectRoot);
  if (!config?.project?.baseUrl) {
    return null;
  }
  return resolveEnvValue(config.project.baseUrl);
}

// =============================================================================
// Config Validation (for `config validate` command)
// =============================================================================

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a config file and return detailed results.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns Validation result with errors and warnings.
 */
export function validateConfigFile(projectRoot: string): ConfigValidationResult {
  const configPath = getConfigPath(projectRoot);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(configPath)) {
    errors.push(`Config file not found: ${configPath}`);
    return { valid: false, errors, warnings };
  }

  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch (err) {
    errors.push(`Cannot read file: ${err}`);
    return { valid: false, errors, warnings };
  }

  let data: unknown;
  try {
    data = yaml.load(content);
  } catch (err) {
    errors.push(`YAML parse error: ${err}`);
    return { valid: false, errors, warnings };
  }

  if (data == null) {
    errors.push('File is empty');
    return { valid: false, errors, warnings };
  }

  // Validate with Zod
  const result = KitweConfigSchema.safeParse(data);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      errors.push(path ? `${path}: ${issue.message}` : issue.message);
    }
    return { valid: false, errors, warnings };
  }

  // Additional semantic validation
  const raw = result.data;

  // Check run entrypoint
  if (!raw.run?.script && !raw.run?.config_path) {
    warnings.push('No run.script or run.config_path set - run command will require CLI flags');
  }

  // Check auth strategy requires credentials
  if (raw.auth?.default?.strategy === 'login_in_test' && !raw.auth.default.credentials) {
    errors.push('auth.default: credentials required when strategy is "login_in_test"');
  }

  for (const [name, profile] of Object.entries(raw.auth?.profiles ?? {})) {
    if (profile.strategy === 'login_in_test' && !profile.credentials) {
      errors.push(`auth.profiles.${name}: credentials required when strategy is "login_in_test"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// Config Template Generation
// =============================================================================

const BASIC_TEMPLATE = `version: 1

project:
  name: my-project
  # env_file: .env.test
  # base_url: $BASE_URL

run:
  script: test:e2e
  timeout_seconds: 1200
  artifacts_dir: test-results

tests:
  language: typescript
  # test_dir: e2e
  # pattern: "**/*.spec.ts"
`;

const AUTH_TEMPLATE = `version: 1

project:
  name: my-project
  # env_file: .env.test
  # base_url: $BASE_URL

run:
  script: test:e2e
  timeout_seconds: 1200
  artifacts_dir: test-results

tests:
  language: typescript
  # test_dir: e2e
  # pattern: "**/*.spec.ts"

auth:
  # env_file: .env.test
  default:
    strategy: login_in_test
    credentials:
      email: E2E_TEST_EMAIL
      password: E2E_TEST_PASSWORD
  profiles:
    admin:
      strategy: login_in_test
      credentials:
        email: E2E_ADMIN_EMAIL
        password: E2E_ADMIN_PASSWORD
`;

/**
 * Create a config template file.
 *
 * @param projectRoot - Path to the project root directory.
 * @param options - Template options.
 * @returns Path to created config file.
 * @throws Error if file exists and force is not set.
 */
export function createConfigTemplate(
  projectRoot: string,
  options: { force?: boolean; withAuth?: boolean } = {}
): string {
  const configPath = getConfigPath(projectRoot);

  if (existsSync(configPath) && !options.force) {
    throw new Error(`Config file already exists: ${configPath}\nUse --force to overwrite.`);
  }

  const template = options.withAuth ? AUTH_TEMPLATE : BASIC_TEMPLATE;
  writeFileSync(configPath, template, 'utf-8');

  return configPath;
}
