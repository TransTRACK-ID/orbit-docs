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
- **API Key authentication** for secure production deployment
- **Health check endpoint** at `/health`
- **Docker support** for easy deployment

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

### 2. Configure Environment Variables

The MCP server reads the same database connection as your Nuxt app. Make sure your `.env` file contains:

```env
# Required
POSTGRES_URL=postgresql://user:password@localhost:5432/orbit_docs
# or
DATABASE_URL=postgresql://user:password@localhost:5432/orbit_docs

# Optional - customize the MCP server port (default: 41244)
MCP_PORT=41244

# Required for production - API key to secure the endpoint
MCP_API_KEY=your_secret_api_key_here
```

> **Security Note:** If `MCP_API_KEY` is not set, the server will start but will print a warning. It will be accessible to anyone with the URL. Always set this in production.

### 3. Start the MCP Server

```bash
# Start the MCP server (standalone)
npm run mcp:start
# or
bun run mcp:start

# Output:
# [orbit-docs-mcp] Server running on http://localhost:41244/mcp
# [orbit-docs-mcp] Health check: http://localhost:41244/health
# [orbit-docs-mcp] API key authentication enabled
# [orbit-docs-mcp] Connected to database
```

### 4. Verify it's Running

```bash
# Health check (no auth required)
curl http://localhost:41244/health
# Should return: {"status":"ok","server":"orbit-docs-mcp","version":"1.0.0"}

# Test with API key
curl -H "Authorization: Bearer your_secret_api_key_here" http://localhost:41244/mcp
# (This initiates an SSE connection, so it will hang — that's expected)
```

## Production Deployment

### Docker Deployment

#### Option A: Deploy MCP Server with Docker Compose

The `docker-compose.yml` already includes an `mcp-server` service. Just set these in your `.env`:

```env
POSTGRES_URL=postgresql://user:password@db:5432/orbit_docs
MCP_PORT=41244
MCP_API_KEY=your_secret_api_key_here
MCP_HOST=mcp.yourdomain.com
```

Then deploy:

```bash
docker-compose up -d mcp-server
```

The MCP server will be available at:
- `http://mcp.yourdomain.com/mcp` (via Traefik)
- `http://localhost:41244/mcp` (direct)

#### Option B: Standalone Docker

```bash
# Build the MCP server image
docker build -f Dockerfile.mcp -t orbit-docs-mcp .

# Run it
docker run -d \
  -p 41244:41244 \
  -e POSTGRES_URL=postgresql://user:password@db:5432/orbit_docs \
  -e MCP_API_KEY=your_secret_api_key_here \
  -e MCP_PORT=41244 \
  --name orbit-docs-mcp \
  orbit-docs-mcp
```

#### Option C: Deploy on VPS / Server

```bash
# Clone your repo
git clone <your-repo> /opt/orbit-docs
cd /opt/orbit-docs

# Install dependencies
npm install

# Set environment variables (or use .env)
export POSTGRES_URL=postgresql://user:password@localhost:5432/orbit_docs
export MCP_API_KEY=your_secret_api_key_here
export MCP_PORT=41244

# Start the server
npm run mcp:start

# Or use PM2 for process management
npm install -g pm2
pm2 start "npm run mcp:start" --name orbit-docs-mcp
pm2 save
pm2 startup
```

### Reverse Proxy with HTTPS

**Nginx Example:**

```nginx
server {
    listen 443 ssl;
    server_name mcp.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:41244;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_set_header Connection '';
        proxy_set_header Cache-Control 'no-cache';
    }
}
```

**Traefik:** Already configured in `docker-compose.yml` labels.

## Can Users Use It as Plug-and-Play?

**Yes, once deployed.** Here's the user experience:

### For Your Users

1. You deploy the MCP server with an `MCP_API_KEY`
2. You give your users:
   - The MCP server URL (e.g., `https://mcp.yourdomain.com/mcp`)
   - The API key
3. They add these to their AI agent settings (see below)
4. They can immediately query docs, releases, versions, etc.

### Example User Setup (OpenCode)

Your user adds to their `.mcp.json` or `~/.config/opencode/mcp.json`:

```json
{
  "mcpServers": {
    "orbit_docs": {
      "url": "https://mcp.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SECRET_API_KEY"
      }
    }
  }
}
```

### Example User Setup (Cline)

```json
{
  "mcpServers": {
    "orbit_docs": {
      "url": "https://mcp.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SECRET_API_KEY"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Example User Setup (Cursor)

1. Open Cursor
2. Go to **Settings** → **MCP Servers**
3. Add:
   - **Name**: `orbit_docs`
   - **Type**: `HTTP`
   - **URL**: `https://mcp.yourdomain.com/mcp`
   - **Headers**: `Authorization: Bearer YOUR_SECRET_API_KEY`

### Example User Setup (Custom Client)

Any HTTP client that supports MCP SSE:

```bash
curl -N \
  -H "Authorization: Bearer YOUR_SECRET_API_KEY" \
  -H "Accept: text/event-stream" \
  https://mcp.yourdomain.com/mcp
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
        "POSTGRES_URL": "postgresql://user:password@localhost:5432/orbit_docs",
        "MCP_API_KEY": "your_secret_api_key_here"
      }
    }
  }
}
```

**Note:** Claude Desktop natively supports stdio transport. For HTTP, you need a bridge like `mcp-proxy` or use a custom client.

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
      "url": "https://mcp.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SECRET_API_KEY"
      }
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
        "url": "https://mcp.yourdomain.com/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_SECRET_API_KEY"
        }
      }
    }
  }
}
```

### Cursor

1. Open Cursor
2. Go to **Settings** → **MCP Servers**
3. Add:
   - **Name**: `orbit_docs`
   - **Type**: `HTTP`
   - **URL**: `https://mcp.yourdomain.com/mcp`
   - **Headers**: `Authorization: Bearer YOUR_SECRET_API_KEY`

### Cline

Add to your Cline MCP settings (usually in `~/.config/cline/mcp_settings.json`):

```json
{
  "mcpServers": {
    "orbit_docs": {
      "url": "https://mcp.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SECRET_API_KEY"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Generic MCP Client (HTTP SSE)

Any MCP client that supports HTTP SSE can connect to:

```
https://mcp.yourdomain.com/mcp
```

With headers:
```
Authorization: Bearer YOUR_SECRET_API_KEY
```

The endpoint supports:
- `GET /mcp` - SSE connection endpoint
- `POST /mcp/message?sessionId=<id>` - Message endpoint for the session
- `GET /health` - Health check (no auth required)

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
                 │ Authorization: Bearer <key>
                 ▼
┌─────────────────────────────────────────────┐
│         Orbit Docs MCP Server               │
│         (Node.js + Express)                 │
│  Port: 41244 (configurable via MCP_PORT)    │
│  Auth: Bearer token via MCP_API_KEY         │
└────────────────┬────────────────────────────┘
                 │ Drizzle ORM + pg
                 ▼
┌─────────────────────────────────────────────┐
│         PostgreSQL Database                 │
│  (Same DB as the Nuxt app)                  │
└─────────────────────────────────────────────┘
```

## Security Considerations

- The MCP server provides **read-only access** to all platform data
- Always set `MCP_API_KEY` in production
- The server uses the same database credentials as the Nuxt app — consider using a dedicated read-only database user for the MCP server
- Run behind HTTPS in production (use a reverse proxy or Traefik)
- The `/health` endpoint is public (no auth required) for monitoring purposes
- All other endpoints require the API key

## Troubleshooting

### Connection Refused
- Ensure the MCP server is running: `npm run mcp:start`
- Check the port: `MCP_PORT=41244` (or your custom port)
- Verify the URL in your agent settings matches the running port

### 401 Unauthorized
- You must provide the API key via `Authorization: Bearer <key>` or `X-API-Key: <key>` header
- Verify the `MCP_API_KEY` environment variable matches what you're sending

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
