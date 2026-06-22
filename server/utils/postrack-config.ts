import { useRuntimeConfig } from "#imports";

/**
 * Postrack URL/key must be read from process.env at request time.
 * Nuxt only overrides runtimeConfig from NUXT_* vars, and Docker images are
 * built without these values — so useRuntimeConfig().postrackApiUrl is often
 * undefined in production even when NITRO_POSTRACK_API_URL is set on the host.
 */
export function getPostrackConfig() {
  const config = useRuntimeConfig();

  return {
    apiUrl:
      process.env.NUXT_POSTRACK_API_URL ||
      process.env.NITRO_POSTRACK_API_URL ||
      config.postrackApiUrl ||
      "",
    apiKey:
      process.env.NUXT_POSTRACK_API_KEY ||
      process.env.NITRO_POSTRACK_API_KEY ||
      config.postrackApiKey ||
      "",
  };
}
