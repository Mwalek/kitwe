# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-12-22

### Added
- MCP server with tools for AI agent integration
- `get_project_context` tool for AI-readable project context
- `run_tests` tool for test execution with structured results
- `create_config` and `get_config_schema` MCP tools for configuration assistance
- Authentication profiles support (`auth` config section)
- Pre-test setup commands (`setup.pre_commands`)
- Artifact collection and management
- Config validation with Zod schemas
- CLI commands: `project`, `config`, `run`
- `tp` alias for `kitwe` command

### Changed
- Complete rewrite in Node.js/TypeScript (from Python)
- Configuration file format standardized as `kitwe.yaml`

## [0.2.0] - 2025-12-01

### Added
- Authentication profiles support
- Environment variable expansion in config

## [0.1.0] - 2025-11-15

### Added
- Initial release
- Project registry management
- Basic test execution
- CLI interface
