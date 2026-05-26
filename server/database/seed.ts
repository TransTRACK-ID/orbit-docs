import { db } from "./index";
import { apps, appVersions, releases } from "./schema";

async function seed() {
  console.log("Seeding Postrack data…");

  // 1. Create Postrack app
  const [postrack] = await db
    .insert(apps)
    .values({
      name: "Postrack",
      description: "A Postman/Insomnia alternative for building, testing, mocking, documenting, and sharing APIs. Workspace-based API organization with request builder, HTTP proxy, cloud mock routing, OpenAPI import, and public API documentation.",
      owner: "Postrack Team",
      status: "active",
      repoUrl: "https://github.com/postrack/postrack",
    })
    .returning();

  console.log("Created app:", postrack.name);

  // 2. Create versions
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

  const createdVersions = [];
  for (const v of versionsData) {
    const [version] = await db
      .insert(appVersions)
      .values({
        appId: postrack.id,
        ...v,
        createdBy: "Zein",
      })
      .returning();
    createdVersions.push(version);
    console.log("Created version:", version.version);
  }

  // 3. Create releases for each version
  for (const version of createdVersions) {
    // Normal release (auto-synced from changelog)
    await db.insert(releases).values({
      appId: postrack.id,
      versionId: version.id,
      heroTitle: `Postrack ${version.version}`,
      summary: version.releaseNotes,
      categories: parseCategories(version.releaseNotes),
      type: "normal",
      published: true,
    });

    // Article release for major versions
    if (["0.8.0", "0.8.7", "0.7.37"].includes(version.version)) {
      const articleContent = generateArticleContent(version.version, version.releaseNotes);
      await db.insert(releases).values({
        appId: postrack.id,
        versionId: version.id,
        heroTitle: articleContent.heroTitle,
        summary: articleContent.summary,
        features: articleContent.features,
        categories: articleContent.categories,
        type: "article",
        published: true,
      });
    }

    console.log("Created releases for version:", version.version);
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
      categories[currentCategory].push(trimmed.replace("- ", ""));
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
