// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  devtools: {
    enabled: true,

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
    "@nuxt/test-utils/module",
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
  },

  compatibilityDate: "2025-01-31",

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
