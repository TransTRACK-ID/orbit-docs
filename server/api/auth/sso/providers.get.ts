import type { SsoProvider } from "~/types/sso";
import {
  getSsoConfig,
  hasEnabledSsoProviders,
  isPasswordAuthDisabled,
} from "~/server/utils/sso-config";

export default defineEventHandler(async () => {
  try {
    const ssoConfig = await getSsoConfig();

    const enabledProviders = ssoConfig.providers
      .filter((provider: SsoProvider) => provider && provider.enabled === true)
      .map((provider: SsoProvider) => ({
        id: provider.id,
        type: provider.type,
        name: provider.name,
        callbackUrlHint: withBaseURL(`/api/auth/sso/${provider.type}/callback`),
      }));

    return {
      providers: enabledProviders,
      allowMultipleProviders: ssoConfig.allowMultipleProviders ?? true,
      defaultProvider: ssoConfig.defaultProvider,
      disablePasswordAuth: isPasswordAuthDisabled(ssoConfig),
      hasEnabledProviders: hasEnabledSsoProviders(ssoConfig),
    };
  } catch (error: any) {
    const pgError = error?.cause || error;
    const pgCode = pgError?.code;
    if (pgCode !== "42P01" && pgCode !== "42501") {
      console.error("Error fetching SSO providers:", error);
    }

    return {
      providers: [],
      allowMultipleProviders: true,
      defaultProvider: undefined,
      disablePasswordAuth: false,
      hasEnabledProviders: false,
    };
  }
});
