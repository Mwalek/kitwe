/**
 * Configuration schema metadata for Kitwe config helper
 *
 * This module defines descriptions and questions for each kitwe.yaml property,
 * enabling interactive configuration creation through MCP tools.
 */

// =============================================================================
// Types
// =============================================================================

export type PropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'enum';

export interface PropertyMetadata {
  /** Dot-notation path to the property (e.g., "run.artifactsDir") */
  path: string;
  /** User-friendly description of what this property does */
  description: string;
  /** Question to ask the user when collecting this value */
  question: string;
  /** The data type of this property */
  type: PropertyType;
  /** Allowed values for enum types */
  enumValues?: string[];
  /** Default value if not specified */
  default?: unknown;
  /** Whether this property is required */
  required?: boolean;
  /** Example value to show the user */
  example?: string;
  /** Parent property path for nested objects */
  parent?: string;
  /** Child properties for object types */
  children?: string[];
}

// =============================================================================
// Property Metadata Definitions
// =============================================================================

export const CONFIG_PROPERTIES: Record<string, PropertyMetadata> = {
  // ---------------------------------------------------------------------------
  // Top-Level
  // ---------------------------------------------------------------------------
  version: {
    path: 'version',
    description: 'Schema version number for the kitwe.yaml configuration file.',
    question: 'Which configuration schema version should Kitwe use?',
    type: 'number',
    default: 1,
    required: true,
    example: '1',
  },

  // ---------------------------------------------------------------------------
  // Project Section
  // ---------------------------------------------------------------------------
  project: {
    path: 'project',
    description: 'Project identification and environment settings.',
    question: 'Would you like to configure project settings?',
    type: 'object',
    required: false,
    children: ['project.name', 'project.envFile', 'project.baseUrl'],
  },

  'project.name': {
    path: 'project.name',
    description: 'A friendly name to identify your project within Kitwe.',
    question: 'What would you like to call this project?',
    type: 'string',
    required: false,
    example: 'my-awesome-app',
    parent: 'project',
  },

  'project.envFile': {
    path: 'project.envFile',
    description: 'Path to the environment file containing variables needed for testing.',
    question: 'Which environment file should Kitwe load for tests?',
    type: 'string',
    required: false,
    example: '.env.test',
    parent: 'project',
  },

  'project.baseUrl': {
    path: 'project.baseUrl',
    description: 'The base URL where your application runs during testing.',
    question: 'What is the base URL of your application under test?',
    type: 'string',
    required: false,
    example: 'http://localhost:3000',
    parent: 'project',
  },

  // ---------------------------------------------------------------------------
  // Run Section
  // ---------------------------------------------------------------------------
  run: {
    path: 'run',
    description: 'Test execution configuration including scripts, timeouts, and artifacts.',
    question: 'Would you like to configure test execution settings?',
    type: 'object',
    required: false,
    children: [
      'run.script',
      'run.configPath',
      'run.timeoutSeconds',
      'run.artifactsDir',
      'run.runner',
      'run.args',
      'run.env',
      'run.preCommands',
      'run.skipSetup',
      'run.outputDir',
    ],
  },

  'run.script': {
    path: 'run.script',
    description: 'The npm/package.json script name that runs your Playwright tests.',
    question: 'Which npm script runs your Playwright tests?',
    type: 'string',
    required: false,
    example: 'test:e2e',
    parent: 'run',
  },

  'run.configPath': {
    path: 'run.configPath',
    description:
      'Path to your Playwright configuration file if not using the default location.',
    question: 'Where is your Playwright config file located?',
    type: 'string',
    required: false,
    example: 'playwright.config.ts',
    parent: 'run',
  },

  'run.timeoutSeconds': {
    path: 'run.timeoutSeconds',
    description: 'Maximum time in seconds to wait for the test suite to complete.',
    question: 'How long should Kitwe wait before timing out tests?',
    type: 'number',
    default: 300,
    required: false,
    example: '600',
    parent: 'run',
  },

  'run.artifactsDir': {
    path: 'run.artifactsDir',
    description:
      'Directory where Playwright stores test outputs like screenshots, traces, and videos.',
    question: 'Where does Playwright save test artifacts?',
    type: 'string',
    default: 'test-results',
    required: false,
    example: 'test-results',
    parent: 'run',
  },

  'run.runner': {
    path: 'run.runner',
    description: 'The package manager used to run scripts (npm, pnpm, yarn, or npx).',
    question: 'Which package manager do you use?',
    type: 'enum',
    enumValues: ['npm', 'pnpm', 'yarn', 'npx'],
    default: 'npm',
    required: false,
    example: 'npm',
    parent: 'run',
  },

  'run.args': {
    path: 'run.args',
    description:
      'Additional command-line arguments to pass to Playwright when running tests.',
    question: 'What extra arguments should be passed to Playwright?',
    type: 'array',
    required: false,
    example: '["--workers=4", "--retries=2"]',
    parent: 'run',
  },

  'run.env': {
    path: 'run.env',
    description: 'Environment variables to set when running tests.',
    question: 'What environment variables should be set during test runs?',
    type: 'object',
    required: false,
    example: '{ "CI": "true", "DEBUG": "pw:api" }',
    parent: 'run',
  },

  'run.preCommands': {
    path: 'run.preCommands',
    description: 'Commands to execute before running tests, like database resets or seeding.',
    question: 'What commands should run before each test execution?',
    type: 'array',
    required: false,
    example: '[{ "argv": ["npm", "run", "db:reset"] }]',
    parent: 'run',
    children: ['run.preCommands[].argv', 'run.preCommands[].env', 'run.preCommands[].cwd'],
  },

  'run.preCommands[].argv': {
    path: 'run.preCommands[].argv',
    description: 'The command and arguments as an array (e.g., ["npm", "run", "db:reset"]).',
    question: 'What is the command and its arguments?',
    type: 'array',
    required: true,
    example: '["npm", "run", "db:reset"]',
    parent: 'run.preCommands',
  },

  'run.preCommands[].env': {
    path: 'run.preCommands[].env',
    description: 'Environment variables specific to this pre-command.',
    question: 'Does this command need any specific environment variables?',
    type: 'object',
    required: false,
    example: '{ "NODE_ENV": "test" }',
    parent: 'run.preCommands',
  },

  'run.preCommands[].cwd': {
    path: 'run.preCommands[].cwd',
    description: 'Working directory to run this pre-command from.',
    question: 'Which directory should this command run in?',
    type: 'string',
    required: false,
    example: './server',
    parent: 'run.preCommands',
  },

  'run.skipSetup': {
    path: 'run.skipSetup',
    description: 'Skip running pre-commands before test execution.',
    question: 'Should Kitwe skip setup commands for this run?',
    type: 'boolean',
    default: false,
    required: false,
    example: 'false',
    parent: 'run',
  },

  'run.outputDir': {
    path: 'run.outputDir',
    description: "Override directory for Playwright's test output.",
    question: 'Where should Playwright output test results?',
    type: 'string',
    required: false,
    example: 'playwright-report',
    parent: 'run',
  },

  // ---------------------------------------------------------------------------
  // Tests Section
  // ---------------------------------------------------------------------------
  tests: {
    path: 'tests',
    description: 'Test file locations and patterns for discovery.',
    question: 'Would you like to configure test discovery settings?',
    type: 'object',
    required: false,
    children: [
      'tests.testDir',
      'tests.pattern',
      'tests.defaultOutputPath',
      'tests.selectorPolicy',
    ],
  },

  'tests.testDir': {
    path: 'tests.testDir',
    description: 'Directory containing your Playwright test files.',
    question: 'Where are your Playwright test files located?',
    type: 'string',
    required: false,
    example: 'e2e',
    parent: 'tests',
  },

  'tests.pattern': {
    path: 'tests.pattern',
    description: 'Glob pattern to match test files (e.g., "**/*.spec.ts").',
    question: 'What file pattern identifies your test files?',
    type: 'string',
    required: false,
    example: '**/*.spec.ts',
    parent: 'tests',
  },

  'tests.defaultOutputPath': {
    path: 'tests.defaultOutputPath',
    description: 'Default directory for test-generated files.',
    question: 'Where should test-generated files be saved by default?',
    type: 'string',
    required: false,
    example: 'test-output',
    parent: 'tests',
  },

  'tests.selectorPolicy': {
    path: 'tests.selectorPolicy',
    description:
      'Rules for which element selectors AI agents should prefer or avoid when writing tests.',
    question: 'Do you have selector preferences for test generation?',
    type: 'object',
    required: false,
    children: ['tests.selectorPolicy.prefer', 'tests.selectorPolicy.avoid'],
    parent: 'tests',
  },

  'tests.selectorPolicy.prefer': {
    path: 'tests.selectorPolicy.prefer',
    description: 'List of selector types AI agents should prioritize (e.g., data-testid, role).',
    question: 'Which selector types should be preferred?',
    type: 'array',
    required: false,
    example: '["data-testid", "role", "text"]',
    parent: 'tests.selectorPolicy',
  },

  'tests.selectorPolicy.avoid': {
    path: 'tests.selectorPolicy.avoid',
    description: 'List of selector types AI agents should avoid (e.g., CSS classes, XPath).',
    question: 'Which selector types should be avoided?',
    type: 'array',
    required: false,
    example: '["css-class", "xpath", "nth-child"]',
    parent: 'tests.selectorPolicy',
  },

  // ---------------------------------------------------------------------------
  // Auth Section
  // ---------------------------------------------------------------------------
  auth: {
    path: 'auth',
    description: 'Authentication configuration for tests requiring login.',
    question: 'Does your application require authentication for testing?',
    type: 'object',
    required: false,
    children: ['auth.default', 'auth.profiles', 'auth.envFile'],
  },

  'auth.envFile': {
    path: 'auth.envFile',
    description: 'Path to environment file containing authentication credentials.',
    question: 'Which file contains your auth credentials?',
    type: 'string',
    required: false,
    example: '.env.auth',
    parent: 'auth',
  },

  'auth.default': {
    path: 'auth.default',
    description: 'The default authentication profile used when no specific profile is requested.',
    question: 'What authentication should be used by default?',
    type: 'object',
    required: false,
    parent: 'auth',
    children: [
      'auth.default.strategy',
      'auth.default.credentials',
      'auth.default.storageStatePath',
    ],
  },

  'auth.default.strategy': {
    path: 'auth.default.strategy',
    description:
      'How authentication is handled: no_auth (no login needed), login_in_test (login during test), or login_before_test (use saved auth state).',
    question: 'How should authentication be performed?',
    type: 'enum',
    enumValues: ['no_auth', 'login_in_test', 'login_before_test'],
    required: false,
    example: 'login_in_test',
    parent: 'auth.default',
  },

  'auth.default.credentials': {
    path: 'auth.default.credentials',
    description: 'Login credentials (email/password) for the default auth profile.',
    question: 'What credentials should be used for the default profile?',
    type: 'object',
    required: false,
    parent: 'auth.default',
    children: ['auth.default.credentials.email', 'auth.default.credentials.password'],
  },

  'auth.default.credentials.email': {
    path: 'auth.default.credentials.email',
    description: 'Environment variable name containing the login email/username.',
    question: 'Which env variable holds the login email?',
    type: 'string',
    required: false,
    example: 'E2E_TEST_EMAIL',
    parent: 'auth.default.credentials',
  },

  'auth.default.credentials.password': {
    path: 'auth.default.credentials.password',
    description: 'Environment variable name containing the login password.',
    question: 'Which env variable holds the login password?',
    type: 'string',
    required: false,
    example: 'E2E_TEST_PASSWORD',
    parent: 'auth.default.credentials',
  },

  'auth.default.storageStatePath': {
    path: 'auth.default.storageStatePath',
    description:
      'Path to pre-authenticated browser storage state file for login_before_test strategy.',
    question: 'Where is the saved authentication state file?',
    type: 'string',
    required: false,
    example: '.auth/user.json',
    parent: 'auth.default',
  },

  'auth.profiles': {
    path: 'auth.profiles',
    description: 'Named authentication profiles for different user roles (admin, user, etc.).',
    question: 'What authentication profiles does your app need?',
    type: 'object',
    required: false,
    parent: 'auth',
    children: ['auth.profiles.*'],
  },

  'auth.profiles.*': {
    path: 'auth.profiles.*',
    description: 'A named authentication profile with its own strategy and credentials.',
    question: 'What is the name of this authentication profile?',
    type: 'object',
    required: false,
    parent: 'auth.profiles',
    children: [
      'auth.profiles.*.strategy',
      'auth.profiles.*.credentials',
      'auth.profiles.*.storageStatePath',
    ],
  },

  'auth.profiles.*.strategy': {
    path: 'auth.profiles.*.strategy',
    description:
      'How authentication is handled for this profile: no_auth, login_in_test, or login_before_test.',
    question: 'How should authentication be performed for this profile?',
    type: 'enum',
    enumValues: ['no_auth', 'login_in_test', 'login_before_test'],
    required: false,
    example: 'login_in_test',
    parent: 'auth.profiles.*',
  },

  'auth.profiles.*.credentials': {
    path: 'auth.profiles.*.credentials',
    description: 'Login credentials (email/password) for this auth profile.',
    question: 'What credentials should be used for this profile?',
    type: 'object',
    required: false,
    parent: 'auth.profiles.*',
    children: ['auth.profiles.*.credentials.email', 'auth.profiles.*.credentials.password'],
  },

  'auth.profiles.*.credentials.email': {
    path: 'auth.profiles.*.credentials.email',
    description: 'Environment variable name containing the login email/username for this profile.',
    question: 'Which env variable holds the login email for this profile?',
    type: 'string',
    required: false,
    example: 'E2E_ADMIN_EMAIL',
    parent: 'auth.profiles.*.credentials',
  },

  'auth.profiles.*.credentials.password': {
    path: 'auth.profiles.*.credentials.password',
    description: 'Environment variable name containing the login password for this profile.',
    question: 'Which env variable holds the login password for this profile?',
    type: 'string',
    required: false,
    example: 'E2E_ADMIN_PASSWORD',
    parent: 'auth.profiles.*.credentials',
  },

  'auth.profiles.*.storageStatePath': {
    path: 'auth.profiles.*.storageStatePath',
    description:
      'Path to pre-authenticated browser storage state file for this profile (login_before_test strategy).',
    question: 'Where is the saved authentication state file for this profile?',
    type: 'string',
    required: false,
    example: '.auth/admin.json',
    parent: 'auth.profiles.*',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get metadata for a specific property by its path
 */
export function getPropertyMetadata(path: string): PropertyMetadata | undefined {
  return CONFIG_PROPERTIES[path];
}

/**
 * Get all top-level section properties
 */
export function getTopLevelProperties(): PropertyMetadata[] {
  return Object.values(CONFIG_PROPERTIES).filter(
    (prop) => !prop.parent || prop.parent === undefined
  );
}

/**
 * Get all child properties of a parent property
 */
export function getChildProperties(parentPath: string): PropertyMetadata[] {
  return Object.values(CONFIG_PROPERTIES).filter((prop) => prop.parent === parentPath);
}

/**
 * Get all required properties
 */
export function getRequiredProperties(): PropertyMetadata[] {
  return Object.values(CONFIG_PROPERTIES).filter((prop) => prop.required === true);
}

/**
 * Get all properties in a specific section (e.g., "run", "auth", "tests")
 */
export function getSectionProperties(section: string): PropertyMetadata[] {
  return Object.values(CONFIG_PROPERTIES).filter(
    (prop) => prop.path === section || prop.path.startsWith(`${section}.`)
  );
}

/**
 * Get properties organized by section for guided configuration
 */
export function getPropertiesBySection(): Record<string, PropertyMetadata[]> {
  const sections: Record<string, PropertyMetadata[]> = {
    root: [],
    project: [],
    run: [],
    tests: [],
    auth: [],
  };

  for (const prop of Object.values(CONFIG_PROPERTIES)) {
    if (prop.path === 'version') {
      sections.root.push(prop);
    } else if (prop.path.startsWith('project')) {
      sections.project.push(prop);
    } else if (prop.path.startsWith('run')) {
      sections.run.push(prop);
    } else if (prop.path.startsWith('tests')) {
      sections.tests.push(prop);
    } else if (prop.path.startsWith('auth')) {
      sections.auth.push(prop);
    }
  }

  return sections;
}

/**
 * Validate that a value matches the expected property type
 */
export function validatePropertyValue(
  path: string,
  value: unknown
): { valid: boolean; error?: string } {
  const metadata = CONFIG_PROPERTIES[path];
  if (!metadata) {
    return { valid: false, error: `Unknown property: ${path}` };
  }

  switch (metadata.type) {
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: `${path} must be a string` };
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        return { valid: false, error: `${path} must be a number` };
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: `${path} must be a boolean` };
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        return { valid: false, error: `${path} must be an array` };
      }
      break;
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { valid: false, error: `${path} must be an object` };
      }
      break;
    case 'enum':
      if (!metadata.enumValues?.includes(value as string)) {
        return {
          valid: false,
          error: `${path} must be one of: ${metadata.enumValues?.join(', ')}`,
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * Format schema for MCP tool response.
 * Returns properties organized by section with only leaf properties (no parent objects).
 */
export function formatSchemaForMcp(): {
  sections: Array<{
    name: string;
    description: string;
    properties: Array<{
      path: string;
      description: string;
      question: string;
      type: string;
      required: boolean;
      default?: unknown;
      example?: string;
      enumValues?: string[];
    }>;
  }>;
} {
  const sectionDescriptions: Record<string, string> = {
    project: 'Project identification and environment settings.',
    run: 'Test execution configuration including scripts, timeouts, and artifacts.',
    tests: 'Test file locations, patterns, and selector policies.',
    auth: 'Authentication configuration for tests requiring login.',
  };

  const sections: Array<{
    name: string;
    description: string;
    properties: Array<{
      path: string;
      description: string;
      question: string;
      type: string;
      required: boolean;
      default?: unknown;
      example?: string;
      enumValues?: string[];
    }>;
  }> = [];

  // Process each main section
  for (const sectionName of ['project', 'run', 'tests', 'auth']) {
    const sectionProps = Object.values(CONFIG_PROPERTIES)
      .filter((prop) => {
        // Include properties that belong to this section
        if (!prop.path.startsWith(`${sectionName}.`)) return false;
        // Exclude parent object properties (those with children)
        if (prop.children && prop.children.length > 0) return false;
        // Exclude wildcard patterns (auth.profiles.*)
        if (prop.path.includes('*')) return false;
        return true;
      })
      .map((prop) => ({
        path: prop.path,
        description: prop.description,
        question: prop.question,
        type: prop.type,
        required: prop.required ?? false,
        default: prop.default,
        example: prop.example,
        enumValues: prop.enumValues,
      }));

    if (sectionProps.length > 0) {
      sections.push({
        name: sectionName,
        description: sectionDescriptions[sectionName] || '',
        properties: sectionProps,
      });
    }
  }

  return { sections };
}
