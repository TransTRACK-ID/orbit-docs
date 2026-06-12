# Contributing to Orbit Docs

Thank you for your interest in contributing! This document covers the basics for getting started.

## Development Setup

1. Fork and clone the repository.
2. Copy `.env.example` to `.env` and configure a local PostgreSQL database.
3. Install dependencies:

```bash
bun install   # preferred — matches Dockerfile and bun.lock
# or
pnpm install
```

4. Start the development server:

```bash
bun run dev
```

5. Run tests before submitting a PR:

```bash
bun run test
```

## Branching

- Create feature branches from `main`.
- Use descriptive branch names, e.g. `feature/add-export-csv` or `fix/login-redirect`.
- Keep PRs focused — one logical change per pull request.

## Code Style

- Follow existing patterns in the codebase (Nuxt 3, Vue 3 Composition API, Drizzle ORM).
- Match import aliases (`~/server/...`, `~/types`, `~/composables/...`).
- Add or update tests when changing server utilities or composables with existing test coverage.

## Pull Requests

1. Ensure `bun run test` passes.
2. Update documentation if your change affects setup, configuration, or public APIs.
3. Fill in the PR template with a clear summary and test plan.
4. Link related issues when applicable.

## Reporting Issues

- Use GitHub Issues for bugs and feature requests.
- For security vulnerabilities, see [SECURITY.md](SECURITY.md) — do not open public issues for security reports.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
