/**
 * Core type definitions for Kitwe
 */

// =============================================================================
// Project Registry Types
// =============================================================================

export interface ProjectEntry {
  path: string;
  addedAt: string;
}

export interface Registry {
  version: number;
  projects: Record<string, ProjectEntry>;
}

// =============================================================================
// Configuration Types
// =============================================================================

export type RunnerType = 'npm' | 'pnpm' | 'yarn' | 'npx';

export interface PreCommand {
  argv: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface RunConfig {
  script?: string;
  configPath?: string;
  timeoutSeconds: number;
  artifactsDir: string;
  runner?: RunnerType;
  args?: string[];
  env?: Record<string, string>;
  preCommands?: PreCommand[];
  skipSetup?: boolean;
  outputDir?: string;
}

export interface SelectorPolicy {
  prefer?: string[];
  avoid?: string[];
}

export interface TestsConfig {
  testDir?: string;
  pattern?: string;
  defaultOutputPath?: string;
  selectorPolicy?: SelectorPolicy;
}

export interface Credentials {
  email: string;
  password: string;
}

export type AuthStrategy = 'no_auth' | 'login_in_test' | 'login_before_test';

export interface AuthProfile {
  strategy: AuthStrategy;
  credentials?: Credentials;
  storageStatePath?: string;
}

export interface AuthConfig {
  default?: AuthProfile;
  profiles: Record<string, AuthProfile>;
  envFile?: string;
}

export interface ProjectSection {
  name?: string;
  envFile?: string;
  baseUrl?: string;
}

export interface KitweConfig {
  version: number;
  project?: ProjectSection;
  run?: RunConfig;
  tests?: TestsConfig;
  auth?: AuthConfig;
}

// =============================================================================
// Run Result Types
// =============================================================================

export type RunStatus = 'passed' | 'failed' | 'error' | 'timeout';

export interface ArtifactInfo {
  type: 'screenshot' | 'trace' | 'video' | 'report' | 'other';
  path: string;
  name: string;
  size: number;
}

export interface RunSpec {
  projectRoot: string;
  artifactsDir: string;
  timeoutSeconds: number;
  script?: string;
  configPath?: string;
  runner?: RunnerType;
  args?: string[];
  env?: Record<string, string>;
  preCommands?: PreCommand[];
  skipSetup?: boolean;
  testName?: string;
  outputDir?: string;
}

export interface RunResult {
  status: RunStatus;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  artifacts: ArtifactInfo[];
  command?: string[];
  error?: string;
}

// =============================================================================
// CLI Types
// =============================================================================

export interface ProjectResolveOptions {
  project?: string;
  projectRoot?: string;
}

export interface RunOptions extends ProjectResolveOptions {
  script?: string;
  config?: string;
  timeout?: number;
  artifactsDir?: string;
  runner?: string;
  args?: string[];
  jsonOut?: string;
  verbose?: boolean;
  skipSetup?: boolean;
}

export interface ConfigShowOptions extends ProjectResolveOptions {
  json?: boolean;
}

export interface ConfigInitOptions extends ProjectResolveOptions {
  force?: boolean;
  withAuth?: boolean;
}

// =============================================================================
// Config Helper Types (MCP Tool)
// =============================================================================

/**
 * Input parameters for create_config MCP tool.
 * All section properties are optional - AI provides only what's needed.
 */
export interface CreateConfigParams {
  /** Absolute path to the project directory */
  projectPath: string;

  /** Project identification settings */
  project?: {
    name?: string;
    envFile?: string;
    baseUrl?: string;
  };

  /** Test execution configuration */
  run?: {
    script?: string;
    configPath?: string;
    timeoutSeconds?: number;
    artifactsDir?: string;
    runner?: RunnerType;
    args?: string[];
    env?: Record<string, string>;
    preCommands?: PreCommand[];
    skipSetup?: boolean;
    outputDir?: string;
  };

  /** Test file discovery settings */
  tests?: {
    testDir?: string;
    pattern?: string;
    defaultOutputPath?: string;
    selectorPolicy?: SelectorPolicy;
  };

  /** Authentication configuration */
  auth?: {
    envFile?: string;
    default?: AuthProfile;
    profiles?: Record<string, AuthProfile>;
  };
}

/**
 * Result returned by create_config MCP tool
 */
export interface CreateConfigResult {
  /** Whether the config was created successfully */
  success: boolean;
  /** Absolute path to the created config file */
  configPath: string;
  /** Human-readable success or error message */
  message: string;
  /** Validation errors if success is false */
  validationErrors?: string[];
}

/**
 * Individual property metadata for schema tool
 */
export interface ConfigSchemaProperty {
  /** Dot-notation path (e.g., "run.artifactsDir") */
  path: string;
  /** What this property does */
  description: string;
  /** Question to ask when collecting this value */
  question: string;
  /** Data type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  /** Whether this property is required */
  required: boolean;
  /** Default value if not specified */
  default?: unknown;
  /** Example value */
  example?: string;
  /** Allowed values for enum types */
  enumValues?: string[];
}

/**
 * Section grouping for schema tool
 */
export interface ConfigSchemaSection {
  /** Section name (project, run, tests, auth) */
  name: string;
  /** Section description */
  description: string;
  /** Properties in this section */
  properties: ConfigSchemaProperty[];
}

/**
 * Result returned by get_config_schema MCP tool
 */
export interface ConfigSchemaResult {
  /** Available configuration sections */
  sections: ConfigSchemaSection[];
}
