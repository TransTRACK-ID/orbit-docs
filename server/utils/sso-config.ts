import { eq } from "drizzle-orm";
import type { SsoConfig } from "~/types/sso";
import { getDb } from "~/server/database";
import { settings } from "~/server/database/schema";

const SSO_CONFIG_KEY = "sso_config";

export const DEFAULT_SSO_CONFIG: SsoConfig = {
  providers: [],
  allowMultipleProviders: true,
  disablePasswordAuth: false,
};

export function normalizeSsoConfig(raw: unknown): SsoConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SSO_CONFIG, providers: [] };
  }

  const parsed = raw as Partial<SsoConfig>;
  return {
    providers: Array.isArray(parsed.providers) ? parsed.providers : [],
    allowMultipleProviders: parsed.allowMultipleProviders ?? true,
    defaultProvider: parsed.defaultProvider,
    disablePasswordAuth: parsed.disablePasswordAuth ?? false,
  };
}

export async function getSsoConfig(): Promise<SsoConfig> {
  const db = getDb();
  const setting = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.key, SSO_CONFIG_KEY))
      .limit(1)
  )[0];

  if (!setting?.value) {
    return { ...DEFAULT_SSO_CONFIG, providers: [] };
  }

  const parsedValue =
    typeof setting.value === "string" ? JSON.parse(setting.value) : setting.value;

  return normalizeSsoConfig(parsedValue);
}

export async function saveSsoConfig(ssoConfig: SsoConfig): Promise<void> {
  const db = getDb();
  const setting = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.key, SSO_CONFIG_KEY))
      .limit(1)
  )[0];

  const configJson = JSON.stringify(ssoConfig);

  if (setting) {
    await db
      .update(settings)
      .set({ value: configJson, updatedAt: new Date() })
      .where(eq(settings.id, setting.id));
    return;
  }

  await db.insert(settings).values({
    id: crypto.randomUUID(),
    key: SSO_CONFIG_KEY,
    value: configJson,
  });
}

export function hasEnabledSsoProviders(config: SsoConfig): boolean {
  return (config.providers ?? []).some((provider) => provider?.enabled === true);
}

export function isPasswordAuthDisabled(config: SsoConfig): boolean {
  return Boolean(config.disablePasswordAuth) && hasEnabledSsoProviders(config);
}

export function ensurePasswordAuthAllowed(config: SsoConfig): void {
  if (isPasswordAuthDisabled(config)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Email and password sign-in is disabled. Please use SSO.",
    });
  }
}
