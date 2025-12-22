/**
 * Configuration commands
 *
 * kitwe config show --project <name>
 * kitwe config init --project <name>
 * kitwe config validate --project <name>
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadProjectConfig,
  getConfigPath,
  validateConfigFile,
  createConfigTemplate,
  ConfigLoadError,
  ConfigValidationError,
} from '../core/config.js';
import { resolveProjectRoot, ProjectRootError } from '../core/paths.js';

export function createConfigCommand(): Command {
  const config = new Command('config')
    .description('Manage Kitwe project configuration');

  // ==========================================================================
  // config show
  // ==========================================================================
  config
    .command('show')
    .description('Show the current project configuration')
    .option('-p, --project-root <path>', 'Path to the project root directory')
    .option('--project <name>', 'Registered project name')
    .option('--json', 'Output as JSON')
    .action((options: { projectRoot?: string; project?: string; json?: boolean }) => {
      try {
        const projectRoot = resolveProjectRoot(options);
        const configPath = getConfigPath(projectRoot);
        const cfg = loadProjectConfig(projectRoot);

        if (cfg === null) {
          console.error(chalk.red(`Error: Config file not found at ${configPath}`));
          console.log('');
          console.log('Create a config with:');
          console.log(`  kitwe config init --project-root ${projectRoot}`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(cfg, null, 2));
        } else {
          console.log(chalk.cyan(`Configuration: ${configPath}`));
          console.log('');
          printConfig(cfg);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // ==========================================================================
  // config init
  // ==========================================================================
  config
    .command('init')
    .description('Create a template kitwe.yaml configuration file')
    .option('-p, --project-root <path>', 'Path to the project root directory')
    .option('--project <name>', 'Registered project name')
    .option('-f, --force', 'Overwrite existing config')
    .option('--with-auth', 'Include auth section template')
    .action((options: { projectRoot?: string; project?: string; force?: boolean; withAuth?: boolean }) => {
      try {
        const projectRoot = resolveProjectRoot(options);

        const createdPath = createConfigTemplate(projectRoot, {
          force: options.force,
          withAuth: options.withAuth,
        });

        console.log(chalk.green(`✅ Created config at: ${createdPath}`));

        if (options.withAuth) {
          console.log('');
          console.log(chalk.yellow('⚠️  Remember to set environment variables:'));
          console.log('   E2E_TEST_EMAIL, E2E_TEST_PASSWORD');
          console.log('   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD');
        }
      } catch (error) {
        handleError(error);
      }
    });

  // ==========================================================================
  // config validate
  // ==========================================================================
  config
    .command('validate')
    .description('Validate the kitwe.yaml configuration file')
    .option('-p, --project-root <path>', 'Path to the project root directory')
    .option('--project <name>', 'Registered project name')
    .action((options: { projectRoot?: string; project?: string }) => {
      try {
        const projectRoot = resolveProjectRoot(options);
        const configPath = getConfigPath(projectRoot);
        const result = validateConfigFile(projectRoot);

        console.log(chalk.cyan(`Validating: ${configPath}`));
        console.log('');

        if (result.errors.length > 0) {
          console.log(chalk.red('❌ Validation errors:'));
          for (const err of result.errors) {
            console.log(`   ${chalk.red('•')} ${err}`);
          }
          console.log('');
        }

        if (result.warnings.length > 0) {
          console.log(chalk.yellow('⚠️  Warnings:'));
          for (const warn of result.warnings) {
            console.log(`   ${chalk.yellow('•')} ${warn}`);
          }
          console.log('');
        }

        if (result.valid) {
          console.log(chalk.green('✅ Configuration is valid'));
          if (result.warnings.length === 0) {
            console.log(chalk.green('   No warnings'));
          }
        } else {
          process.exit(1);
        }
      } catch (error) {
        handleError(error);
      }
    });

  return config;
}

// =============================================================================
// Helper Functions
// =============================================================================

function handleError(error: unknown): never {
  if (error instanceof ProjectRootError) {
    console.error(chalk.red('Error: ') + error.message);
    process.exit(1);
  }
  if (error instanceof ConfigLoadError) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
  if (error instanceof ConfigValidationError) {
    console.error(chalk.red(error.message));
    process.exit(1);
  }
  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
  throw error;
}

function printConfig(cfg: ReturnType<typeof loadProjectConfig>): void {
  if (!cfg) return;

  console.log(chalk.bold('version:'), cfg.version);

  // Project section
  if (cfg.project) {
    console.log('');
    console.log(chalk.bold('project:'));
    if (cfg.project.name) console.log(`  name: ${cfg.project.name}`);
    if (cfg.project.envFile) console.log(`  env_file: ${cfg.project.envFile}`);
    if (cfg.project.baseUrl) console.log(`  base_url: ${cfg.project.baseUrl}`);
  }

  // Run section
  if (cfg.run) {
    console.log('');
    console.log(chalk.bold('run:'));
    if (cfg.run.runner) console.log(`  runner: ${cfg.run.runner}`);
    if (cfg.run.script) console.log(`  script: ${cfg.run.script}`);
    if (cfg.run.configPath) console.log(`  config_path: ${cfg.run.configPath}`);
    console.log(`  timeout_seconds: ${cfg.run.timeoutSeconds}`);
    console.log(`  artifacts_dir: ${cfg.run.artifactsDir}`);
    if (cfg.run.outputDir) console.log(`  output_dir: ${cfg.run.outputDir}`);
    if (cfg.run.args && cfg.run.args.length > 0) {
      console.log(`  args: [${cfg.run.args.join(', ')}]`);
    }
    if (cfg.run.env) {
      console.log('  env:');
      for (const [k, v] of Object.entries(cfg.run.env)) {
        console.log(`    ${k}: ${v}`);
      }
    }
    if (cfg.run.preCommands && cfg.run.preCommands.length > 0) {
      console.log(`  pre_commands: (${cfg.run.preCommands.length} commands)`);
    }
  }

  // Tests section
  if (cfg.tests) {
    console.log('');
    console.log(chalk.bold('tests:'));
    if (cfg.tests.testDir) console.log(`  test_dir: ${cfg.tests.testDir}`);
    if (cfg.tests.pattern) console.log(`  pattern: ${cfg.tests.pattern}`);
    if (cfg.tests.defaultOutputPath) console.log(`  default_output_path: ${cfg.tests.defaultOutputPath}`);
    if (cfg.tests.selectorPolicy) {
      console.log('  selector_policy:');
      if (cfg.tests.selectorPolicy.prefer) {
        console.log(`    prefer: [${cfg.tests.selectorPolicy.prefer.join(', ')}]`);
      }
      if (cfg.tests.selectorPolicy.avoid) {
        console.log(`    avoid: [${cfg.tests.selectorPolicy.avoid.join(', ')}]`);
      }
    }
  }

  // Auth section
  if (cfg.auth) {
    console.log('');
    console.log(chalk.bold('auth:'));
    if (cfg.auth.envFile) console.log(`  env_file: ${cfg.auth.envFile}`);
    if (cfg.auth.default) {
      console.log('  default:');
      console.log(`    strategy: ${cfg.auth.default.strategy}`);
      if (cfg.auth.default.credentials) {
        console.log('    credentials:');
        console.log(`      email: ${cfg.auth.default.credentials.email}`);
        console.log(`      password: ${cfg.auth.default.credentials.password}`);
      }
    }
    const profileNames = Object.keys(cfg.auth.profiles);
    if (profileNames.length > 0) {
      console.log(`  profiles: [${profileNames.join(', ')}]`);
    }
  }
}
