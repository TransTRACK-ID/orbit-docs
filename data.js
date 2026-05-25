// ═══════════════════════════════════════════════════════════════
// Orbit Docs — Shared Data Model
// ═══════════════════════════════════════════════════════════════
// Versions are the source of truth. Each version may have:
//   - changelog (draft or published)
//   - release (published or not)
// Data is persisted in localStorage so all pages share state.
// ═══════════════════════════════════════════════════════════════

(function (global) {
  const STORAGE_KEY = 'orbitDocsData';

  const defaultApps = [
    {
      id: 'api-gateway',
      name: 'API Gateway',
      currentVersion: 'v2.4.1',
      versions: [
        {
          id: 'api-gateway-2.4.1',
          version: 'v2.4.1',
          date: '2026-05-18',
          author: 'Sarah Chen',
          status: 'published',
          changelogStatus: 'published',
          changelogContent: `## [2.4.1] - 2026-05-18

### Fixed
- Webhook retry logic now correctly backs off after 3 failed attempts
- Edge routes forward custom headers as documented
- Rate-limit counters reset on configuration reload

### Added
- Support for \`X-Request-ID\` tracing through the gateway
- New endpoint \`/health/deep\` for dependency checks

### Changed
- Default timeout increased from 30s to 60s for long-polling clients
- Log format now includes upstream response time`,
          release: {
            published: true,
            heroTitle: 'Request tracing, deep health checks, and retry reliability',
            summary: 'Webhook retry fixes, X-Request-ID tracing, and deep health checks.',
            features: [
              {
                id: 'request-tracing',
                heading: 'Trace every request across your stack',
                description: 'The gateway now propagates X-Request-ID headers through every hop. When a client sends a request ID, the gateway forwards it to upstream services and includes it in all log entries.',
                media: [{ type: 'image', src: '', alt: 'Request flow diagram' }]
              },
              {
                id: 'deep-health',
                heading: 'Know when dependencies are actually healthy',
                description: 'The new /health/deep endpoint checks every configured upstream and database connection before returning 200.',
                media: []
              }
            ],
            categories: {
              fixed: [
                'Webhook retry logic now correctly backs off after 3 failed attempts',
                'Edge routes forward custom headers as documented',
                'Rate-limit counters reset on configuration reload'
              ],
              added: [
                'Support for X-Request-ID tracing through the gateway',
                'New endpoint /health/deep for dependency checks'
              ],
              changed: [
                'Default timeout increased from 30s to 60s for long-polling clients',
                'Log format now includes upstream response time'
              ]
            }
          }
        },
        {
          id: 'api-gateway-2.4.0',
          version: 'v2.4.0',
          date: '2026-05-10',
          author: 'Sarah Chen',
          status: 'published',
          changelogStatus: 'published',
          changelogContent: `## [2.4.0] - 2026-05-10

### Added
- GraphQL query complexity analysis
- Brotli compression for responses > 1KB

### Deprecated
- Legacy \`/v1/batch\` endpoint — migrate to \`/v2/batch\` by Q3

### Security
- Updated OpenSSL to 3.2.1
- CVE-2026-3847 patched in auth middleware`,
          release: {
            published: true,
            heroTitle: 'GraphQL complexity analysis and Brotli compression',
            summary: 'GraphQL complexity analysis, Brotli compression, and batch endpoint deprecation.',
            features: [
              {
                id: 'graphql-analysis',
                heading: 'GraphQL query complexity analysis',
                description: 'The gateway now analyzes GraphQL query complexity before execution. Queries exceeding configured thresholds are rejected early, preventing resource exhaustion attacks.',
                media: [{ type: 'image', src: '', alt: 'GraphQL complexity analyzer UI' }]
              }
            ],
            categories: {
              added: [
                'GraphQL query complexity analysis',
                'Brotli compression for responses > 1KB'
              ],
              deprecated: [
                'Legacy /v1/batch endpoint — migrate to /v2/batch by Q3'
              ],
              security: [
                'Updated OpenSSL to 3.2.1',
                'CVE-2026-3847 patched in auth middleware'
              ]
            }
          }
        },
        {
          id: 'api-gateway-2.3.5',
          version: 'v2.3.5',
          date: '2026-04-20',
          author: 'Mike Ross',
          status: 'published',
          changelogStatus: 'published',
          changelogContent: `## [2.3.5] - 2026-04-20

### Fixed
- Memory leak in connection pool under high load`,
          release: {
            published: true,
            heroTitle: 'Critical memory leak fix',
            summary: 'Critical fix for memory leak in connection pool under high load.',
            features: [],
            categories: {
              fixed: ['Memory leak in connection pool under high load']
            }
          }
        },
        {
          id: 'api-gateway-2.3.2',
          version: 'v2.3.2',
          date: '2026-04-28',
          author: 'Mike Ross',
          status: 'archived',
          changelogStatus: 'missing',
          changelogContent: '',
          release: null
        },
        {
          id: 'api-gateway-2.3.1',
          version: 'v2.3.1',
          date: '2026-04-15',
          author: 'Sarah Chen',
          status: 'archived',
          changelogStatus: 'missing',
          changelogContent: '',
          release: null
        },
        {
          id: 'api-gateway-2.3.0',
          version: 'v2.3.0',
          date: '2026-04-02',
          author: 'Jen Park',
          status: 'archived',
          changelogStatus: 'missing',
          changelogContent: '',
          release: null
        },
        {
          id: 'api-gateway-2.2.1',
          version: 'v2.2.1',
          date: '2026-03-20',
          author: 'Sarah Chen',
          status: 'archived',
          changelogStatus: 'missing',
          changelogContent: '',
          release: null
        },
        {
          id: 'api-gateway-2.2.0',
          version: 'v2.2.0',
          date: '2026-03-10',
          author: 'Mike Ross',
          status: 'archived',
          changelogStatus: 'missing',
          changelogContent: '',
          release: null
        },
        {
          id: 'api-gateway-2.1.0',
          version: 'v2.1.0',
          date: '2026-02-28',
          author: 'Sarah Chen',
          status: 'archived',
          changelogStatus: 'missing',
          changelogContent: '',
          release: null
        }
      ]
    },
    {
      id: 'auth-service',
      name: 'Auth Service',
      currentVersion: 'v1.8.0',
      versions: [
        {
          id: 'auth-service-1.8.0',
          version: 'v1.8.0',
          date: '2026-05-08',
          author: 'Sarah Chen',
          status: 'published',
          changelogStatus: 'published',
          changelogContent: `## [1.8.0] - 2026-05-08

### Added
- OAuth 2.1 PKCE support for public clients
- Session rotation on token refresh
- Refreshed token flows with sliding expiration

### Fixed
- Race condition in concurrent token refresh

### Changed
- Password policy now requires 12 characters minimum

### Security
- Hardened token validation against timing attacks`,
          release: {
            published: true,
            heroTitle: 'OAuth 2.1 PKCE and session rotation',
            summary: 'OAuth 2.1 PKCE support, session rotation, and refreshed token flows.',
            features: [
              {
                id: 'pkce',
                heading: 'OAuth 2.1 PKCE support',
                description: 'Public clients can now use Proof Key for Code Exchange (PKCE) for secure authorization flows without a client secret.',
                media: [
                  { type: 'video', src: '', alt: 'PKCE flow demonstration' },
                  { type: 'image', src: '', alt: 'PKCE configuration panel' }
                ]
              }
            ],
            categories: {
              added: [
                'OAuth 2.1 PKCE support for public clients',
                'Session rotation on token refresh',
                'Refreshed token flows with sliding expiration'
              ],
              fixed: ['Race condition in concurrent token refresh'],
              changed: ['Password policy now requires 12 characters minimum'],
              security: ['Hardened token validation against timing attacks']
            }
          }
        },
        {
          id: 'auth-service-1.7.3',
          version: 'v1.7.3',
          date: '2026-04-15',
          author: 'Jen Park',
          status: 'published',
          changelogStatus: 'published',
          changelogContent: `## [1.7.3] - 2026-04-15

### Security
- CVE-2026-2911 patched in JWT library
- Updated bcrypt to v5.1.1`,
          release: {
            published: true,
            heroTitle: 'Security patches',
            summary: 'CVE patches and hardened password validation rules.',
            features: [],
            categories: {
              security: [
                'CVE-2026-2911 patched in JWT library',
                'Updated bcrypt to v5.1.1'
              ]
            }
          }
        }
      ]
    },
    {
      id: 'payment-core',
      name: 'Payment Core',
      currentVersion: 'v3.1.2',
      versions: [
        {
          id: 'payment-core-3.1.2',
          version: 'v3.1.2',
          date: '2026-05-05',
          author: 'Mike Ross',
          status: 'published',
          changelogStatus: 'published',
          changelogContent: `## [3.1.2] - 2026-05-05

### Fixed
- Stripe webhook idempotency key collision
- Payout retry logic for transient failures

### Changed
- Webhook timeout increased to 30 seconds`,
          release: {
            published: true,
            heroTitle: 'Stripe webhook reliability improvements',
            summary: 'Stripe webhook idempotency fix and retry logic for failed payouts.',
            features: [
              {
                id: 'webhook-retry',
                heading: 'Automatic webhook retry with exponential backoff',
                description: 'Failed Stripe webhooks are now automatically retried with exponential backoff up to 24 hours. Each retry is idempotent, preventing duplicate processing.',
                media: [
                  { type: 'image', src: '', alt: 'Webhook retry timeline' },
                  { type: 'image', src: '', alt: 'Retry configuration settings' }
                ]
              }
            ],
            categories: {
              fixed: [
                'Stripe webhook idempotency key collision',
                'Payout retry logic for transient failures'
              ],
              changed: ['Webhook timeout increased to 30 seconds']
            }
          }
        }
      ]
    },
    {
      id: 'user-dashboard',
      name: 'User Dashboard',
      currentVersion: 'v4.0.0',
      versions: [
        {
          id: 'user-dashboard-4.0.0',
          version: 'v4.0.0',
          date: '2026-04-28',
          author: 'Jen Park',
          status: 'published',
          changelogStatus: 'published',
          changelogContent: `## [4.0.0] - 2026-04-28

### Added
- Real-time usage analytics dashboard
- Role-based access control (RBAC)
- Dark mode support
- Export to CSV and PDF
- Custom alert thresholds

### Changed
- Navigation reorganized by function
- Settings consolidated into single panel
- Notification preferences moved to profile`,
          release: {
            published: true,
            heroTitle: 'Complete UI refresh with real-time analytics',
            summary: 'Complete UI refresh with real-time analytics and new role-based access.',
            features: [
              {
                id: 'ui-refresh',
                heading: 'New design system and component library',
                description: 'Every screen has been rebuilt with the new Orbit design system. Components are consistent, accessible, and responsive.',
                media: [
                  { type: 'video', src: '', alt: 'UI refresh walkthrough' },
                  { type: 'image', src: '', alt: 'New dashboard overview' },
                  { type: 'image', src: '', alt: 'Component gallery' }
                ]
              },
              {
                id: 'realtime-analytics',
                heading: 'Real-time usage analytics',
                description: 'Live event stream shows active users, API calls, and error rates updating every 5 seconds.',
                media: [{ type: 'video', src: '', alt: 'Real-time analytics demo' }]
              }
            ],
            categories: {
              added: [
                'Real-time usage analytics dashboard',
                'Role-based access control (RBAC)',
                'Dark mode support',
                'Export to CSV and PDF',
                'Custom alert thresholds'
              ],
              changed: [
                'Navigation reorganized by function',
                'Settings consolidated into single panel',
                'Notification preferences moved to profile'
              ]
            }
          }
        }
      ]
    }
  ];

  function loadApps() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load orbit docs data', e);
    }
    return JSON.parse(JSON.stringify(defaultApps));
  }

  function saveApps(apps) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  }

  function getApp(apps, appId) {
    return apps.find(a => a.id === appId);
  }

  function getVersion(apps, appId, versionId) {
    const app = getApp(apps, appId);
    if (!app) return null;
    return app.versions.find(v => v.id === versionId || v.version === versionId);
  }

  function getAllReleases(apps) {
    const releases = [];
    apps.forEach(app => {
      app.versions.forEach(v => {
        if (v.release && v.release.published) {
          releases.push({
            id: v.id,
            app: app.name,
            appId: app.id,
            version: v.version,
            date: v.date,
            author: v.author,
            status: v.status,
            summary: v.release.summary,
            heroTitle: v.release.heroTitle,
            features: v.release.features,
            categories: v.release.categories
          });
        }
      });
    });
    return releases.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function getAllVersions(apps) {
    const versions = [];
    apps.forEach(app => {
      app.versions.forEach(v => {
        versions.push({
          ...v,
          appId: app.id,
          appName: app.name
        });
      });
    });
    return versions.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function countCategories(categories) {
    if (!categories) return { added: 0, fixed: 0, changed: 0, deprecated: 0, security: 0 };
    return {
      added: (categories.added || []).length,
      fixed: (categories.fixed || []).length,
      changed: (categories.changed || []).length,
      deprecated: (categories.deprecated || []).length,
      security: (categories.security || []).length
    };
  }

  function renderPill(count, label, colorClass) {
    if (!count) return '';
    return `<span class="pill ${colorClass}">${count} ${label}</span>`;
  }

  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }

  // Expose to global
  global.OrbitDocs = {
    STORAGE_KEY,
    loadApps,
    saveApps,
    getApp,
    getVersion,
    getAllReleases,
    getAllVersions,
    formatDate,
    countCategories,
    renderPill,
    parseUrlParams,
    defaultApps
  };
})(window);
