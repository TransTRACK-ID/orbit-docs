# Integration Plan: Postrack API Docs Viewer into Orbit Docs

**Date**: 2026-05-26
**Scope**: Viewer-only integration — Orbit Docs consumes Postrack's public collection docs API via authenticated server-side proxy.

---

## 1. Goal

Add a public API documentation viewer page to Orbit Docs that fetches and renders Postrack collection docs in **Guide mode** (scrollable long-form document with scroll spy outline sidebar).

Orbit Docs does not own the data. It acts as a **read-only consumer** of Postrack's `/api/public/collection-docs/:slug` endpoint.

---

## 2. Architecture

```
User Browser
    │
    ▼
/pages/api-docs/[slug].vue        ← Orbit Docs frontend (layout: false, ssr: false)
    │
    │  $fetch(`/api/api-docs/${slug}`)
    ▼
/server/api/api-docs/[slug].get.ts   ← Orbit Docs server proxy
    │
    │  $fetch(`${POSTRACK_API_URL}/api/public/collection-docs/${slug}`,
    │          { headers: { Authorization: `Bearer ${POSTRACK_API_KEY}` } })
    ▼
Postrack Server                    ← Source of truth
/api/public/collection-docs/:slug
```

**Why server-side proxy?**
- Keeps the shared API key secure (never exposed to browser)
- Handles CORS automatically
- Allows future caching / response transformation
- Aligns with Orbit Docs' existing API layer pattern

---

## 3. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | Shared API key in `Authorization: Bearer` header | Simple, server-to-server only |
| Route | `/api-docs/:slug` | Clean, descriptive, distinct from `/docs` and `/embed-docs` |
| View mode | Guide only | Best for reading; avoids Explorer UI complexity |
| Styling | Orbit Docs CSS tokens (`--bg`, `--fg`, `--accent`, etc.) | Consistent with existing embed viewer |
| Layout | `layout: false` | Standalone, frame-friendly, same as `/embed-docs/view` |
| SSR | Disabled (follows `ssr: false` in nuxt.config) | Client-side fetch to our own API |

---

## 4. Files to Create

### 4.1 Server API Proxy
**Path**: `server/api/api-docs/[slug].get.ts`
**Responsibilities**:
- Read slug from route param
- Read `POSTRACK_API_URL` and `POSTRACK_API_KEY` from runtimeConfig
- Make authenticated `$fetch` to Postrack
- Handle errors (404 → "Docs not found", 403 → "Access denied", network → "Unavailable")
- Return typed JSON matching Postrack's `CollectionDocsResponse` shape

### 4.2 Frontend Page
**Path**: `pages/api-docs/[slug].vue`
**Responsibilities**:
- Fetch data via `$fetch(`/api/api-docs/${slug}`)`
- Render loading skeleton (reuse pattern from `embed-docs/view.vue`)
- Render error state
- Render Guide view with:
  - Left sidebar: scroll spy outline
  - Main content: collection header → doc blocks → endpoints → folders
- Use `definePageMeta({ layout: false, auth: false })`
- Set `<title>` and `<meta name="description">` from collection data
- Implement IntersectionObserver scroll spy (copy pattern from `embed-docs/view.vue`)

### 4.3 Endpoint Card Component
**Path**: `components/ApiEndpointBlock.vue`
**Responsibilities**:
- Render endpoint card: method badge, path, name, notes, auth, headers, param schema table, request body, cURL (with copy button), response examples
- Adapt styles to Orbit Docs CSS tokens (`--bg`, `--fg`, `--accent`, `--surface`, `--border`, `--font-mono`, `--radius`)
- Method color mapping: GET=blue, POST=green, PUT=amber, PATCH=purple, DELETE=red

### 4.4 Doc Block Renderer Component
**Path**: `components/DocBlockRenderer.vue`
**Responsibilities**:
- Render 5 block types:
  - `markdown` → use Orbit Docs' `renderMarkdown()` from `composables/useMarkdown.ts`
  - `image` → `<img>` with optional caption
  - `table` → `<table>` with headers/rows
  - `endpoint_ref` → inline `<ApiEndpointBlock>` for referenced endpoint
  - `divider` → `<hr>`
- Accept `baseUrl` prop for cURL generation in endpoint_ref blocks
- Accept `endpoints` array prop for endpoint_ref lookups

### 4.5 Data Composable
**Path**: `composables/useApiDocs.ts`
**Responsibilities**:
- `fetchApiDocs(slug: string)` → call Orbit Docs server API
- `isLoading`, `error`, `data` reactive state
- Handle 401/403/404/500 with appropriate toast messages

### 4.6 TypeScript Types
**Path**: `types/apiDocs.ts`
**Contents**: Full `CollectionDocsResponse` interface tree — collection, endpoints, folders, docBlocks, stats

---

## 5. Files to Modify

### 5.1 `nuxt.config.ts`
Add to `runtimeConfig`:
```ts
runtimeConfig: {
  // ...existing...
  postrackApiUrl: process.env.NITRO_POSTRACK_API_URL,
  postrackApiKey: process.env.NITRO_POSTRACK_API_KEY,
}
```

### 5.2 Environment Variables
Add to `.env` / `.env.example`:
```bash
NITRO_POSTRACK_API_URL=https://postrack.example.com
NITRO_POSTRACK_API_KEY=your-shared-api-key-here
```

---

## 6. Data Flow & Rendering Order

The Guide view renders content in this order:

1. **Collection Header** — name, description, baseUrl badge
2. **Collection-level Doc Blocks** (sorted by `order`)
3. **Root Endpoints** (not in any folder, with their `before`/`after` doc blocks)
4. **Folders** (sorted by `order`, each containing):
   - Folder header
   - Folder-level doc blocks
   - Folder endpoints (with their `before`/`after` doc blocks)

### Outline / Scroll Spy Items

The right sidebar outline contains:
- Collection name (depth 0)
- Root endpoints (depth 1) with method badge
- Folders (depth 1) labeled "FOLDER"
- Folder endpoints (depth 2) with method badge

Each outline item scrolls its corresponding section into view. IntersectionObserver marks the active section based on viewport position.

---

## 7. Styling Strategy

Use Orbit Docs' existing CSS token system (from `embed-docs/view.vue`):

```css
:root {
  --bg: oklch(98% 0.004 250);
  --surface: oklch(100% 0 0);
  --fg: oklch(20% 0.02 250);
  --muted: oklch(55% 0.015 250);
  --border: oklch(90% 0.006 250);
  --accent: oklch(55% 0.16 25);
  --accent-soft: color-mix(in oklch, var(--accent) 12%, transparent);
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  --radius: 8px;
  --sidebar: 260px;
}
```

All components should use these tokens instead of mock-service's `--bg-tertiary`, `--text-text-primary`, etc.

**Method badge colors** (adapted to Orbit Docs palette):
- GET: `oklch(55% 0.16 255)` (blue)
- POST: `oklch(55% 0.16 145)` (green)
- PUT: `oklch(60% 0.16 85)` (amber)
- PATCH: `oklch(55% 0.16 300)` (purple)
- DELETE: `oklch(55% 0.16 25)` (red — matches accent)

---

## 8. Error Handling

| Postrack Response | User Sees |
|-------------------|-----------|
| 404 (slug not found) | "API documentation not found" with return link |
| 403 (not public) | "This documentation is not publicly available" |
| Network error | "Unable to load documentation. Please try again later." |
| 500 | "Something went wrong. Please try again later." |

All errors show in a centered error state matching the `embed-docs/view.vue` pattern.

---

## 9. Testing Checklist

- [ ] Server proxy successfully calls Postrack with Bearer token
- [ ] Frontend renders loading skeleton
- [ ] Frontend renders error state for invalid slug
- [ ] Collection header shows name, description, baseUrl
- [ ] Collection-level doc blocks render (all 5 types)
- [ ] Root endpoints render with method badges
- [ ] Folders render with nested endpoints
- [ ] Endpoint cards show: method, path, params, cURL, responses
- [ ] cURL copy button works
- [ ] Response examples are collapsible
- [ ] Scroll spy outline highlights active section
- [ ] Clicking outline item scrolls to section
- [ ] Responsive: sidebar hides on mobile (< 640px)
- [ ] Styling uses Orbit Docs CSS tokens consistently
- [ ] `<title>` and meta description update from collection data

---

## 10. Future Extensions (out of scope)

- Explorer mode toggle (add sidebar + detail panel)
- Hybrid mode
- Server-side caching of Postrack responses
- Search/filter within the guide
- Dark mode toggle (currently follows Orbit Docs system preference)
