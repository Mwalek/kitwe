# Contributing to Kitwe

Thanks for your interest in contributing to Kitwe!

## Development Setup

```bash
cd kitwe-node
npm install
npm run build
npm test
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Commit with a clear message
7. Push and open a Pull Request

## Code Style

- TypeScript with strict mode
- Use descriptive variable and function names
- Add tests for new functionality
- Keep functions focused and small

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- tests/config.test.ts
```

## Project Structure

```
kitwe-node/
  src/
    cli.ts              # CLI entry point
    mcp-server.ts       # MCP server
    core/               # Infrastructure modules
    runner/             # Test execution
    types/              # TypeScript definitions
  tests/                # Test files
```

## Pull Request Guidelines

- Keep PRs focused on a single change
- Update tests if changing behavior
- Ensure all tests pass before submitting
- Provide a clear description of what changed and why

## Reporting Issues

When reporting bugs, please include:
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior

## Questions?

Open an issue with the "question" label.
