/**
 * Kitwe - Playwright test execution and validation
 *
 * This module exports the public API for programmatic usage.
 */

// Re-export types
export type {
  // Registry
  ProjectEntry,
  Registry,
  // Config
  RunnerType,
  PreCommand,
  RunConfig,
  TestsConfig,
  AuthConfig,
  AuthProfile,
  AuthStrategy,
  Credentials,
  SelectorPolicy,
  ProjectSection,
  KitweConfig,
  // Run Result
  RunStatus,
  ArtifactInfo,
  RunSpec,
  RunResult,
  // CLI
  ProjectResolveOptions,
  RunOptions,
} from './types/index.js';

// Core modules
export {
  // Registry
  loadRegistry,
  saveRegistry,
  addProject,
  removeProject,
  getProjectPath,
  getProjectInfo,
  listProjects,
  getRegistryPath,
  checkProjectMarkers,
  // Errors
  ProjectExistsError,
  ProjectNotFoundError,
  InvalidProjectPathError,
} from './core/registry.js';

// Config module
export {
  loadProjectConfig,
  loadRunConfig,
  loadTestsConfig,
  loadAuthConfig,
  getConfigPath,
  getRunPreCommands,
  getProjectBaseUrl,
  validateConfigFile,
  createConfigTemplate,
  resolveEnvValue,
  // Errors
  ConfigLoadError,
  ConfigValidationError,
  ConfigNotFoundError,
} from './core/config.js';

// Paths module
export {
  resolveProjectRoot,
  resolvePathRelativeToProject,
  // Errors
  ProjectRootError,
} from './core/paths.js';

// Validate module
export {
  runValidate,
  type ProgressCallback,
} from './runner/executor.js';

export {
  resolveRunSpec,
  detectPackageManager,
  isResolvedCommand,
  isResolvedError,
  type ResolvedCommand,
  type ResolvedError,
  type ResolveResult,
} from './runner/resolver.js';

// Artifacts module
export {
  ArtifactsDir,
  getArtifactType,
  collectArtifacts,
  copyArtifacts,
  getPlaywrightOutputDirs,
  findJsonReport,
  parseJsonReport,
  type TestSummary,
} from './core/artifacts.js';

// Formatter module
export {
  Verbosity,
  ReportFormatter,
  formatResult,
  printResult,
  formatStatus,
  formatStatusIcon,
  formatDuration,
  formatSize,
  formatProgressStep,
  createProgressPrinter,
  type ReportContext,
  type ReportOutput,
  type FailureInfo,
} from './runner/formatter.js';
