# Configuration Reference

Kitwe is configured via `kitwe.yaml` in your project root.

## Minimal Config

The simplest valid configuration:

```yaml
version: 1

run:
  script: test:e2e
```

This assumes you have an npm script called `test:e2e` that runs Playwright.

## Full Config

```yaml
version: 1

project:
  name: my-project
  env_file: .env.test
  base_url: $PLAYWRIGHT_BASE_URL

setup:
  pre_commands:
    - argv: ["npm", "run", "db:reset"]
    - argv: ["npm", "run", "db:seed"]

run:
  script: test:e2e
  timeout_seconds: 1200
  artifacts_dir: test-results
  runner: npm

tests:
  test_dir: e2e
  pattern: "**/*.spec.ts"
  language: typescript

auth:
  default:
    strategy: login_in_test
    credentials:
      email: E2E_TEST_EMAIL
      password: E2E_TEST_PASSWORD
  profiles:
    admin:
      strategy: login_in_test
      credentials:
        email: E2E_ADMIN_EMAIL
        password: E2E_ADMIN_PASSWORD
```

---

## Section Reference

### `version`

**Required.** Configuration schema version.

```yaml
version: 1
```

Currently only version `1` is supported.

---

### `project`

Project metadata and environment settings.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | - | Project name (optional) |
| `env_file` | string | - | Path to .env file to load |
| `base_url` | string | - | Base URL for tests (supports `$VAR` syntax) |

```yaml
project:
  name: my-project
  env_file: .env.test
  base_url: $PLAYWRIGHT_BASE_URL
```

---

### `setup`

Commands to run before test execution.

| Field | Type | Description |
|-------|------|-------------|
| `pre_commands` | array | Commands to run sequentially before tests |

Each command has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `argv` | string[] | Yes | Command as array of arguments |
| `env` | object | No | Environment variable overrides |
| `cwd` | string | No | Working directory |

```yaml
setup:
  pre_commands:
    - argv: ["npm", "run", "db:reset"]
    - argv: ["npm", "run", "db:seed"]
      env:
        NODE_ENV: test
```

---

### `run`

Test execution configuration. **At least `script` or `config_path` is required.**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `script` | string | - | npm script name (e.g., `test:e2e`) |
| `config_path` | string | - | Path to playwright.config.ts |
| `timeout_seconds` | number | `1200` | Maximum execution time |
| `artifacts_dir` | string | `artifacts/kitwe` | Output directory |
| `runner` | string | `npm` | Package manager: `npm`, `pnpm`, `yarn`, `npx` |
| `args` | string[] | - | Additional arguments to pass |
| `env` | object | - | Environment variable overrides |
| `skip_setup` | boolean | `false` | Skip pre_commands |

```yaml
run:
  script: test:e2e
  timeout_seconds: 600
  runner: pnpm
  args:
    - "--workers=4"
  env:
    CI: "true"
```

---

### `tests`

Test file metadata. Used for context generation, not execution.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `test_dir` | string | - | Directory containing tests |
| `pattern` | string | `**/*.spec.ts` | Glob pattern for test files |
| `language` | string | `typescript` | Test language |

```yaml
tests:
  test_dir: e2e
  pattern: "**/*.spec.ts"
  language: typescript
```

---

### `auth`

Authentication configuration for E2E tests.

#### Default Profile

```yaml
auth:
  default:
    strategy: login_in_test
    credentials:
      email: E2E_TEST_EMAIL
      password: E2E_TEST_PASSWORD
```

#### Named Profiles

```yaml
auth:
  default:
    strategy: login_in_test
    credentials:
      email: E2E_TEST_EMAIL
      password: E2E_TEST_PASSWORD
  profiles:
    admin:
      strategy: login_in_test
      credentials:
        email: E2E_ADMIN_EMAIL
        password: E2E_ADMIN_PASSWORD
    readonly:
      strategy: no_auth
```

#### Auth Strategies

| Strategy | Description |
|----------|-------------|
| `no_auth` | No authentication required |
| `login_in_test` | Login during test execution |
| `login_before_test` | Login before tests, save storage state |

#### Credentials

Credential values reference environment variables:

```yaml
credentials:
  email: E2E_TEST_EMAIL      # Uses $E2E_TEST_EMAIL
  password: E2E_TEST_PASSWORD  # Uses $E2E_TEST_PASSWORD
```

---

## Environment Variables

Config values can reference environment variables with `$VAR` or `${VAR}` syntax:

```yaml
project:
  base_url: $PLAYWRIGHT_BASE_URL

run:
  env:
    API_KEY: ${API_KEY}
```

Variables are resolved at runtime from `process.env`.

---

## Examples

### Script-based (most common)

```yaml
version: 1

project:
  name: my-app

run:
  script: test:e2e
  timeout_seconds: 600
  args:
    - "--workers=4"
```

### Config-based

```yaml
version: 1

run:
  config_path: playwright.config.ts
  timeout_seconds: 1200
```

### With authentication

```yaml
version: 1

run:
  script: test:e2e

auth:
  default:
    strategy: login_in_test
    credentials:
      email: E2E_TEST_EMAIL
      password: E2E_TEST_PASSWORD
```

### With setup commands

```yaml
version: 1

setup:
  pre_commands:
    - argv: ["npm", "run", "db:reset"]
    - argv: ["npm", "run", "db:seed"]

run:
  script: test:e2e
```
