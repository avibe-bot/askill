# Contributing to askill

Thank you for your interest in contributing to askill! This document provides guidelines and instructions for development.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Building](#building)
- [Testing](#testing)
- [Release Process](#release-process)
- [Code Style](#code-style)
- [Pull Request Guidelines](#pull-request-guidelines)

## Development Setup

### Prerequisites

- Node.js 20+
- npm or bun
- Docker (for E2E tests)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/avibe-bot/askill.git
cd askill

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/cli.mjs --help
```

## Project Structure

```
askill/
├── src/                    # CLI source code
│   ├── cli.ts              # Main entry point & command routing
│   ├── api.ts              # API client for askill.sh
│   ├── installer.ts        # Skill installation logic
│   ├── config.ts           # User preferences management
│   ├── updater.ts          # Self-update mechanism
│   └── constants.ts        # Config and agent definitions
├── docs/                   # Documentation
│   ├── introduction.md     # Overview
│   ├── getting-started.md  # Quick start guide
│   ├── skill-spec.md       # SKILL.md protocol
│   ├── slug-system.md      # Skill identification
│   ├── publishing.md       # Publishing guide
│   ├── cli-reference.md    # CLI commands reference
│   └── api-spec.md         # REST API specification
├── skills/                 # Official bundled skills
│   ├── use-askill/         # Teaches agents to use askill effectively
│   └── build-askill-skill/ # Teaches agents to author askill skills
├── test/
│   └── e2e/
│       ├── run.sh          # Main E2E test suite
│       └── install-methods.sh  # Installation tests
├── Dockerfile.test         # E2E test environment
├── Dockerfile.install-test # Installation test environment
├── package.json
├── tsconfig.json
└── README.md
```

## Building

```bash
# Development build
npm run build

# Watch mode (if available)
npm run dev

# Type check only
npx tsc --noEmit
```

The build outputs to `dist/cli.mjs` - a single bundled ESM file.

## Testing

### E2E Tests (Docker)

```bash
# Build test image
docker build -f Dockerfile.test -t askill-test .

# Run all tests
docker run --rm askill-test

# Run specific test
docker run --rm askill-test test/e2e/run.sh test_install_local

# List available tests
docker run --rm askill-test test/e2e/run.sh --list
```

### Installation Method Tests

```bash
# Build install test image
docker build -f Dockerfile.install-test -t askill-install-test .

# Run all installation tests
docker run --rm askill-install-test

# Run specific method
docker run --rm askill-install-test npm
docker run --rm askill-install-test npx
docker run --rm askill-install-test bun
docker run --rm askill-install-test binary
docker run --rm askill-install-test github
```

### Local Testing

```bash
# Run built CLI
node dist/cli.mjs --help

# Test with local skill
node dist/cli.mjs add ./skills/use-askill -y
```

## Release Process

Releases are automated via GitHub Actions.

### Creating a Release

1. Update version in `package.json`
2. Update `VERSION` constant in `src/constants.ts`
3. Commit: `git commit -am "chore: bump version to X.Y.Z"`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push origin main --tags`

The release workflow will:
- Build binaries for 5 platforms (darwin-arm64, darwin-x64, linux-arm64, linux-x64, win32-x64)
- Create a GitHub Release with binaries
- Publish to npm via OIDC Trusted Publishing

### Version Bump Helper

```bash
./scripts/release.sh patch  # 0.1.0 -> 0.1.1
./scripts/release.sh minor  # 0.1.0 -> 0.2.0
./scripts/release.sh major  # 0.1.0 -> 1.0.0
```

## Code Style

- TypeScript with strict mode
- ESM modules (`.mjs` extension)
- No semicolons (handled by build)
- 2-space indentation
- Single quotes for strings

### Key Conventions

```typescript
// Use descriptive variable names
const installedSkills = await getInstalledSkills();

// Handle errors gracefully with user-friendly messages
try {
  await installSkill(source);
} catch (error) {
  console.log(`${RED}Installation failed: ${error.message}${RESET}`);
  process.exit(1);
}

// Use constants for colors and config
import { CYAN, GREEN, RESET } from './constants.ts';
```

## Pull Request Guidelines

### Before Submitting

1. **Run tests**: Ensure all E2E tests pass in Docker
2. **Build**: Verify `npm run build` succeeds
3. **Test manually**: Try your changes with `node dist/cli.mjs`

### PR Format

```
feat: add new command for X

- Description of what this PR does
- Any breaking changes
- Related issues: #123
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

## Related Projects

| Project | Description | Repository |
|---------|-------------|------------|
| askill | CLI and documentation | [avibe-bot/askill](https://github.com/avibe-bot/askill) |
| askill-registry | Web platform and API | [avibe-bot/askill-registry](https://github.com/avibe-bot/askill-registry) |

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide reproduction steps for bugs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
