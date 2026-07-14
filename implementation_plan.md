# 🚀 SRS/FSD/SDD Generator — Implementation Plan

## Overview

Build a feature for the **Developer** member role that generates Software Requirements Specification (SRS), Functional Specification Document (FSD), and System Design Document (SDD) from a Git repository input. The system uses a background AI agent to deeply analyze the codebase and populate the templates.

**Default agent (production):** [Cursor Agent CLI](https://cursor.com) (`cursor-agent`) via `DOC_AGENT=cursor` and `CURSOR_API_KEY`.

**Alternative agent:** [Opencode](https://opencode.ai) via `DOC_AGENT=opencode` and `OPENCODE_CONFIG_B64`.

**Doc chat** on published pages (`/p/{id}`) uses the same `DOC_AGENT` backend as doc generation (Cursor CLI or Opencode).

---

## Architecture

```mermaid
sequenceDiagram
    participant Dev as Developer (Browser)
    participant API as Nuxt Server API
    participant OC as Opencode Agent (Background)
    participant DB as PostgreSQL
    participant Repo as Git Repository

    Dev->>API: POST /api/apps/[id]/generate-docs
    API->>DB: Create generation job (status: cloning)
    API->>OC: Clone repo & start analysis
    API-->>Dev: 202 Accepted (jobId)
    
    OC->>Repo: git clone (shallow)
    OC->>OC: Analyze codebase deeply
    OC->>OC: Generate SRS from template
    OC->>OC: Generate FSD from template  
    OC->>OC: Generate SDD from template
    OC->>DB: Save generated docs (status: completed)
    
    Dev->>API: GET /api/apps/[id]/generate-docs/[jobId]/status
    API-->>Dev: SSE stream (progress updates)
    
    Dev->>API: GET /api/apps/[id]/generate-docs/[jobId]/result
    API-->>Dev: Generated SRS/FSD/SDD markdown
```

---

## New Environment Variables

### Cursor agent (default)

```env
DOC_AGENT=cursor
NUXT_PUBLIC_DOC_AGENT=cursor
CURSOR_API_KEY=your-cursor-api-key
CURSOR_MODEL=auto
```

The Docker image installs `cursor-agent` on Debian (glibc). In production, set `CURSOR_API_KEY` — interactive `cursor-agent login` does not persist across container restarts.

Health check: `GET /api/agent/status`

### Opencode agent (alternative)

```env
DOC_AGENT=opencode
# Opencode Agent Config (base64-encoded opencode config.json)
OPENCODE_CONFIG_B64=<base64 encoded JSON>
```

The base64-decoded config.json should contain:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "openrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenRouter",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "<key>"
      },
      "models": {
        "anthropic/claude-sonnet-4": {
          "name": "Claude Sonnet 4"
        }
      }
    }
  },
  "model": "openrouter/anthropic/claude-sonnet-4",
  "permission": {
    "edit": "deny",
    "bash": "allow",
    "read": "allow"
  }
}
```

---

## Database Schema Changes

### New table: `doc_generation_jobs`

| Column | Type | Description |
|:---|:---|:---|
| `id` | `serial` PK | Job ID |
| `app_id` | `integer` FK → apps | Which app this belongs to |
| `user_id` | `integer` FK → users | Who triggered the generation |
| `repo_url` | `text` | Git repository URL |
| `status` | `text` | `cloning` → `analyzing` → `generating_srs` → `generating_fsd` → `generating_sdd` → `completed` / `failed` |
| `progress_pct` | `integer` | 0-100 progress |
| `progress_message` | `text` | Human-readable status |
| `srs_content` | `text` | Generated SRS markdown |
| `fsd_content` | `text` | Generated FSD markdown |
| `sdd_content` | `text` | Generated SDD markdown |
| `error_message` | `text` | Error details if failed |
| `created_at` | `timestamp` | Job creation time |
| `completed_at` | `timestamp` | Job completion time |

---

## Files to Create/Modify

### Server-side (Backend)

| File | Action | Purpose |
|:---|:---|:---|
| `server/database/schema/doc-generation-jobs.ts` | **Create** | Drizzle schema for the jobs table |
| `server/lib/cursor-agent.ts` | **Create** | Cursor CLI wrapper — spawns `cursor-agent`, streams JSON events |
| `server/lib/agent-factory.ts` | **Create** | Selects Cursor or Opencode from `DOC_AGENT` |
| `server/lib/agent-readiness.ts` | **Create** | Fail-fast checks before starting generation jobs |
| `server/lib/opencode-agent.ts` | **Create** | Opencode SDK wrapper — decodes config from env, manages sessions |
| `server/lib/doc-generator.ts` | **Create** | Core orchestrator — clones repo, builds prompts from templates, runs agent |
| `server/api/apps/[id]/generate-docs/index.post.ts` | **Create** | POST endpoint to trigger generation |
| `server/api/apps/[id]/generate-docs/[jobId]/status.get.ts` | **Create** | SSE endpoint for real-time progress |
| `server/api/apps/[id]/generate-docs/[jobId]/result.get.ts` | **Create** | GET endpoint for completed results |
| `server/api/apps/[id]/generate-docs/index.get.ts` | **Create** | GET list of all generation jobs for an app |

### Client-side (Frontend)

| File | Action | Purpose |
|:---|:---|:---|
| `pages/apps/[id]/generate-docs.vue` | **Create** | Main page — repo input, doc type selection, progress UI, results viewer |
| `components/docs/DocGeneratorForm.vue` | **Create** | Repository URL input + doc type selector |
| `components/docs/DocGenerationProgress.vue` | **Create** | Real-time progress bar with status messages |
| `components/docs/DocResultViewer.vue` | **Create** | Tabbed markdown viewer for SRS/FSD/SDD with copy/download |
| `composables/useDocGenerator.ts` | **Create** | Composable for managing doc generation state |
| `store/docGenerator.ts` | **Create** | Pinia store for generation jobs history |

### Configuration

| File | Action | Purpose |
|:---|:---|:---|
| `nuxt.config.ts` | **Modify** | Add `opencodeConfigB64` to runtimeConfig |
| `.env` | **Modify** | Add `OPENCODE_CONFIG_B64` |

---

## Implementation Order

### Phase 1: Database & Config
1. Create Drizzle schema for `doc_generation_jobs`
2. Add env variable support for Opencode config
3. Update `nuxt.config.ts` runtimeConfig

### Phase 2: Opencode Agent Integration  
4. Create `opencode-agent.ts` — SDK wrapper
5. Create `doc-generator.ts` — core orchestrator with template loading

### Phase 3: API Endpoints
6. POST trigger endpoint
7. SSE status endpoint
8. GET result endpoint
9. GET job history endpoint

### Phase 4: Frontend UI
10. Create the generation page
11. Build form, progress, and result viewer components
12. Create composable and store

---

## Key Design Decisions

> [!IMPORTANT]
> - **Default agent is Cursor CLI** (`DOC_AGENT=cursor`) — see `server/lib/cursor-agent.ts`
> - **Opencode runs as a managed server** via `@opencode-ai/sdk` when `DOC_AGENT=opencode`
> - **Repository cloned under `ORBIT_REPO_DIR`** with shallow clone for speed (full history for webhook diffs)
> - **Templates are loaded at runtime** from the `templates/` directory
> - **SSE streaming** for real-time progress (not polling)
> - **Doc chat** (`/api/chat`) uses the same `DOC_AGENT` backend as doc generation

> [!WARNING]
> The Opencode agent will need `opencode-ai` CLI and `@opencode-ai/sdk` installed as project dependencies.

Shall I proceed with implementation?
