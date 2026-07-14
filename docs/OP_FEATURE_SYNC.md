# OP Feature Catalog → Orbit Docs

Sync structured feature rows from an OP spreadsheet (via Google Apps Script) into Orbit Docs, then expose hybrid chat: app-level Q&A across all features, or per-feature chat on published pages.

## Prerequisites

1. Create an **App** in Orbit that represents the OP product.
2. In **Settings → API Keys**, regenerate the **Production key** (`od_live_...`). Store it in Apps Script `PropertiesService`.
3. Ensure chat is configured (`CHAT_BACKEND` + `OPENAI_API_KEY`, or `CHAT_BACKEND=cursor` with `CURSOR_API_KEY`).

## Spreadsheet columns

| Column | Required | Maps to |
|--------|----------|---------|
| `feature_id` | Yes | Stable upsert key (`external_id`) |
| `module` | Yes | Tag `module:{name}` |
| `feature_name` | Yes | Doc title |
| `what_is_it` | Yes | Markdown section |
| `who_uses_it` | Yes | Markdown section |
| `when_to_use` | Yes | Markdown section |
| `how_to_use` | Yes | Markdown section |
| `business_rules` | Yes | Markdown section |
| `limitations` | Yes | Markdown section |
| `related_features` | Yes | Markdown section |
| `faq` | Yes | Markdown section |
| `sales_pitch` | No | Markdown section (omitted when empty) |
| `version` | Yes | Metadata table |
| `status` | Yes | Orbit doc status (see below) |
| `last_updated` | Yes | Metadata table |
| `author` | Yes | Doc author |

Optional write-back columns after sync: `orbit_doc_id`, `orbit_public_url`.

### Status mapping

| Spreadsheet `status` | Orbit `docs.status` |
|----------------------|---------------------|
| `published`, `live`, `active`, `done` | `published` |
| `draft`, `wip` | `draft` |
| `review`, `in_review` | `in_review` |
| `archived`, `deprecated`, `retired` | `archived` |

## API reference

Base URL: `NUXT_PUBLIC_APP_URL` (e.g. `https://docs.example.com`)

Auth (all feature integration routes):

```http
Authorization: Bearer od_live_your_production_key
```

### Bulk sync

```http
POST /api/apps/{appId}/features/sync
Content-Type: application/json
```

```json
{
  "features": [
    {
      "feature_id": "FLT-001",
      "module": "Fleet",
      "feature_name": "Live GPS Tracking",
      "what_is_it": "...",
      "who_uses_it": "...",
      "when_to_use": "...",
      "how_to_use": "...",
      "business_rules": "...",
      "limitations": "...",
      "related_features": "...",
      "faq": "...",
      "sales_pitch": "",
      "version": "2.1",
      "status": "published",
      "last_updated": "2026-07-14",
      "author": "Jane Doe"
    }
  ],
  "options": {
    "archiveMissing": false,
    "maxBatchSize": 200
  }
}
```

Response:

```json
{
  "data": {
    "created": 1,
    "updated": 0,
    "archived": 0,
    "errors": [],
    "results": [
      {
        "feature_id": "FLT-001",
        "docId": "uuid",
        "status": "published",
        "publicUrl": "/p/uuid",
        "action": "created"
      }
    ]
  }
}
```

### List features

```http
GET /api/apps/{appId}/features?module=Fleet&status=published&limit=50&offset=0
```

### Get one feature by `feature_id`

```http
GET /api/apps/{appId}/features/{featureId}
```

## Chat (hybrid)

Existing endpoint: `POST /api/chat` (plain-text streaming response).

| Body field | Mode |
|------------|------|
| `docId` | Single published feature doc |
| `appId` + `featureId` | Resolve feature by external ID, then single-doc chat |
| `appId` (+ optional `module`) | App-level chat across published feature docs |
| `messages` | Required — `{ role, content }[]` |

**App-level example (from OP web UI):**

```json
{
  "appId": "your-app-uuid",
  "module": "Fleet",
  "messages": [
    { "role": "user", "content": "How do I set up geofencing?" }
  ]
}
```

**Per-feature example:**

```json
{
  "docId": "doc-uuid",
  "messages": [
    { "role": "user", "content": "What are the limitations?" }
  ]
}
```

Published docs also include a built-in chat widget at `/p/{docId}`.

## Apps Script sketch

```javascript
const ORBIT_URL = 'https://docs.example.com';
const APP_ID = 'your-orbit-app-uuid';
const API_KEY = PropertiesService.getScriptProperties().getProperty('ORBIT_API_KEY');

function syncFeaturesToOrbit() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Features');
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(normalizeHeader);
  const features = values.slice(1)
    .filter((row) => row[0])
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));

  const res = UrlFetchApp.fetch(`${ORBIT_URL}/api/apps/${APP_ID}/features/sync`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${API_KEY}` },
    payload: JSON.stringify({ features }),
    muteHttpExceptions: true,
  });

  const body = JSON.parse(res.getContentText());
  // Optionally write body.data.results back to orbit_doc_id / orbit_public_url columns
}

function normalizeHeader(h) {
  return String(h).trim().toLowerCase().replace(/\s+/g, '_');
}
```

Trigger sync on a schedule (e.g. every 15–60 minutes) and optionally on sheet edits (debounced).
