# Configuration with Authentication

Configure authentication profiles for E2E tests that require login.

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
  profiles:
    admin:
      strategy: login_in_test
      credentials:
        email: E2E_ADMIN_EMAIL
        password: E2E_ADMIN_PASSWORD
    readonly:
      strategy: no_auth
```

## Auth Strategies

| Strategy | Description |
|----------|-------------|
| `no_auth` | No authentication required |
| `login_in_test` | Login during test execution |
| `login_before_test` | Login before tests, save storage state |

## Credential Resolution

Credential values are environment variable names:

```yaml
credentials:
  email: E2E_TEST_EMAIL      # Uses process.env.E2E_TEST_EMAIL
  password: E2E_TEST_PASSWORD  # Uses process.env.E2E_TEST_PASSWORD
```

Set these in your `.env` file or environment.

## Using Auth Profiles

### CLI

The CLI runs tests; your test code accesses auth via Kitwe's context.

### MCP Tools

List available profiles:

```
list_auth_profiles(project_root="/path/to/myapp")
```

Resolve a specific profile:

```
resolve_auth_profile(project_root="/path/to/myapp", profile="admin")
```

Returns:

```json
{
  "strategy": "login_in_test",
  "credentials": {
    "email": "admin@example.com",
    "password": "admin123"
  }
}
```
