import { useRuntimeConfig } from "#imports";

/**
 * Read server configuration from process.env at request time.
 *
 * GitLab CI builds the Docker image without production secrets; AWX injects
 * `.env` at deploy time. Nuxt only auto-overrides runtimeConfig from NUXT_*
 * prefixed vars, so plain names like JWT_SECRET stay empty in
 * useRuntimeConfig() unless we read process.env directly.
 */
function envFirst(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return "";
}

function envOrConfig(
  configValue: string | undefined,
  ...keys: string[]
): string {
  return envFirst(...keys) || configValue || "";
}

export function getAppKey(): string {
  const config = useRuntimeConfig();
  return envOrConfig(config.appKey as string, "NUXT_APP_KEY", "APP_KEY");
}

export function getAdminEmail(): string {
  const config = useRuntimeConfig();
  return envOrConfig(
    config.adminEmail as string,
    "NUXT_ADMIN_EMAIL",
    "ADMIN_EMAIL"
  );
}

export function getAdminPassword(): string {
  const config = useRuntimeConfig();
  return envOrConfig(
    config.adminPassword as string,
    "NUXT_ADMIN_PASSWORD",
    "ADMIN_PASSWORD"
  );
}

export function getJwtSecret(): string {
  const config = useRuntimeConfig();
  return envOrConfig(config.jwtSecret as string, "NUXT_JWT_SECRET", "JWT_SECRET");
}

export function getApiBaseUrl(): string {
  const config = useRuntimeConfig();
  return envOrConfig(
    config.apiBaseUrl as string,
    "NUXT_API_BASE_URL",
    "API_BASE_URL"
  );
}

export function getPublicApiBaseUrl(): string {
  const config = useRuntimeConfig();
  return envOrConfig(
    config.public.baseAPI as string,
    "NUXT_PUBLIC_API_BASE_URL",
    "API_BASE_URL"
  );
}

export function resolveConfiguredApiBaseUrl(): string {
  return getApiBaseUrl() || getPublicApiBaseUrl();
}

export function getPublicAppUrl(): string {
  const config = useRuntimeConfig();
  return envOrConfig(
    config.public.appUrl as string,
    "NUXT_PUBLIC_APP_URL",
    "NUXT_APP_BASE_URL"
  );
}

export function getMcpHost(): string {
  const config = useRuntimeConfig();
  return envOrConfig(
    config.mcpHost as string,
    "NUXT_MCP_HOST",
    "MCP_HOST",
    "NUXT_PUBLIC_MCP_HOST"
  );
}

export function isRuntimePreviewMode(): boolean {
  if (
    process.env.ORBIT_PREVIEW === "true" ||
    process.env.NUXT_ORBIT_PREVIEW === "true"
  ) {
    return true;
  }

  const config = useRuntimeConfig();
  return config.isPreview === true || config.isPreview === "true";
}
