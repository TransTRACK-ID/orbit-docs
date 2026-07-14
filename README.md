# Orbit Docs

Centralized documentation, changelog, and release management for software teams.

Orbit Docs replaces scattered markdown files and manual release processes with a structured, version-centric workflow: write docs, edit changelogs tied to app versions, and publish releases from a single source of truth.

## Features

- **Version-centric docs & changelogs** — tie documentation and release notes to app versions
- **AI-assisted doc generation** — generate SRS, FSD, and SDD documents from Git repositories
- **MCP server** — integrate with AI agents via the Model Context Protocol ([MCP_SERVER.md](MCP_SERVER.md))
- **SSO** — Google, GitHub, Azure AD, Keycloak, and generic OIDC
- **Published docs & release pages** — share documentation and release announcements publicly
- **Self-hosted** — runs on your infrastructure with PostgreSQL

## Quick Start (Docker)

1. Copy the environment template and configure required values:

```bash
cp .env.example .env
```

Set at minimum: `DATABASE_URL`, `JWT_SECRET`, `APP_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.

2. Start the application:

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000` (or the port set via `COMPOSE_PUBLIC_PORT`).

## Quick Start (Local)

**Requirements:** Node.js 20+, PostgreSQL, and [Bun](https://bun.sh) or [pnpm](https://pnpm.io).

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

bun install   # or: pnpm install
bun run dev   # or: pnpm dev
```

On first boot, the database is initialized automatically with demo data. A default admin user is created when no users exist:

| Field    | Value                 |
|----------|-----------------------|
| Email    | `preview@example.com` |
| Password | `password123`         |

Change these credentials in production by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before the first run, or create a new admin via the settings UI.

Optional: load extended demo seed data (sample apps, versions, releases):

```bash
bun run db:seed
```

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing session tokens |
| `APP_KEY` | Yes | 32-character encryption key |
| `ADMIN_EMAIL` | Recommended | Initial admin email |
| `ADMIN_PASSWORD` | Recommended | Initial admin password |
| `NUXT_PUBLIC_APP_URL` | Recommended | Public URL (for webhooks) |
| `CHAT_BACKEND` | For doc chat | `auto` (default): OpenRouter if `OPENAI_API_KEY` set, else Cursor |
| `OPENAI_API_KEY` | For fast chat | OpenRouter/OpenAI key — enables ~2s streaming chat on `/p/{id}` |
| `DOC_AGENT` | For doc generation | `cursor` (default) or `opencode` — SRS/FSD/SDD + webhook jobs |
| `CURSOR_API_KEY` | For Cursor agent | API key for headless `cursor-agent` in Docker/production |
| `CURSOR_MODEL` | Optional | Cursor model (`auto` by default) |
| `OPENCODE_CONFIG_B64` | For Opencode agent | Base64 opencode config when `DOC_AGENT=opencode` |
| `MCP_API_KEY` | For MCP | Secures the MCP endpoint in production |

`API_BASE_URL` is optional — it enables forwarding auth to an external API. For self-hosted deployments, local database authentication is the default.

## Development

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run test         # Run tests (Vitest)
bun run mcp:start    # Start standalone MCP server
```

## Documentation

- [Product overview & design principles](PRODUCT.md)
- [MCP Server](MCP_SERVER.md)
- [Doc generation plan](implementation_plan.md)
- [OP feature catalog sync & chat](docs/OP_FEATURE_SYNC.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 TransTRACK.
