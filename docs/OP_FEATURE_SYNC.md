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
    "maxBatchSize": 200,
    "validateOnly": false
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

## Apps Script setup (first time)

The **Orbit** menu does **not** exist until you attach Apps Script to **this** spreadsheet. It will appear in the top menu bar **after Help** (not under Extensions).

1. Open your OP spreadsheet (e.g. *Copy of LLM Knowledge Base - OP*).
2. **Extensions → Apps Script** (opens the script editor bound to this file).
3. Delete any placeholder code, paste the script below, **Save** (Ctrl/Cmd+S).
4. **Project settings** (gear icon) → **Script properties** → add:
   - `ORBIT_URL`
   - `ORBIT_APP_ID`
   - `ORBIT_API_KEY`
5. Set `SHEET_NAME` in the script to match your **tab name** at the bottom of the spreadsheet (default is `Features` — rename the constant if your tab is different).
6. **Save** the script, switch back to the **spreadsheet** tab, and **refresh** (F5). `onOpen` runs on open and adds **Orbit → Sync now** automatically.
7. (Optional) First-time **permissions**: in the script editor run **`manualSyncToOrbit`** once and click **Allow**. This works from the editor (results go to **View → Logs**). Do **not** run `installOrbitMenu` from the editor — it will error (see below).

### `Cannot call SpreadsheetApp.getUi() from this context`

`getUi()` only works when the script runs **from the spreadsheet** (menu click or `onOpen` on open). It **does not** work when you press **Run** in the Apps Script editor.

| Goal | What to do |
|------|------------|
| Show **Orbit** menu | Save script → **refresh the spreadsheet tab** (not Run on `installOrbitMenu`) |
| Authorize / test sync from editor | Run **`manualSyncToOrbit`** → check **Executions** or **View → Logs** |
| Sync with a dialog | Use **Orbit → Sync now** in the spreadsheet menu after refresh |

### Menu not showing?

| Cause | Fix |
|-------|-----|
| Script not saved in this spreadsheet | Use **Extensions → Apps Script** from the same file you have open |
| Sheet opened before script was added | Refresh the browser tab, or close and reopen the spreadsheet |
| Permissions not granted | Run **`manualSyncToOrbit`** once in the editor (not `installOrbitMenu`) and click **Allow** |
| Looking under Extensions | Custom menus appear in the **top bar** next to Help, not inside Extensions |
| Wrong Google account | Script runs as the account that authorized it — use the same account that owns/edits the sheet |

## Apps Script sketch

Store secrets in **Project settings → Script properties** (not in the sheet):

| Property | Example |
|----------|---------|
| `ORBIT_URL` | `https://docs.example.com` |
| `ORBIT_APP_ID` | `550e8400-e29b-41d4-a716-446655440000` |
| `ORBIT_API_KEY` | `od_live_...` |

Optional sheet columns for write-back: `orbit_doc_id`, `orbit_public_url`.

```javascript
/** Must match the tab name at the bottom of your spreadsheet. */
const SHEET_NAME = 'Features';
const HEADER_ROW = 1;

/** getUi() is only available when the script runs from the spreadsheet (menu / onOpen), not from the editor Run button. */
function getUiSafe() {
  try {
    return SpreadsheetApp.getUi();
  } catch (e) {
    return null;
  }
}

/** Runs when the spreadsheet is opened — adds the Orbit menu. Refresh the sheet tab after saving the script. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Orbit')
    .addItem('Sync now', 'manualSyncToOrbit')
    .addToUi();
}

/**
 * Manual sync — run from:
 * - Spreadsheet menu: Orbit → Sync now (shows alert)
 * - Apps Script editor: Run manualSyncToOrbit (logs to View → Logs; use for auth + testing)
 */
function formatSyncSummary(summary) {
  const lines = [
    `Created: ${summary.created}`,
    `Updated: ${summary.updated}`,
    `Archived: ${summary.archived}`,
    `Errors: ${summary.errors.length}`,
  ];
  if (summary.errors.length > 0) {
    lines.push('', 'Failed features:');
    summary.errors.forEach((err) => {
      const id = err.feature_id ? `${err.feature_id}: ` : '';
      lines.push(`- ${id}${err.message}`);
    });
  }
  return lines.join('\n');
}

function manualSyncToOrbit() {
  const ui = getUiSafe();
  try {
    const summary = syncFeaturesToOrbit();
    const message = formatSyncSummary(summary);
    if (ui) {
      ui.alert('Orbit sync complete', message, ui.ButtonSet.OK);
    } else {
      Logger.log('Orbit sync complete\n' + message);
    }
  } catch (err) {
    const message = String(err.message || err);
    if (ui) {
      ui.alert('Orbit sync failed', message, ui.ButtonSet.OK);
    } else {
      Logger.log('Orbit sync failed: ' + message);
      throw err;
    }
  }
}

/** Scheduled sync — attach a time-driven trigger to this function (e.g. every hour). */
function scheduledSyncToOrbit() {
  syncFeaturesToOrbit();
}

/** One-time setup: Extensions → Apps Script → Triggers → Add → scheduledSyncToOrbit, time-driven. */
function createHourlySyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some((t) => t.getHandlerFunction() === 'scheduledSyncToOrbit');
  if (exists) return;

  ScriptApp.newTrigger('scheduledSyncToOrbit')
    .timeBased()
    .everyHours(1)
    .create();
}

function syncFeaturesToOrbit() {
  const props = PropertiesService.getScriptProperties();
  const orbitUrl = props.getProperty('ORBIT_URL');
  const appId = props.getProperty('ORBIT_APP_ID');
  const apiKey = props.getProperty('ORBIT_API_KEY');

  if (!orbitUrl || !appId || !apiKey) {
    throw new Error('Set ORBIT_URL, ORBIT_APP_ID, and ORBIT_API_KEY in Script properties.');
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found.`);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length <= HEADER_ROW) {
    throw new Error('No feature rows to sync.');
  }

  const headers = values[HEADER_ROW - 1].map(normalizeHeader);
  const features = values
    .slice(HEADER_ROW)
    .filter((row) => row[0])
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));

  const res = UrlFetchApp.fetch(
    `${orbitUrl.replace(/\/$/, '')}/api/apps/${appId}/features/sync`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${apiKey}` },
      payload: JSON.stringify({
        features,
        options: { archiveMissing: false, maxBatchSize: 200 },
      }),
      muteHttpExceptions: true,
    }
  );

  const status = res.getResponseCode();
  const body = JSON.parse(res.getContentText());

  if (status < 200 || status >= 300) {
    throw new Error(body.message || body.statusMessage || `HTTP ${status}`);
  }

  if (body.data?.errors?.length) {
    body.data.errors.forEach((err) => {
      const id = err.feature_id ? `${err.feature_id}: ` : '';
      Logger.log(`Sync error — ${id}${err.message}`);
    });
  }

  writeBackSyncResults(sheet, headers, values, body.data.results || []);

  return {
    created: body.data.created || 0,
    updated: body.data.updated || 0,
    archived: body.data.archived || 0,
    errors: body.data.errors || [],
  };
}

function writeBackSyncResults(sheet, headers, values, results) {
  const docIdCol = headers.indexOf('orbit_doc_id');
  const publicUrlCol = headers.indexOf('orbit_public_url');
  if (docIdCol === -1 && publicUrlCol === -1) return;

  const featureIdCol = headers.indexOf('feature_id');
  if (featureIdCol === -1) return;

  const byFeatureId = Object.fromEntries(
    results.map((r) => [String(r.feature_id), r])
  );

  for (let i = HEADER_ROW; i < values.length; i++) {
    const featureId = String(values[i][featureIdCol] || '').trim();
    const result = byFeatureId[featureId];
    if (!result) continue;

    const rowNum = i + 1;
    if (docIdCol !== -1) {
      sheet.getRange(rowNum, docIdCol + 1).setValue(result.docId || '');
    }
    if (publicUrlCol !== -1) {
      sheet.getRange(rowNum, publicUrlCol + 1).setValue(result.publicUrl || '');
    }
  }
}

function normalizeHeader(h) {
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\(wajib\)|\(disarankan\)/gi, '')
    .replace(/_+$/, '');
}
```

### Triggers

| Trigger | Function | How |
|---------|----------|-----|
| **Manual (menu)** | `manualSyncToOrbit` | Top menu **Orbit → Sync now** (after save + refresh spreadsheet) |
| **Manual (editor)** | `manualSyncToOrbit` | Apps Script → **Run** → see **View → Logs** (no `getUi` in editor) |
| **Scheduled** | `scheduledSyncToOrbit` | Apps Script → **Triggers** → time-driven, or run `createHourlySyncTrigger()` once |
