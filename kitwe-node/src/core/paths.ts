/**
 * Kitwe Path Resolution
 *
 * Handles project root resolution from CLI options with consistent behavior
 * across all commands. No CWD-based detection - explicit paths only.
 */

import { existsSync, statSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { getProjectPath, ProjectNotFoundError } from './registry.js';

// =============================================================================
// Error Classes
// =============================================================================

export class ProjectRootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectRootError';
  }
}

// =============================================================================
// Path Resolution
// =============================================================================

/**
 * Resolve project root from CLI options.
 *
 * Resolution priority:
 * 1. If --project-root provided: use it (absolute resolved path)
 * 2. Else if --project provided: look up in registry; use stored path
 * 3. Else: throw error with actionable message
 *
 * @param options - CLI options with project or projectRoot.
 * @returns Resolved absolute path to project root.
 * @throws ProjectRootError if project root cannot be determined.
 */
export function resolveProjectRoot(options: {
  project?: string;
  projectRoot?: string;
}): string {
  const { project, projectRoot } = options;

  // Priority 1: Explicit project_root wins
  if (projectRoot != null) {
    const resolved = resolve(projectRoot);

    if (!existsSync(resolved)) {
      throw new ProjectRootError(`Project root does not exist: ${resolved}`);
    }

    const stats = statSync(resolved);
    if (!stats.isDirectory()) {
      throw new ProjectRootError(`Project root is not a directory: ${resolved}`);
    }

    return resolved;
  }

  // Priority 2: Look up project name in registry
  if (project != null) {
    try {
      const pathStr = getProjectPath(project);
      const resolved = resolve(pathStr);

      // Verify path still exists
      if (!existsSync(resolved)) {
        throw new ProjectRootError(
          `Registered project '${project}' path no longer exists: ${pathStr}\n` +
          `Update with: kitwe project add ${project} /new/path --force`
        );
      }

      const stats = statSync(resolved);
      if (!stats.isDirectory()) {
        throw new ProjectRootError(
          `Registered project '${project}' path is not a directory: ${pathStr}`
        );
      }

      return resolved;
    } catch (err) {
      if (err instanceof ProjectNotFoundError) {
        throw new ProjectRootError(
          `Project '${project}' not found in registry.\n` +
          `Register with: kitwe project add ${project} /path/to/project`
        );
      }
      throw err;
    }
  }

  // Priority 3: No project root specified - error
  throw new ProjectRootError(
    'Project root not specified.\n\n' +
    'Provide --project-root or register a project:\n' +
    '  kitwe project add <name> <path>\n' +
    '  kitwe <command> --project <name>\n\n' +
    'Or specify explicitly:\n' +
    '  kitwe <command> --project-root /path/to/project'
  );
}

/**
 * Resolve a path relative to project root.
 *
 * If path is absolute, return as-is. If relative, resolve against project_root.
 *
 * @param path - Path string (absolute or relative).
 * @param projectRoot - Project root to resolve relative paths against.
 * @param mustExist - If true, throw error if resolved path doesn't exist.
 * @returns Resolved absolute path.
 * @throws Error if mustExist=true and path doesn't exist.
 */
export function resolvePathRelativeToProject(
  path: string,
  projectRoot: string,
  mustExist = false
): string {
  const resolved = isAbsolute(path)
    ? resolve(path)
    : resolve(projectRoot, path);

  if (mustExist && !existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }

  return resolved;
}
