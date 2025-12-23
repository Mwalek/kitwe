#!/usr/bin/env node
/**
 * Kitwe CLI - Playwright test execution and validation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createProjectCommand } from './commands/project.js';
import { createConfigCommand } from './commands/config.js';
import { createRunCommand } from './commands/run.js';

const VERSION = '0.0.1';

const program = new Command();

program
  .name('kitwe')
  .description('Playwright test execution and validation CLI')
  .version(VERSION, '-V, --version', 'Output the version number');

// Add subcommands
program.addCommand(createProjectCommand());
program.addCommand(createConfigCommand());
program.addCommand(createRunCommand());

// Custom help
program.addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.gray('# Register a project')}
  $ kitwe project add myapp /path/to/project

  ${chalk.gray('# Show project configuration')}
  $ kitwe config show --project myapp

  ${chalk.gray('# Run tests')}
  $ kitwe run --project myapp --script test:e2e

${chalk.bold('Documentation:')}
  https://github.com/Mwalek/kitwe
`);

// Error handling
program.exitOverride((err) => {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  process.exit(1);
});

// Parse and run
program.parse();
