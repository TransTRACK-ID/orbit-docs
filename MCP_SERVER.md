# Orbit Docs MCP Server

A comprehensive HTTP MCP (Model Context Protocol) server that exposes the Orbit Docs platform data to external AI agents. This server provides read-only access to documentation, releases, versions, apps, changelogs, activity logs, and team owners via the MCP protocol over HTTP SSE (Server-Sent Events).

## What is MCP?

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) is an open protocol that standardizes how applications provide context to LLMs. This server implements MCP over HTTP, allowing any MCP-compatible client (Claude Desktop, OpenCode, VS Code, Cursor, etc.) to connect and query your Orbit Docs data.

## Features

- **14 powerful tools** covering all aspects of the Orbit Docs platform
- **Read-only access** to docs, releases, versions, apps, changelogs, activity, and owners
- **Full-text search** within documentation content
- **Deep relationships** - every tool returns connected data (e.g., versions include their releases, docs include their app and version)
- **Pagination** on all list endpoints
- **HTTP SSE transport** for real-time communication
- **CORS enabled** for cross-origin access
- **Health check endpoint** at `/health`

## Available Tools

### Apps
| Tool | Description |
|------|-------------|
| `list_apps` | List all apps with name search, pagination, and latest version info |
| `get_app` | Get deep app details including version counts, doc counts, recent versions, and activity |

### Versions
| Tool | Description |
|------|-------------|
| `list_versions` | List all versions for an app with release associations |
| `get_version` | Get full version details including releases, changelogs, docs, and version history |

### Documentation
| Tool | Description |
|------|-------------|
| `list_docs` | List docs with filters (app, status, title search) and pagination |
| `get_doc` | Get full doc with content, app, version, available versions, and doc version history |
| `search_docs_content` | Full-text search inside doc content (not just titles) |

### Releases
| Tool | Description |
|------|-------------|
| `list_releases` | List all releases for an app with version and app info |
| `get_release` | Get complete release with features, categories, app info, version details, and related changelogs |

### Changelogs
| Tool | Description |
|------|-------------|
| `list_changelogs` | List all changelog entries for an app with version associations |

### Activity & Team
| Tool | Description |
|------|-------------|
| `list_activity` | List recent activity logs (platform-wide or filtered by app) |
| `list_owners` | List team owners with name search and their associated apps |
| `get_owner` | Get owner details with all their associated apps |

### Stats
| Tool | Description |
|------|-------------|
| `get_stats` | Get platform-wide statistics (apps, versions, docs, releases, owners) |

## Quick Start

### 1. Install Dependencies

The MCP server requires the following packages (already added to `package.json`):

```bash
npm install
# or
bun install
```

### 2. Ensure Environment Variables

The MCP server reads the same database connection as your Nuxt app. Make sure your `.env` file contains:

```env
# Required
POSTGRES_URL=postgresql://user:password@localhost:5432/orbit_docs
# or
DATABASE_URL=postgresql://user:password@localhost:5432/orbit_docs

# Optional - customize the MCP server port (default: 41244)
MCP_PORT=41244
```

### 3. Start the MCP Server

```bash
# Start the MCP server (standalone)
npm run mcp:start
# or
bun run mcp:start

# Output:
# [orbit-docs-mcp] Server running on http://localhost:41244/mcp
# [orbit-docs-mcp] Health check: http://localhost:41244/health
# [orbit-docs-mcp] Connected to database
```

### 4. Verify it's Running

```bash
curl http://localhost:41244/health
# Should return: {"status":"ok","server":"orbit-docs-mcp","version":"1.0.0"}
```

## Adding to AI Agent Settings

### Claude Desktop (macOS)

1. Open Claude Desktop
2. Go to **Settings** → **Developer** → **Edit Config**
3. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orbit_docs": {
      "command": "npx",
      "args": [
        "tsx",
        "/ABSOLUTE/PATH/TO/orbit-docs/mcp-server.ts"
      ],
      "env": {
        "POSTGRES_URL": "postgresql://user:password@localhost:5432/orbit_docs"
      }
    }
  }
}
```

**Alternative using HTTP (if server is already running):**

Claude Desktop currently supports stdio transport natively. For HTTP, use a bridge or run the server separately and connect via a custom client.

### OpenCode / Kilocode

The `.mcp.json` file in the project root is already configured:

```json
{
  "mcpServers": {
    "orbit_docs": {
      "url": "http://localhost:41244/mcp"
    }
  }
}
```

If you use OpenCode globally, add to your global `~/.config/opencode/mcp.json` or `~/.opencode/mcp.json`:

```json
{
  "mcpServers": {
    "orbit_docs": {
      "url": "http://localhost:41244/mcp"
    }
  }
}
```

### VS Code (GitHub Copilot Chat)

Add to your VS Code `settings.json` (User or Workspace):

```json
{
  "mcp": {
    "servers": {
      "orbit_docs": {
        "url": "http://localhost:41244/mcp"
      }
    }
  }
}
```

### Cursor

1. Open Cursor
2. Go to **Settings** → **MCP Servers**
3. Add a new MCP server:
   - **Name**: `orbit_docs`
   - **Type**: `HTTP`
   - **URL**: `http://localhost:41244/mcp`

### Cline

Add to your Cline MCP settings (usually in `~/.config/cline/mcp_settings.json`):

```json
{
  "mcpServers": {
    "orbit_docs": {
      "url": "http://localhost:41244/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Generic MCP Client (HTTP SSE)

Any MCP client that supports HTTP SSE can connect to:

```
http://localhost:41244/mcp
```

The endpoint supports:
- `GET /mcp` - SSE connection endpoint
- `POST /mcp/message?sessionId=<id>` - Message endpoint for the session
- `GET /health` - Health check

## Running Alongside Nuxt Dev Server

You can run both the Nuxt app and the MCP server simultaneously:

```bash
# Terminal 1: Nuxt dev server
npm run dev

# Terminal 2: MCP server
npm run mcp:start
```

Or use a process manager like `concurrently`:

```bash
npx concurrently "npm run dev" "npm run mcp:start"
```

## Tool Examples

### List all apps
```json
{
  "name": "list_apps",
  "arguments": {
    "search": "api",
    "limit": 10
  }
}
```

### Get a specific app with all details
```json
{
  "name": "get_app",
  "arguments": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### List versions for an app
```json
{
  "name": "list_versions",
  "arguments": {
    "appId": "550e8400-e29b-41d4-a716-446655440000",
    "limit": 20
  }
}
```

### Get a version with all related data
```json
{
  "name": "get_version",
  "arguments": {
    "appId": "550e8400-e29b-41d4-a716-446655440000",
    "versionId": "660e8400-e29b-41d4-a716-446655440001"
  }
}
```

### List docs with filters
```json
{
  "name": "list_docs",
  "arguments": {
    "appId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "published",
    "search": "authentication",
    "limit": 10
  }
}
```

### Get full doc content
```json
{
  "name": "get_doc",
  "arguments": {
    "id": "770e8400-e29b-41d4-a716-446655440002"
  }
}
```

### Search within doc content
```json
{
  "name": "search_docs_content",
  "arguments": {
    "query": "OAuth",
    "appId": "550e8400-e29b-41d4-a716-446655440000",
    "limit": 5
  }
}
```

### List releases for an app
```json
{
  "name": "list_releases",
  "arguments": {
    "appId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Get a release with all details
```json
{
  "name": "get_release",
  "arguments": {
    "id": "880e8400-e29b-41d4-a716-446655440003"
  }
}
```

### Get platform stats
```json
{
  "name": "get_stats",
  "arguments": {}
}
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           External AI Agent                 │
│  (Claude, OpenCode, Cursor, VS Code, etc.)  │
└────────────────┬────────────────────────────┘
                 │ MCP over HTTP SSE
                 │ GET /mcp
                 │ POST /mcp/message
                 ▼
┌─────────────────────────────────────────────┐
│         Orbit Docs MCP Server               │
│         (Node.js + Express)                 │
│  Port: 41244 (configurable via MCP_PORT)    │
└────────────────┬────────────────────────────┘
                 │ Drizzle ORM + pg
                 ▼
┌─────────────────────────────────────────────┐
│         PostgreSQL Database                 │
│  (Same DB as the Nuxt app)                  │
└─────────────────────────────────────────────┘
```

## Troubleshooting

### Connection Refused
- Ensure the MCP server is running: `npm run mcp:start`
- Check the port: `MCP_PORT=41244` (or your custom port)
- Verify the URL in your agent settings matches the running port

### Database Connection Errors
- Verify `POSTGRES_URL` or `DATABASE_URL` is set in your `.env` file
- Ensure the database is running and accessible
- Check that the connection string includes the correct host, port, user, password, and database name

### No Tools Available
- The MCP server must be running before the client connects
- Check the server logs for startup errors
- Verify the `/health` endpoint responds correctly

### CORS Issues
- The server has CORS enabled by default
- If you encounter CORS issues, ensure the client is connecting to the correct origin

## Security Considerations

- The MCP server currently provides **read-only access** to all platform data
- It connects directly to the PostgreSQL database using the same credentials as the Nuxt app
- For production use, consider:
  - Running the MCP server behind a reverse proxy with HTTPS
  - Adding API key authentication (can be implemented by adding a middleware to check `Authorization` header)
  - Restricting network access to trusted clients only
  - Using a dedicated read-only database user for the MCP server

## Development

### Adding New Tools

To add a new tool, edit `mcp-server.ts`:

1. Add a Zod schema for validation
2. Add a `Tool` definition to the `TOOLS` array with JSON Schema input
3. Add a handler case in the `tools/call` handler

### Testing Tools Locally

You can test individual tools using curl or any HTTP client by:

1. Starting the server: `npm run mcp:start`
2. Connecting to `http://localhost:41244/mcp` via SSE
3. Sending MCP protocol messages

For simpler testing, use the existing REST API endpoints in the Nuxt app during development.

## License

Same as the Orbit Docs project.
