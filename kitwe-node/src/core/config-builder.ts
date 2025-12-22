/**
 * Config Builder Module
 *
 * Builds and writes kitwe.yaml configuration files from MCP tool input.
 * Converts camelCase TypeScript input to snake_case YAML output.
 */

import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import type {
  CreateConfigParams,
  CreateConfigResult,
  KitweConfig,
} from '../types/index.js';

// =============================================================================
// Types for YAML Output (snake_case)
// =============================================================================

interface YamlPreCommand {
  argv: string[];
  cwd?: string;
  env?: Record<string, string>;
}

interface YamlRunConfig {
  runner?: string;
  script?: string;
  config_path?: string;
  args?: string[];
  timeout_seconds?: number;
  artifacts_dir?: string;
  output_dir?: string;
  env?: Record<string, string>;
  skip_setup?: boolean;
  pre_commands?: YamlPreCommand[];
}

interface YamlSelectorPolicy {
  prefer?: string[];
  avoid?: string[];
}

interface YamlTestsConfig {
  test_dir?: string;
  pattern?: string;
  default_output_path?: string;
  selector_policy?: YamlSelectorPolicy;
}

interface YamlCredentials {
  email: string;
  password: string;
}

interface YamlAuthProfile {
  strategy: string;
  credentials?: YamlCredentials;
  storage_state_path?: string;
}

interface YamlAuthConfig {
  env_file?: string;
  default?: YamlAuthProfile;
  profiles?: Record<string, YamlAuthProfile>;
}

interface YamlProjectSection {
  name?: string;
  env_file?: string;
  base_url?: string;
}

interface YamlKitweConfig {
  version: number;
  project?: YamlProjectSection;
  run?: YamlRunConfig;
  tests?: YamlTestsConfig;
  auth?: YamlAuthConfig;
}

// =============================================================================
// Config Building
// =============================================================================

/**
 * Build a KitweConfig from CreateConfigParams.
 * Returns the camelCase TypeScript representation.
 */
export function buildConfig(params: CreateConfigParams): KitweConfig {
  const config: KitweConfig = {
    version: 1,
  };

  // Project section
  if (params.project) {
    config.project = {
      name: params.project.name,
      envFile: params.project.envFile,
      baseUrl: params.project.baseUrl,
    };
  }

  // Run section
  if (params.run) {
    config.run = {
      script: params.run.script,
      configPath: params.run.configPath,
      timeoutSeconds: params.run.timeoutSeconds ?? 300,
      artifactsDir: params.run.artifactsDir ?? 'test-results',
      runner: params.run.runner,
      args: params.run.args,
      env: params.run.env,
      preCommands: params.run.preCommands,
      skipSetup: params.run.skipSetup,
      outputDir: params.run.outputDir,
    };
  }

  // Tests section
  if (params.tests) {
    config.tests = {
      testDir: params.tests.testDir,
      pattern: params.tests.pattern,
      defaultOutputPath: params.tests.defaultOutputPath,
      selectorPolicy: params.tests.selectorPolicy,
    };
  }

  // Auth section
  if (params.auth) {
    config.auth = {
      envFile: params.auth.envFile,
      default: params.auth.default,
      profiles: params.auth.profiles ?? {},
    };
  }

  return config;
}

/**
 * Convert camelCase TypeScript config to snake_case YAML structure.
 */
function convertToYamlFormat(config: KitweConfig): YamlKitweConfig {
  const yamlConfig: YamlKitweConfig = {
    version: config.version,
  };

  // Project section
  if (config.project && hasDefinedValues(config.project)) {
    yamlConfig.project = {};
    if (config.project.name !== undefined) {
      yamlConfig.project.name = config.project.name;
    }
    if (config.project.envFile !== undefined) {
      yamlConfig.project.env_file = config.project.envFile;
    }
    if (config.project.baseUrl !== undefined) {
      yamlConfig.project.base_url = config.project.baseUrl;
    }
  }

  // Run section
  if (config.run && hasDefinedValues(config.run)) {
    yamlConfig.run = {};
    if (config.run.runner !== undefined) {
      yamlConfig.run.runner = config.run.runner;
    }
    if (config.run.script !== undefined) {
      yamlConfig.run.script = config.run.script;
    }
    if (config.run.configPath !== undefined) {
      yamlConfig.run.config_path = config.run.configPath;
    }
    if (config.run.args !== undefined && config.run.args.length > 0) {
      yamlConfig.run.args = config.run.args;
    }
    if (config.run.timeoutSeconds !== undefined) {
      yamlConfig.run.timeout_seconds = config.run.timeoutSeconds;
    }
    if (config.run.artifactsDir !== undefined) {
      yamlConfig.run.artifacts_dir = config.run.artifactsDir;
    }
    if (config.run.outputDir !== undefined) {
      yamlConfig.run.output_dir = config.run.outputDir;
    }
    if (config.run.env !== undefined && Object.keys(config.run.env).length > 0) {
      yamlConfig.run.env = config.run.env;
    }
    if (config.run.skipSetup !== undefined) {
      yamlConfig.run.skip_setup = config.run.skipSetup;
    }
    if (config.run.preCommands !== undefined && config.run.preCommands.length > 0) {
      yamlConfig.run.pre_commands = config.run.preCommands.map((cmd) => {
        const yamlCmd: YamlPreCommand = { argv: cmd.argv };
        if (cmd.cwd !== undefined) {
          yamlCmd.cwd = cmd.cwd;
        }
        if (cmd.env !== undefined && Object.keys(cmd.env).length > 0) {
          yamlCmd.env = cmd.env;
        }
        return yamlCmd;
      });
    }
  }

  // Tests section
  if (config.tests && hasDefinedValues(config.tests)) {
    yamlConfig.tests = {};
    if (config.tests.testDir !== undefined) {
      yamlConfig.tests.test_dir = config.tests.testDir;
    }
    if (config.tests.pattern !== undefined) {
      yamlConfig.tests.pattern = config.tests.pattern;
    }
    if (config.tests.defaultOutputPath !== undefined) {
      yamlConfig.tests.default_output_path = config.tests.defaultOutputPath;
    }
    if (config.tests.selectorPolicy && hasDefinedValues(config.tests.selectorPolicy)) {
      yamlConfig.tests.selector_policy = {};
      if (config.tests.selectorPolicy.prefer !== undefined) {
        yamlConfig.tests.selector_policy.prefer = config.tests.selectorPolicy.prefer;
      }
      if (config.tests.selectorPolicy.avoid !== undefined) {
        yamlConfig.tests.selector_policy.avoid = config.tests.selectorPolicy.avoid;
      }
    }
  }

  // Auth section
  if (config.auth && hasDefinedValues(config.auth)) {
    yamlConfig.auth = {};
    if (config.auth.envFile !== undefined) {
      yamlConfig.auth.env_file = config.auth.envFile;
    }
    if (config.auth.default !== undefined) {
      yamlConfig.auth.default = convertAuthProfile(config.auth.default);
    }
    if (config.auth.profiles && Object.keys(config.auth.profiles).length > 0) {
      yamlConfig.auth.profiles = {};
      for (const [name, profile] of Object.entries(config.auth.profiles)) {
        yamlConfig.auth.profiles[name] = convertAuthProfile(profile);
      }
    }
  }

  return yamlConfig;
}

/**
 * Convert an auth profile from camelCase to snake_case.
 */
function convertAuthProfile(profile: {
  strategy: string;
  credentials?: { email: string; password: string };
  storageStatePath?: string;
}): YamlAuthProfile {
  const yamlProfile: YamlAuthProfile = {
    strategy: profile.strategy,
  };
  if (profile.credentials !== undefined) {
    yamlProfile.credentials = profile.credentials;
  }
  if (profile.storageStatePath !== undefined) {
    yamlProfile.storage_state_path = profile.storageStatePath;
  }
  return yamlProfile;
}

/**
 * Check if an object has any defined (non-undefined) values.
 */
function hasDefinedValues(obj: object): boolean {
  return Object.values(obj).some((v) => v !== undefined);
}

// =============================================================================
// YAML Serialization
// =============================================================================

/**
 * Convert a KitweConfig to YAML string.
 */
export function configToYaml(config: KitweConfig): string {
  const yamlConfig = convertToYamlFormat(config);

  return yaml.dump(yamlConfig, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

// =============================================================================
// File Writing
// =============================================================================

/**
 * Write a KitweConfig to a project's kitwe.yaml file.
 *
 * @param projectPath - Absolute path to the project directory.
 * @param config - The configuration to write.
 * @returns The absolute path to the created file.
 * @throws Error if the file already exists.
 */
export function writeConfig(projectPath: string, config: KitweConfig): string {
  const configPath = resolve(projectPath, 'kitwe.yaml');

  if (existsSync(configPath)) {
    throw new Error(`Config file already exists: ${configPath}`);
  }

  const yamlContent = configToYaml(config);
  writeFileSync(configPath, yamlContent, 'utf-8');

  return configPath;
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Create a kitwe.yaml configuration file from MCP tool parameters.
 *
 * This is the main function called by the MCP tool. It:
 * 1. Validates the project path exists
 * 2. Checks that kitwe.yaml doesn't already exist
 * 3. Builds the config from provided parameters
 * 4. Writes the YAML file
 *
 * @param params - CreateConfigParams from the MCP tool.
 * @returns CreateConfigResult with success status and file path.
 */
export function createConfig(params: CreateConfigParams): CreateConfigResult {
  const { projectPath } = params;

  // Validate project path exists
  if (!existsSync(projectPath)) {
    return {
      success: false,
      configPath: '',
      message: `Project path does not exist: ${projectPath}`,
    };
  }

  // Check if config already exists
  const configPath = resolve(projectPath, 'kitwe.yaml');
  if (existsSync(configPath)) {
    return {
      success: false,
      configPath,
      message: `Config file already exists: ${configPath}. Use AI edit tools to modify existing configs.`,
    };
  }

  // Build and write config
  try {
    const config = buildConfig(params);
    const writtenPath = writeConfig(projectPath, config);

    return {
      success: true,
      configPath: writtenPath,
      message: `Successfully created config at ${writtenPath}`,
    };
  } catch (error) {
    return {
      success: false,
      configPath: '',
      message: `Failed to create config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
