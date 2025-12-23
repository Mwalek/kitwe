# Getting Started

Get Kitwe running in your project in a few minutes.

## Installation

### From npm (recommended)

```bash
npm install -g @mwalek/kitwe
```

### From source

```bash
git clone https://github.com/Mwalek/kitwe.git
cd kitwe
npm install && npm run build && npm link
```

## Register a Project

Register your project with Kitwe:

```bash
kitwe project add myapp /path/to/project
```

Or use the `tp` alias:

```bash
tp project add myapp /path/to/project
```

## Create Configuration

Create a `kitwe.yaml` file in your project root:

```yaml
version: 1

run:
  script: test:e2e
```

This minimal config tells Kitwe which npm script runs your Playwright tests.

You can also generate a template:

```bash
tp config init --project myapp
```

## Run Tests

### Via CLI

```bash
tp run --project myapp
```

### Via MCP (AI Agents)

AI agents use the MCP server. Add to Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kitwe": {
      "command": "kitwe-mcp",
      "args": []
    }
  }
}
```

The agent can then call:

```
get_project_context(project="myapp")  # Get AI-readable context
run_tests(project_root="/path/to/myapp")  # Execute tests
```

## Verify Setup

Check your project is registered:

```bash
tp project list
```

Validate your configuration:

```bash
tp config validate --project myapp
```

## Next Steps

- [Configuration Reference](configuration.md) — Full config options
- [CLI Reference](cli.md) — All commands and options
- [MCP Tools](mcp-tools.md) — AI agent integration
