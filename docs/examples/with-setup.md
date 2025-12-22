# Configuration with Setup Commands

Run commands before tests to prepare the environment (database reset, seeding, etc.).

```yaml
version: 1

setup:
  pre_commands:
    - argv: ["npm", "run", "db:reset"]
    - argv: ["npm", "run", "db:seed"]

run:
  script: test:e2e
```

## Pre-Command Format

Each command uses the `argv` format (array of strings):

```yaml
pre_commands:
  - argv: ["npm", "run", "db:reset"]
  - argv: ["npm", "run", "db:seed"]
```

## With Environment Variables

Override environment for specific commands:

```yaml
setup:
  pre_commands:
    - argv: ["npm", "run", "db:reset"]
      env:
        NODE_ENV: test
        DB_HOST: localhost
```

## With Working Directory

Run from a specific directory:

```yaml
setup:
  pre_commands:
    - argv: ["./scripts/setup.sh"]
      cwd: ./backend
```

## Execution Behavior

- Commands run **sequentially** in order
- If any command fails, execution **stops** (fail fast)
- Output is logged to the artifacts directory
- Use `--skip-setup` flag to skip pre_commands

## Skipping Setup

Sometimes you want to run tests without setup (e.g., debugging):

```bash
tp run --project myapp --skip-setup
```

Or via MCP:

```
run_tests(project_root="/path/to/myapp", skip_setup=true)
```

## Full Example

```yaml
version: 1

project:
  name: my-app
  env_file: .env.test

setup:
  pre_commands:
    - argv: ["docker", "compose", "up", "-d", "db"]
    - argv: ["npm", "run", "db:migrate"]
    - argv: ["npm", "run", "db:seed"]

run:
  script: test:e2e
  timeout_seconds: 600
```
