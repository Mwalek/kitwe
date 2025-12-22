/**
 * Kitwe Project Registry
 *
 * Manages a local user-level registry mapping project names to absolute paths on disk.
 * Registry is stored in the OS-appropriate user config directory.
 *
 * Registry location:
 *   - macOS: ~/Library/Preferences/kitwe/projects.yaml
 *   - Linux: ~/.config/kitwe/projects.yaml
 *   - Windows: %APPDATA%/kitwe/Config/projects.yaml
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import envPaths from 'env-paths';
import yaml from 'js-yaml';
import type { ProjectEntry, Registry } from '../types/index.js';

// Get cross-platform config directory
const paths = envPaths('kitwe', { suffix: '' });

// =============================================================================
// Error Classes
// =============================================================================

export class ProjectExistsError extends Error {
  constructor(
    public readonly name: string,
    public readonly existingPath: string
  ) {
    super(
      `Project '${name}' already exists at: ${existingPath}\n` +
      `Use --force to overwrite.`
    );
    this.name = 'ProjectExistsError';
  }
}

export class ProjectNotFoundError extends Error {
  constructor(public readonly projectName: string) {
    super(`Project '${projectName}' not found in registry.`);
    this.name = 'ProjectNotFoundError';
  }
}

export class InvalidProjectPathError extends Error {
  constructor(
    public readonly path: string,
    public readonly reason: string
  ) {
    super(`Invalid project path '${path}': ${reason}`);
    this.name = 'InvalidProjectPathError';
  }
}

// =============================================================================
// Registry Path
// =============================================================================

/**
 * Get the path to the projects registry file.
 */
export function getRegistryPath(): string {
  return resolve(paths.config, 'projects.yaml');
}

/**
 * Ensure registry directory exists.
 */
function ensureRegistryDir(): string {
  const registryPath = getRegistryPath();
  const dir = dirname(registryPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return registryPath;
}

// =============================================================================
// Load / Save Registry
// =============================================================================

/**
 * Load the projects registry from disk.
 *
 * @returns Registry object with version and projects map.
 *          Empty registry if file doesn't exist.
 */
export function loadRegistry(): Registry {
  const registryPath = getRegistryPath();

  if (!existsSync(registryPath)) {
    return { version: 1, projects: {} };
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const data = yaml.load(content) as Record<string, unknown> | null;

    if (!data) {
      return { version: 1, projects: {} };
    }

    // Handle both new format (with version) and old format (just projects)
    const projects: Record<string, ProjectEntry> = {};

    // Check if it's the new format with version
    if ('version' in data && 'projects' in data) {
      const rawProjects = data.projects as Record<string, unknown>;
      for (const [name, entry] of Object.entries(rawProjects)) {
        if (typeof entry === 'object' && entry !== null && 'path' in entry) {
          projects[name] = entry as ProjectEntry;
        }
      }
      return { version: (data.version as number) || 1, projects };
    }

    // Old format: entries are directly project name -> data
    for (const [name, entry] of Object.entries(data)) {
      if (typeof entry === 'string') {
        // Very old format: value is just the path
        projects[name] = { path: entry, addedAt: '' };
      } else if (typeof entry === 'object' && entry !== null && 'path' in entry) {
        const e = entry as Record<string, unknown>;
        projects[name] = {
          path: e.path as string,
          addedAt: (e.added_at as string) || (e.addedAt as string) || '',
        };
      }
    }

    return { version: 1, projects };
  } catch {
    // If parsing fails, return empty registry
    return { version: 1, projects: {} };
  }
}

/**
 * Save the projects registry to disk.
 *
 * @param registry - Registry object to save.
 */
export function saveRegistry(registry: Registry): void {
  const registryPath = ensureRegistryDir();

  // Sort projects by name for stable ordering
  const sortedProjects: Record<string, ProjectEntry> = {};
  for (const name of Object.keys(registry.projects).sort()) {
    sortedProjects[name] = registry.projects[name];
  }

  // Convert to YAML-friendly format with snake_case keys
  const yamlData: Record<string, Record<string, string>> = {};
  for (const [name, entry] of Object.entries(sortedProjects)) {
    yamlData[name] = {
      path: entry.path,
      added_at: entry.addedAt,
    };
  }

  const content = yaml.dump(yamlData, {
    indent: 2,
    lineWidth: -1, // Don't wrap lines
    noRefs: true,
  });

  writeFileSync(registryPath, content, 'utf-8');
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Add a project to the registry.
 *
 * @param name - Project name (unique identifier).
 * @param path - Path to the project directory.
 * @param force - If true, overwrite existing entry.
 * @returns The resolved absolute path that was stored.
 * @throws ProjectExistsError if project exists and force=false.
 * @throws InvalidProjectPathError if path doesn't exist or isn't a directory.
 */
export function addProject(name: string, path: string, force = false): string {
  // Resolve and validate path
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    throw new InvalidProjectPathError(path, 'path does not exist');
  }

  const stats = statSync(resolvedPath);
  if (!stats.isDirectory()) {
    throw new InvalidProjectPathError(path, 'path is not a directory');
  }

  // Load existing registry
  const registry = loadRegistry();

  // Check for existing entry
  if (name in registry.projects && !force) {
    throw new ProjectExistsError(name, registry.projects[name].path);
  }

  // Add/update entry
  registry.projects[name] = {
    path: resolvedPath,
    addedAt: new Date().toISOString(),
  };

  // Save
  saveRegistry(registry);

  return resolvedPath;
}

/**
 * Remove a project from the registry.
 *
 * @param name - Project name to remove.
 * @returns The path of the removed project.
 * @throws ProjectNotFoundError if project doesn't exist.
 */
export function removeProject(name: string): string {
  const registry = loadRegistry();

  if (!(name in registry.projects)) {
    throw new ProjectNotFoundError(name);
  }

  const removedPath = registry.projects[name].path;
  delete registry.projects[name];

  saveRegistry(registry);

  return removedPath;
}

/**
 * Get the path for a registered project.
 *
 * @param name - Project name to look up.
 * @returns Absolute path to the project directory.
 * @throws ProjectNotFoundError if project doesn't exist.
 */
export function getProjectPath(name: string): string {
  const registry = loadRegistry();

  if (!(name in registry.projects)) {
    throw new ProjectNotFoundError(name);
  }

  return registry.projects[name].path;
}

/**
 * Get full info for a registered project.
 *
 * @param name - Project name to look up.
 * @returns Project entry with path, addedAt, etc.
 * @throws ProjectNotFoundError if project doesn't exist.
 */
export function getProjectInfo(name: string): ProjectEntry {
  const registry = loadRegistry();

  if (!(name in registry.projects)) {
    throw new ProjectNotFoundError(name);
  }

  return registry.projects[name];
}

/**
 * List all registered projects.
 *
 * @returns Array of [name, path] tuples, sorted by name.
 */
export function listProjects(): Array<[string, string]> {
  const registry = loadRegistry();
  return Object.entries(registry.projects)
    .map(([name, entry]) => [name, entry.path] as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

// =============================================================================
// Project Markers
// =============================================================================

/**
 * Check for common project markers in the given path.
 *
 * @param projectPath - Project directory path.
 * @returns Object indicating which markers are present.
 */
export function checkProjectMarkers(projectPath: string): {
  packageJson: boolean;
  playwrightConfigTs: boolean;
  playwrightConfigJs: boolean;
  kitweYaml: boolean;
  hasPlaywrightConfig: boolean;
} {
  const markers = {
    packageJson: existsSync(resolve(projectPath, 'package.json')),
    playwrightConfigTs: existsSync(resolve(projectPath, 'playwright.config.ts')),
    playwrightConfigJs: existsSync(resolve(projectPath, 'playwright.config.js')),
    kitweYaml: existsSync(resolve(projectPath, 'kitwe.yaml')),
    hasPlaywrightConfig: false,
  };

  markers.hasPlaywrightConfig = markers.playwrightConfigTs || markers.playwrightConfigJs;

  return markers;
}
