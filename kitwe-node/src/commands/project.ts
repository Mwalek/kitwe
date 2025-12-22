/**
 * Project registry commands
 *
 * kitwe project add <name> <path>
 * kitwe project list
 * kitwe project show <name>
 * kitwe project remove <name>
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import chalk from 'chalk';
import {
  addProject,
  removeProject,
  getProjectInfo,
  listProjects,
  getRegistryPath,
  checkProjectMarkers,
  ProjectExistsError,
  ProjectNotFoundError,
  InvalidProjectPathError,
} from '../core/registry.js';

export function createProjectCommand(): Command {
  const project = new Command('project')
    .description('Manage Kitwe project registry');

  // ==========================================================================
  // project add
  // ==========================================================================
  project
    .command('add')
    .description('Register a project in the Kitwe registry')
    .argument('<name>', 'Unique name for the project (e.g., "horatius", "gravityview")')
    .argument('<path>', 'Path to the project directory')
    .option('-f, --force', 'Overwrite existing project entry')
    .action((name: string, path: string, options: { force?: boolean }) => {
      try {
        const resolvedPath = addProject(name, path, options.force ?? false);

        console.log(chalk.green(`✅ Project '${name}' registered at: ${resolvedPath}`));

        // Check for project markers and warn if missing
        const markers = checkProjectMarkers(resolvedPath);
        const warnings: string[] = [];

        if (!markers.packageJson) {
          warnings.push('No package.json found');
        }
        if (!markers.hasPlaywrightConfig) {
          warnings.push('No playwright.config.ts/js found');
        }

        if (warnings.length > 0) {
          console.log('');
          console.log(chalk.yellow('⚠️  Warnings:'));
          for (const w of warnings) {
            console.log(`   - ${w}`);
          }
          console.log('   This may be OK if your project structure differs.');
        }
      } catch (error) {
        if (error instanceof ProjectExistsError) {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
        if (error instanceof InvalidProjectPathError) {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
        throw error;
      }
    });

  // ==========================================================================
  // project list
  // ==========================================================================
  project
    .command('list')
    .description('List all registered projects')
    .action(() => {
      const projects = listProjects();

      if (projects.length === 0) {
        console.log('No projects registered.');
        console.log('');
        console.log('Register a project with:');
        console.log('  kitwe project add <name> <path>');
        return;
      }

      // Calculate column widths
      const nameWidth = Math.max(
        4, // Minimum "Name" header
        ...projects.map(([name]) => name.length)
      );

      console.log(`${'Name'.padEnd(nameWidth)}  Path`);
      console.log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(40)}`);

      for (const [name, path] of projects) {
        console.log(`${name.padEnd(nameWidth)}  ${path}`);
      }

      console.log('');
      console.log(`Registry: ${getRegistryPath()}`);
    });

  // ==========================================================================
  // project show
  // ==========================================================================
  project
    .command('show')
    .description('Show details for a registered project')
    .argument('<name>', 'Project name to show')
    .action((name: string) => {
      try {
        const info = getProjectInfo(name);

        console.log(`Project: ${name}`);
        console.log(`Path:    ${info.path}`);

        if (info.addedAt) {
          console.log(`Added:   ${info.addedAt}`);
        }

        // Check if path still exists
        const pathExists = existsSync(info.path);

        if (!pathExists) {
          console.log('');
          console.log(chalk.yellow('⚠️  Warning: Path no longer exists!'));
          console.log(`   Update with: kitwe project add ${name} /new/path --force`);
          process.exit(1);
        }

        // Show markers
        const markers = checkProjectMarkers(info.path);
        console.log('');
        console.log('Markers:');
        console.log(`  package.json:        ${markers.packageJson ? '✓' : '✗'}`);
        console.log(`  playwright.config.*: ${markers.hasPlaywrightConfig ? '✓' : '✗'}`);
        console.log(`  kitwe.yaml:          ${markers.kitweYaml ? '✓' : '✗'}`);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          console.error(chalk.red(`Error: Project '${name}' not found in registry.`));
          process.exit(1);
        }
        throw error;
      }
    });

  // ==========================================================================
  // project remove
  // ==========================================================================
  project
    .command('remove')
    .description('Remove a project from the registry (does NOT delete files)')
    .argument('<name>', 'Project name to remove')
    .action((name: string) => {
      try {
        const removedPath = removeProject(name);

        console.log(chalk.green(`✅ Project '${name}' removed from registry.`));
        console.log(`   (Files at ${removedPath} were NOT deleted)`);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          console.error(chalk.red(`Error: Project '${name}' not found in registry.`));
          process.exit(1);
        }
        throw error;
      }
    });

  return project;
}
