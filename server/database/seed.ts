import { db } from "./index";
import { apps, appVersions, releases, docs } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding data…");

  // ─── 1. POSTRACK APP ───────────────────────────────────────────
  const existingPostrack = await db.select().from(apps).where(eq(apps.name, "Postrack"));
  let postrack = existingPostrack[0];
  
  if (!postrack) {
    const [newApp] = await db
      .insert(apps)
      .values({
        name: "Postrack",
        description: "A Postman/Insomnia alternative for building, testing, mocking, documenting, and sharing APIs. Workspace-based API organization with request builder, HTTP proxy, cloud mock routing, OpenAPI import, and public API documentation.",
        owner: "Postrack Team",
        status: "active" as const,
        repoUrl: "https://github.com/postrack/postrack",
      })
      .returning();

    if (!newApp) {
      throw new Error("Failed to create Postrack app");
    }
    
    postrack = newApp;
    console.log("Created app:", postrack.name);
  } else {
    console.log("Postrack app already exists, skipping.");
  }

  // 2. Create Postrack versions if none exist
  let postrackVersions = await db.select().from(appVersions).where(eq(appVersions.appId, postrack.id));
  if (postrackVersions.length === 0) {
    const versionsData = [
    {
      version: "0.8.7",
      status: "published",
      releaseDate: new Date("2026-05-25"),
      releaseNotes: `## Added
- Inline environment variable editing with hover popup
- Hover over any environment variable to see a popup editor
- Edit values inline including secret variables with reveal toggle
- Copy-to-clipboard and keyboard shortcuts (Enter to save, Esc to cancel)

## Fixed
- Resolved styling issues with text-primary and bg-transparent classes
- Improved admin collection docs button placement in Edit Collection modal

## Changed
- Updated version bump script for streamlined releases`,
      branch: "main",
      tags: "env-vars,ux,editor",
      commitHash: "6737810",
      approver: "Zein",
    },
    {
      version: "0.8.6",
      status: "published",
      releaseDate: new Date("2026-05-22"),
      releaseNotes: `## Added
- Refactored admin collection docs button placement
- Moved Collection Docs button into Edit Collection modal for better UX

## Fixed
- Fixed various UI inconsistencies in admin panel`,
      branch: "main",
      tags: "admin,ui",
      commitHash: "1cb0770",
      approver: "Zein",
    },
    {
      version: "0.8.5",
      status: "published",
      releaseDate: new Date("2026-05-22"),
      releaseNotes: `## Added
- Updated text-primary and bg-transparent styling across components
- Consistent color tokens for better theming support

## Changed
- Improved styling consistency for dark and light modes`,
      branch: "main",
      tags: "styling,theming",
      commitHash: "0fcf041",
      approver: "Zein",
    },
    {
      version: "0.8.4",
      status: "published",
      releaseDate: new Date("2026-05-21"),
      releaseNotes: `## Fixed
- Made public docs pages reactive to route param changes
- Documentation now updates correctly when navigating between collections
- Resolved issues with stale content in published API docs

## Changed
- Improved routing reactivity for public documentation`,
      branch: "main",
      tags: "docs,routing,fix",
      commitHash: "5563d18",
      approver: "Zein",
    },
    {
      version: "0.8.3",
      status: "published",
      releaseDate: new Date("2026-05-21"),
      releaseNotes: `## Fixed
- Persist docMode in Publish API Documentation modal after refresh
- Documentation mode selection now survives page reloads
- Fixed state loss when refreshing the publish docs interface

## Changed
- Improved state persistence for documentation workflows`,
      branch: "main",
      tags: "docs,state,persistence",
      commitHash: "72c81be",
      approver: "Zein",
    },
    {
      version: "0.8.2",
      status: "published",
      releaseDate: new Date("2026-05-21"),
      releaseNotes: `## Added
- Published docs guide view with outline + sidebar navigation
- Doc blocks system: markdown, image, table, endpoint reference, divider
- Resizable sidebar in published documentation
- Props and DocBlock components for structured API documentation
- Reactive to route param changes
- Support for query and path parameter display

## Changed
- Redesigned doc modals for better UX
- Improved navigation structure in published docs`,
      branch: "main",
      tags: "docs,publishing,navigation",
      commitHash: "1130e74",
      approver: "Zein",
    },
    {
      version: "0.8.0",
      status: "published",
      releaseDate: new Date("2026-05-21"),
      releaseNotes: `## Added
- Publish API documentation for collections
- Public routes: /collection-docs/:slug
- Guide view with outline/sidebar navigation
- Doc blocks system (markdown, image, table, endpoint reference, divider)
- Resizable sidebar in published docs
- Props and DocBlock components for structured API docs
- Feedback system with comments and voting
- Configurable feedback forms (super admin controlled)
- Multiple question types: rating, text, multiple choice, single choice
- Time-window control for feedback collection
- Public/private visibility for submissions
- Upvoting system with vote tracking
- Commenting on feedback submissions
- Status tracking: open, pending, process, resolved, closed

## Fixed
- Datadog error correlation for feedback submissions
- Improved feedback polling and toast notifications

## Changed
- Major feature release for documentation and feedback`,
      branch: "main",
      tags: "docs,publishing,feedback,major",
      commitHash: "89cb67f",
      approver: "Zein",
    },
    {
      version: "0.7.37",
      status: "published",
      releaseDate: new Date("2026-05-21"),
      releaseNotes: `## Added
- Collection-level authentication configuration
- Auth types: API Key, Bearer, Basic, OAuth2
- Requests can inherit auth from parent collection
- Endpoints: GET/POST/DELETE /api/collections/:id/auth
- JSONC support in request body
- JSON with Comments support (jsonc-parser dependency)
- Single-line (//) and multi-line (/* */) comments
- Trailing commas allowed
- Comments stripped before sending requests
- Usage analytics and super admin dashboard
- Tracks all API operations (requests, collections, folders, mocks, environments, projects, workspaces)
- Daily/weekly/monthly aggregated statistics
- User and workspace activity trends
- Success rate and response time monitoring
- Super admin panel at /admin/super-usage
- Magic variables support
- Postman-style dynamic variables: {{$timestamp}}, {{$guid}}, {{$randomInt}}
- Full faker.js integration for mock data generation

## Changed
- Enhanced request builder with JSONC support
- Improved analytics tracking across all operations`,
      branch: "main",
      tags: "auth,jsonc,analytics,magic-vars",
      commitHash: "b60d4a1",
      approver: "Zein",
    },
  ];

    const createdVersions: NonNullable<typeof appVersions.$inferSelect>[] = [];
    for (const v of versionsData) {
      const [version] = await db
        .insert(appVersions)
        .values({
          appId: postrack.id,
          version: v.version,
          status: v.status as "published" | "draft" | "rc",
          releaseDate: v.releaseDate,
          releaseNotes: v.releaseNotes,
          branch: v.branch,
          tags: v.tags,
          commitHash: v.commitHash,
          approver: v.approver,
          createdBy: "Zein",
        })
        .returning();
      if (!version) continue;
      createdVersions.push(version);
      console.log("Created version:", version.version);
    }
    postrackVersions = createdVersions;
  } else {
    console.log(`Postrack already has ${postrackVersions.length} versions, skipping version creation.`);
  }

  // 3. Create Postrack releases if none exist
  const existingPostrackReleases = await db.select().from(releases).where(eq(releases.appId, postrack.id));
  if (existingPostrackReleases.length === 0) {
    for (const version of postrackVersions) {
      if (!version) continue;
      // Normal release (auto-synced from changelog)
      await db.insert(releases).values({
        appId: postrack.id,
        versionId: version.id,
        heroTitle: `Postrack ${version.version}`,
        summary: version.releaseNotes,
        categories: parseCategories(version.releaseNotes ?? ""),
        type: "normal" as const,
        published: true,
      });

      // Article release for major versions
      if (["0.8.0", "0.8.7", "0.7.37"].includes(version.version)) {
        const articleContent = generateArticleContent(version.version, version.releaseNotes ?? "");
        await db.insert(releases).values({
          appId: postrack.id,
          versionId: version.id,
          heroTitle: articleContent.heroTitle,
          summary: articleContent.summary,
          features: articleContent.features,
          categories: articleContent.categories,
          type: "article" as const,
          published: true,
        });
        console.log("Created article release for version:", version.version);
      }
      console.log("Created release for version:", version.version);
    }
  } else {
    console.log(`Postrack already has ${existingPostrackReleases.length} releases, skipping release creation.`);
  }

  // ─── 2. TELEMATICS APP ─────────────────────────────────────────
  let telematics = await db.select().from(apps).where(eq(apps.name, "Telematics")).then(r => r[0]);
  
  if (!telematics) {
    const [newApp] = await db
      .insert(apps)
      .values({
        name: "Telematics",
        description: "GPS tracking and fleet management platform. Real-time vehicle monitoring, route history, geofencing, and driver behavior analytics.",
        owner: "Hari Nugroho",
        status: "active" as const,
        repoUrl: "https://github.com/transtrack/telematics",
      })
      .returning();
    
    if (!newApp) {
      throw new Error("Failed to create Telematics app");
    }
    
    telematics = newApp;
    console.log("Created app:", telematics.name);
  } else {
    console.log("Telematics app already exists.", telematics.name);
  }

  // Telematics versions
  const telematicsVersionsData = [
    {
      version: "2.1.0",
      status: "published",
      releaseDate: new Date("2026-05-20"),
      releaseNotes: `## Added
- Webhook notification support for real-time events
- Camera media endpoint for downloading vehicle photos
- Get Address endpoint for reverse geocoding

## Fixed
- Improved geofence accuracy for polygon boundaries
- Fixed history endpoint pagination for large date ranges

## Changed
- Updated device status response format with additional fields`,
      branch: "main",
      tags: "webhook,camera,geocoding,geofence",
      commitHash: "a1b2c3d",
      approver: "Hari",
    },
    {
      version: "2.0.0",
      status: "published",
      releaseDate: new Date("2026-04-15"),
      releaseNotes: `## Added
- New API v2 with standardized response format
- Generate Report endpoint for PDF and Excel exports
- Get Geofence endpoint for boundary management
- Get Events endpoint for alert filtering

## Changed
- Authentication moved to Bearer token in header
- Base URL updated to https://telematics.transtrack.id

## Deprecated
- API v1 endpoints (sunset December 2026)`,
      branch: "main",
      tags: "api-v2,reports,geofence,events,auth",
      commitHash: "e4f5g6h",
      approver: "Hari",
    },
    {
      version: "1.5.0",
      status: "published",
      releaseDate: new Date("2026-03-10"),
      releaseNotes: `## Added
- History endpoint with date range filtering
- Devices endpoint with status and metadata
- Login endpoint with token-based authentication

## Fixed
- Resolved timeout issues on large fleet queries
- Improved error messages for invalid credentials`,
      branch: "main",
      tags: "history,devices,login,auth",
      commitHash: "i7j8k9l",
      approver: "Hari",
    },
  ];

  // Check for existing Telematics versions
  const existingTelematicsVersions = await db.select().from(appVersions).where(eq(appVersions.appId, telematics.id));
  
  const telematicsVersions: NonNullable<typeof appVersions.$inferSelect>[] = [];
  if (existingTelematicsVersions.length > 0) {
    console.log(`Telematics already has ${existingTelematicsVersions.length} versions, skipping version/release creation.`);
    telematicsVersions.push(...existingTelematicsVersions);
  } else {
    for (const v of telematicsVersionsData) {
      const [version] = await db
        .insert(appVersions)
        .values({
          appId: telematics.id,
          version: v.version,
          status: v.status as "published" | "draft" | "rc",
          releaseDate: v.releaseDate,
          releaseNotes: v.releaseNotes,
          branch: v.branch,
          tags: v.tags,
          commitHash: v.commitHash,
          approver: v.approver,
          createdBy: "Hari",
        })
        .returning();
      if (!version) continue;
      telematicsVersions.push(version);
      console.log("Created Telematics version:", version.version);
    }

    // Telematics releases
    for (const version of telematicsVersions) {
      await db.insert(releases).values({
        appId: telematics.id,
        versionId: version.id,
        heroTitle: `Telematics ${version.version}`,
        summary: version.releaseNotes,
        categories: parseCategories(version.releaseNotes ?? ""),
        type: "normal" as const,
        published: true,
      });
      console.log("Created Telematics release for version:", version.version);
    }
  }

  // Telematics documentation — single comprehensive API doc
  const telematicsDocs = [
    {
      appId: telematics.id,
      title: "Telematics",
      content: `# Telematics

Base URL: \`https://telematics.transtrack.id\`

---

## Authentication

The Telematics API uses token-based authentication. All endpoints (except Login) require a valid Bearer token in the Authorization header.

### [POST] Login

**Endpoint:**
\`\`\`
POST https://telematics.transtrack.id/api/login
\`\`\`

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "your_password"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "user@example.com"
    }
  }
}
\`\`\`

### Using the Token

Include the token in all subsequent requests:

\`\`\`
Authorization: Bearer <your_token_here>
\`\`\`

> Tokens expire after 24 hours. Refresh by calling the login endpoint again.

---

## Devices

Manage and query GPS tracking devices in your fleet.

### [GET] Devices

**Endpoint:**
\`\`\`
GET https://telematics.transtrack.id/api/devices
\`\`\`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: online, offline, idle |
| group_id | integer | Filter by device group |
| limit | integer | Max results per page (default: 50) |

**Response:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "name": "TRUCK-001",
      "imei": "359613082345678",
      "status": "online",
      "last_position": {
        "latitude": -6.2088,
        "longitude": 106.8456,
        "speed": 45.2,
        "heading": 180,
        "timestamp": "2026-05-20T08:30:00Z"
      },
      "metadata": {
        "vehicle_type": "truck",
        "license_plate": "B 1234 ABC",
        "driver_name": "Budi Santoso"
      }
    }
  ],
  "pagination": {
    "total": 128,
    "page": 1,
    "per_page": 50
  }
}
\`\`\`

**Device Status Values:**
- **online** — Device is actively reporting
- **offline** — No data received for > 10 minutes
- **idle** — Engine on but not moving

---

## History

Access historical route data for fleet analysis.

### [GET] History

**Endpoint:**
\`\`\`
GET https://telematics.transtrack.id/api/history
\`\`\`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| device_id | integer | Yes | Device identifier |
| start_date | string | Yes | ISO 8601 datetime |
| end_date | string | Yes | ISO 8601 datetime |
| resolution | string | No | point, minute, hour, day |

**Example Request:**
\`\`\`
GET /api/history?device_id=456&start_date=2026-05-01T00:00:00Z&end_date=2026-05-20T23:59:59Z&resolution=hour
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "device_id": 456,
    "total_distance_km": 1247.5,
    "total_duration_hours": 48.3,
    "max_speed_kmh": 89.2,
    "average_speed_kmh": 62.1,
    "points": [
      {
        "timestamp": "2026-05-20T08:00:00Z",
        "latitude": -6.2088,
        "longitude": 106.8456,
        "speed": 45.2,
        "altitude": 12,
        "ignition": true
      }
    ]
  }
}
\`\`\`

---

## Reports

Generate fleet analytics reports.

### [GET] Generate Report

**Endpoint:**
\`\`\`
GET https://telematics.transtrack.id/api/reports/generate
\`\`\`

**Report Types:**
- \`trip_summary\` — Distance, duration, stops per trip
- \`driver_behavior\` — Harsh braking, acceleration, cornering
- \`fuel_consumption\` — Estimated fuel usage by vehicle
- \`geofence_violations\` — Entries and exits from defined zones

**Response:** Returns a download URL for the generated PDF or Excel file.

---

## Geofence

Define geographic boundaries and manage zones.

### [GET] Get Geofence

**Endpoint:**
\`\`\`
GET https://telematics.transtrack.id/api/geofences
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "name": "Jakarta Depot",
      "type": "polygon",
      "coordinates": [
        [-6.1751, 106.8272],
        [-6.1751, 106.8500],
        [-6.2000, 106.8500],
        [-6.2000, 106.8272]
      ],
      "alert_on_enter": true,
      "alert_on_exit": true,
      "devices_assigned": [456, 457, 458]
    }
  ]
}
\`\`\`

---

## Events

Receive and query fleet alert events.

### [GET] Get Events

**Endpoint:**
\`\`\`
GET https://telematics.transtrack.id/api/events
\`\`\`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| event_type | string | geofence, overspeed, idle, panic |
| severity | string | low, medium, high, critical |
| start_date | string | Filter by date range |

**Event Types:**
- **geofence** — Entry or exit from a defined zone
- **overspeed** — Vehicle exceeded speed limit
- **idle** — Engine on but stationary for extended period
- **panic** — Driver pressed SOS button

---

## Camera & Media

Access camera photos and media captured by vehicle-mounted devices.

### [GET] Camera Media

**Endpoint:**
\`\`\`
GET https://telematics.transtrack.id/api/camera/media
\`\`\`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| device_id | integer | Yes | Device identifier |
| date | string | Yes | Date in YYYY-MM-DD format |
| trigger | string | No | ignition_on, ignition_off, panic, request |

**Response:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "media_id": "CAM-20260520-083000",
      "timestamp": "2026-05-20T08:30:00Z",
      "trigger": "ignition_on",
      "url": "https://cdn.transtrack.id/media/CAM-20260520-083000.jpg",
      "thumbnail": "https://cdn.transtrack.id/media/thumbs/CAM-20260520-083000.jpg",
      "location": {
        "latitude": -6.2088,
        "longitude": 106.8456
      }
    }
  ]
}
\`\`\`

---

## Address

Reverse geocoding from GPS coordinates.

### [GET] Get Address

**Endpoint:**
\`\`\`
GET https://telematics.transtrack.id/api/address
\`\`\`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lat | float | Yes | Latitude |
| lng | float | Yes | Longitude |

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "address": "Jl. Sudirman No. 123, Jakarta Pusat, DKI Jakarta",
    "country": "Indonesia",
    "city": "Jakarta",
    "postal_code": "10220"
  }
}
\`\`\`

---

## Webhooks

Receive real-time notifications via HTTP POST callbacks when events occur in your fleet.

### [WEBHOOK] Notification

Configure webhooks to receive instant updates for:
- **Device status changes** — online, offline, idle transitions
- **Geofence alerts** — Entry and exit events
- **Speed violations** — When vehicles exceed configured limits
- **Camera triggers** — New photo captured
- **SOS / Panic** — Emergency button pressed

**Payload:**
\`\`\`json
{
  "event_id": "evt_123456789",
  "event_type": "geofence.enter",
  "timestamp": "2026-05-20T08:30:00Z",
  "device": {
    "id": 456,
    "name": "TRUCK-001",
    "imei": "359613082345678"
  },
  "data": {
    "geofence_id": 789,
    "geofence_name": "Jakarta Depot",
    "location": {
      "latitude": -6.1900,
      "longitude": 106.8350
    }
  }
}
\`\`\`

**Setup:**
1. Go to Settings > Integrations > Webhooks
2. Enter your endpoint URL
3. Select event types to subscribe to
4. Save and verify with a test event

**Security:**
- All webhooks include a signature header for verification
- Use HTTPS endpoints only
- Implement idempotency to handle duplicate deliveries`,
      status: "published" as const,
      versionId: telematicsVersions[0]!.id,
      tags: ["telematics", "api", "gps", "fleet", "documentation"],
      author: "Hari Nugroho",
    },
  ];

  // Check if docs already exist for Telematics
  const existingDocs = await db.select().from(docs).where(eq(docs.appId, telematics.id));
  if (existingDocs.length > 0) {
    console.log(`Telematics already has ${existingDocs.length} docs, skipping doc creation.`);
  } else {
    for (const doc of telematicsDocs) {
      await db.insert(docs).values(doc);
      console.log("Created doc:", doc.title);
    }
  }

  console.log("Seeding complete!");
}

function parseCategories(notes: string) {
  const categories: Record<string, string[]> = {};
  const lines = notes.split("\n");
  let currentCategory = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## Added")) {
      currentCategory = "added";
      categories.added = [];
    } else if (trimmed.startsWith("## Fixed")) {
      currentCategory = "fixed";
      categories.fixed = [];
    } else if (trimmed.startsWith("## Changed")) {
      currentCategory = "changed";
      categories.changed = [];
    } else if (trimmed.startsWith("## Deprecated")) {
      currentCategory = "deprecated";
      categories.deprecated = [];
    } else if (trimmed.startsWith("## Security")) {
      currentCategory = "security";
      categories.security = [];
    } else if (trimmed.startsWith("- ") && currentCategory) {
      const cat = categories[currentCategory];
      if (cat) {
        cat.push(trimmed.replace("- ", ""));
      }
    }
  }

  return categories;
}

function generateArticleContent(version: string, notes: string) {
  const articles: Record<string, any> = {
    "0.8.7": {
      heroTitle: "Inline Environment Variable Editing: Edit Values Without Leaving Your Flow",
      summary: `We're excited to introduce inline environment variable editing in Postrack ${version}. This feature allows you to hover over any environment variable and see a popup editor where you can modify values directly — including secret variables with a reveal toggle.

### What's New

**Hover Popup Editor**
Simply hover over any environment variable in your requests to see a contextual popup. No more navigating to separate settings pages.

**Keyboard Shortcuts**
- Enter to save changes
- Escape to cancel
- Tab to navigate between fields

**Secret Variable Support**
Edit secret variables with confidence using the reveal toggle. Values are masked by default but can be revealed for editing.

**Copy to Clipboard**
Quickly copy variable values with a single click in the popup.

### Improvements

We've also refined the admin collection docs button placement, moving it into the Edit Collection modal for a more intuitive workflow. Various styling improvements for text-primary and bg-transparent classes ensure consistent theming across light and dark modes.`,
      features: [
        {
          id: crypto.randomUUID(),
          heading: "Hover Popup Editor",
          description: "Hover over any environment variable to see a contextual popup editor. Edit values inline without leaving your current context.",
        },
        {
          id: crypto.randomUUID(),
          heading: "Keyboard Shortcuts",
          description: "Press Enter to save, Escape to cancel, and Tab to navigate between fields for rapid editing.",
        },
        {
          id: crypto.randomUUID(),
          heading: "Secret Variable Support",
          description: "Edit sensitive values securely with the reveal toggle. Values remain masked by default for security.",
        },
      ],
    },
    "0.8.0": {
      heroTitle: "Publish API Documentation and Collect Feedback",
      summary: `Postrack ${version} introduces two major features: the ability to publish beautiful API documentation for your collections, and a comprehensive feedback system for your team.

### Publish API Documentation

Transform your collections into published documentation with:
- Public routes at /collection-docs/:slug
- Guide view with outline and sidebar navigation
- Doc blocks: markdown, images, tables, endpoint references, and dividers
- Resizable sidebar for comfortable reading
- Props and DocBlock components for structured API documentation

### Feedback System

Collect and manage feedback with:
- Configurable feedback forms (super admin controlled)
- Multiple question types: rating, text, multiple choice, single choice
- Time-window control for feedback collection
- Public/private visibility for submissions
- Upvoting system with vote tracking
- Commenting on feedback submissions
- Status tracking: open, pending, process, resolved, closed

### Getting Started

Navigate to any collection and click "Publish Documentation" to create your public docs. Set up feedback forms in your workspace settings.`,
      features: [
        {
          id: crypto.randomUUID(),
          heading: "Published API Documentation",
          description: "Publish your collections as beautiful, navigable API documentation with support for markdown, images, tables, and endpoint references.",
        },
        {
          id: crypto.randomUUID(),
          heading: "Feedback System",
          description: "Collect structured feedback from your team with configurable forms, voting, comments, and status tracking.",
        },
        {
          id: crypto.randomUUID(),
          heading: "Super Admin Dashboard",
          description: "Manage all feedback submissions, configure forms, and track workspace usage from the super admin panel.",
        },
      ],
    },
    "0.7.37": {
      heroTitle: "Collection Auth, JSONC Support, and Magic Variables",
      summary: `Postrack ${version} brings powerful new capabilities for authentication, request body editing, and dynamic data generation.

### Collection-Level Authentication

Configure authentication at the collection level and let requests inherit settings:
- API Key, Bearer, Basic, and OAuth2 support
- Requests automatically inherit auth from parent collection
- Override per-request when needed
- Endpoints: GET/POST/DELETE /api/collections/:id/auth

### JSONC Support

Write JSON with comments in request bodies:
- Single-line (//) and multi-line (/* */) comments
- Trailing commas allowed
- Comments automatically stripped before sending
- Full support via jsonc-parser

### Magic Variables

Generate dynamic test data with Postman-style variables:
- {{$timestamp}} for current timestamps
- {{$guid}} for UUID generation
- {{$randomInt}} for random integers
- Full faker.js integration for realistic mock data

### Usage Analytics

Track all API operations with the new super admin dashboard:
- Daily, weekly, and monthly statistics
- User and workspace activity trends
- Success rate and response time monitoring
- Available at /admin/super-usage`,
      features: [
        {
          id: crypto.randomUUID(),
          heading: "Collection Auth Inheritance",
          description: "Set authentication at the collection level and have all requests inherit the configuration automatically.",
        },
        {
          id: crypto.randomUUID(),
          heading: "JSONC in Request Bodies",
          description: "Write JSON with comments and trailing commas. Comments are stripped automatically before sending requests.",
        },
        {
          id: crypto.randomUUID(),
          heading: "Magic Variables",
          description: "Generate dynamic data with {{$timestamp}}, {{$guid}}, {{$randomInt}}, and full faker.js integration.",
        },
      ],
    },
  };

  const article = articles[version] || {
    heroTitle: `Postrack ${version}`,
    summary: notes,
    features: [],
  };

  return {
    ...article,
    categories: parseCategories(notes),
  };
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
