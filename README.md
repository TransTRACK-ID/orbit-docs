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

## Reliability & Operations

The server is hardened against the "process alive but API pending forever" failure mode, where exhausted resources wedge every request until a manual restart:

- **DB pool bounds** (`server/database/index.ts`) — every pool wait and query is time-bounded, so failures surface as fast 500s instead of hanging requests: `DB_POOL_MAX` (20), `DB_CONNECTION_TIMEOUT_MS` (10s), `DB_STATEMENT_TIMEOUT_MS` (120s, `0` disables), `DB_IDLE_TIMEOUT_MS` (30s), `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS` (60s). See [`.env.example`](.env.example).
- **Health probe** — `GET /api/health` exercises the DB pool and returns pool stats (`total`/`idle`/`waiting`) plus process memory. The Docker image ships a `HEALTHCHECK` against it, and caps the Node heap (`NODE_OPTIONS=--max-old-space-size=2048`) so a leak becomes a restartable OOM exit instead of an unresponsive process.
- **Auto-restart** — all compose files include an `autoheal` service ([willfarrell/docker-autoheal](https://github.com/willfarrell/docker-autoheal)) that restarts the app container when its healthcheck turns `unhealthy`. Run **exactly one** autoheal per host: if one host runs multiple stacks, remove it from the stacks and run a single standalone instance.
- **Bounded in-memory state** — MCP session event stores are capped and sessions idle longer than `MCP_SESSION_IDLE_TTL_MS` (default 30 min) are closed; expired sessions return `404` so clients re-initialize.
- **Agent subprocesses** — doc generation runs one job per app+scope at a time (duplicate requests get `409`), and Cursor/Opencode subprocesses are force-killed on abort/timeout so stuck runs cannot accumulate.

Diagnosing a wedged instance:

```bash
docker ps        # app should show "(healthy)"; check `docker logs autoheal` for restarts
curl -s localhost:3000/api/health   # sustained db.waiting > 0 = pool contention
docker stats     # memory creeping for days = leak; check for orphan cursor-agent/opencode processes
```

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
