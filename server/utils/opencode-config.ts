import { useRuntimeConfig } from "#imports";

/**
 * Opencode config must be read from process.env at request time.
 * Nuxt only overrides runtimeConfig from NUXT_* vars, and Docker images are
 * built without OPENCODE_CONFIG_B64 — so useRuntimeConfig().opencodeConfigB64
 * is often undefined in production even when OPENCODE_CONFIG_B64 is set on the host.
 */
export function getOpencodeConfigB64(): string {
  const config = useRuntimeConfig();

  return (
    process.env.NUXT_OPENCODE_CONFIG_B64 ||
    process.env.OPENCODE_CONFIG_B64 ||
    (config.opencodeConfigB64 as string) ||
    ""
  );
}
