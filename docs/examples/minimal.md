# Minimal Configuration

The simplest valid `kitwe.yaml` — just specify an entrypoint.

```yaml
version: 1

run:
  script: test:e2e
```

## When to Use

Use this when:

- You have an npm script that runs Playwright tests
- No setup commands needed
- No authentication configuration needed
- Default timeout (1200 seconds) is sufficient

## Requirements

Your `package.json` should have the script defined:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

## Running Tests

```bash
tp run --project myapp
```

Or via MCP:

```
run_tests(project_root="/path/to/myapp")
```
