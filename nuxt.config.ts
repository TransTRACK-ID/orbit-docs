// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  devtools: {
    enabled: process.env.NODE_ENV === 'development',

    timeline: {
      enabled: true,
    },
  },

  app: {
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
    baseURL: process.env.NUXT_APP_BASE_URL
      ? `${process.env.NUXT_APP_BASE_URL}api/auth`
      : '/api/auth',
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
        navigateUnauthenticatedTo: "/login",
      },
      token: {
        signInResponseTokenPointer: "/data/access_token",
        maxAgeInSeconds: 60 * 60 * 24,
      },
    },
    globalAppMiddleware: true,
  },

  runtimeConfig: {
    appKey: process.env.APP_KEY,
    public: {
      // Client-side base URL — should be relative so requests go through the preview proxy
      baseAPI: process.env.NUXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL,
    },
    // Server-only base URL — can be absolute (e.g. http://127.0.0.1:port/api/preview/taskId)
    // so server-side $fetch gets a valid URL instead of crashing on relative paths
    apiBaseUrl: process.env.API_BASE_URL,
    isPreview: process.env.ORBIT_PREVIEW === 'true',
    // Postrack API Docs integration (server-side only)
    postrackApiUrl: process.env.NITRO_POSTRACK_API_URL,
    postrackApiKey: process.env.NITRO_POSTRACK_API_KEY,
    // Mastra AI integration (server-side only)
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    vectorDbUrl: process.env.VECTOR_DB_URL || 'file:./vector.db',
  },

  compatibilityDate: "2025-01-31",

  nitro: {
    routeRules: {
      "/p/**": {
        headers: {
          "X-Frame-Options": "SAMEORIGIN",
        },
      },
    },
    externals: {
      external: [
        "@mastra/core",
        "@mastra/rag",
        "@mastra/libsql",
        "@mastra/ai-sdk",
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
