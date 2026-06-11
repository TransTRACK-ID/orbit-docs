// https://nuxt.com/docs/api/configuration/nuxt-config

/** Normalize NUXT_APP_BASE_URL to a leading-slash path without trailing slash. */
function normalizeAppBaseURL(v?: string): string {
  if (!v || v === "/") return "/";
  const trimmed = v.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const appBaseURL = normalizeAppBaseURL(process.env.NUXT_APP_BASE_URL);

export default defineNuxtConfig({
  devtools: {
    enabled: process.env.NODE_ENV === 'development',

    timeline: {
      enabled: true,
    },
  },

  app: {
    // Required when the app is served under a subpath (e.g. /docs behind nginx).
    // Must be set at BUILD time so SPA asset URLs are baked correctly.
    baseURL: appBaseURL,
    // Relative to baseURL — do NOT use a leading slash or assets resolve from domain root.
    buildAssetsDir: "_nuxt/",
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
    },
  },

  build: {
    transpile: ["@vuepic/vue-datepicker", "gsap"],
  },

  css: ["@/assets/css/global.css"],

  modules: [
    "@nuxtjs/tailwindcss",
    "@pinia/nuxt",
    "@pinia-plugin-persistedstate/nuxt",
    "@sidebase/nuxt-auth",
    "nuxt3-leaflet",
    "@nuxt/image",
    "@nuxt/icon",
  ],

  ssr: false,

  auth: {
    baseURL: appBaseURL === "/"
      ? "/api/auth"
      : `${appBaseURL}/api/auth`,
    provider: {
      type: "local",
      endpoints: {
        signIn: {
          path: "login",
          method: "post",
        },
        signOut: {
          path: "logout",
          method: "post",
        },
        getSession: {
          path: "session",
          method: "get",
        },
      },
      pages: {
        login: "/login",
      },
      token: {
        signInResponseTokenPointer: "/data/access_token",
        maxAgeInSeconds: 60 * 60 * 24,
        httpOnlyCookieAttribute: false,
      },
      session: {
        dataType: {
          id: 'string',
          email: 'string',
          name: 'string',
        },
      },
    },
    globalAppMiddleware: true,
  },

  runtimeConfig: {
    appKey: process.env.APP_KEY,
    // Admin credentials for direct login
    adminEmail: process.env.ADMIN_EMAIL || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    // JWT secret for SSO and admin token signing
    jwtSecret: process.env.JWT_SECRET || '',
    public: {
      // Client-side base URL — should be relative so requests go through the preview proxy
      baseAPI: process.env.NUXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL,
      // MCP Server endpoint (shown in settings page)
      mcpHost: process.env.NUXT_PUBLIC_MCP_HOST || 'localhost:41244',
      // Public app URL used to build git webhook URLs (falls back to request host)
      appUrl: process.env.NUXT_PUBLIC_APP_URL || process.env.NUXT_APP_BASE_URL || '',
      // Active document generation agent (shown in UI)
      docAgent: process.env.DOC_AGENT || 'opencode',
      cursorModel: process.env.CURSOR_MODEL || 'auto',
    },
    // Server-only base URL — can be absolute (e.g. http://127.0.0.1:port/api/preview/taskId)
    // so server-side $fetch gets a valid URL instead of crashing on relative paths
    apiBaseUrl: process.env.API_BASE_URL,
    isPreview: process.env.ORBIT_PREVIEW === 'true',
    // Postrack API Docs integration (server-side only)
    postrackApiUrl: process.env.NITRO_POSTRACK_API_URL,
    postrackApiKey: process.env.NITRO_POSTRACK_API_KEY,
    // OpenAI integration (server-side only)
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    // MCP Server host (server-side, inferred from request if not set)
    mcpHost: process.env.MCP_HOST || process.env.NUXT_PUBLIC_MCP_HOST,
    // Opencode Agent Config (base64-encoded)
    opencodeConfigB64: process.env.OPENCODE_CONFIG_B64,
    // Document generation agent selection
    docAgent: process.env.DOC_AGENT || 'opencode',
    cursorModel: process.env.CURSOR_MODEL || 'auto',
  },

  compatibilityDate: "2025-01-31",

  nitro: {
    preset: process.env.NITRO_PRESET || "node-server",
    routeRules: {
      "/p/**": {
        headers: {
          "X-Frame-Options": "SAMEORIGIN",
        },
      },
    },
    externals: {
      external: [
        "@libsql/darwin-arm64",
        "@libsql/linux-x64-gnu",
        "@libsql/linux-x64-musl",
        "@img/sharp-libvips-darwin-arm64",
        "@img/sharp-darwin-arm64",
        "@img/sharp-linux-x64",
        "@img/sharp-libvips-linux-x64",
        "sharp",
      ],
    },
    minify: true,
    sourceMap: false,
  },

  vite: {
    resolve: {
      alias: {
        // Mermaid's mindmap diagram imports cytoscape UMD, which only exposes a
        // "require" export condition — Vite 7 cannot resolve it during build.
        "cytoscape/dist/cytoscape.umd.js": "cytoscape/dist/cytoscape.esm.mjs",
      },
    },
    server: {
      hmr: {
        protocol: "ws",
      },
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
  },
});
