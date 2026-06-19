import type { SsoConfig, SsoProvider } from '~/types/sso';
import { getDb } from '~/server/database';
import { settings } from '~/server/database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const db = getDb();
    // Get SSO config from database
    const setting = (await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'sso_config'))
      .limit(1))[0];
    
    // Default empty config if none exists
    let ssoConfig: SsoConfig;
    if (setting?.value) {
      // Handle case where value might be stored as JSON string
      const parsedValue = typeof setting.value === 'string' 
        ? JSON.parse(setting.value) 
        : setting.value;
      ssoConfig = parsedValue as SsoConfig;
    } else {
      ssoConfig = { 
        providers: [], 
        allowMultipleProviders: true 
      };
    }
    
    // Ensure providers array exists
    if (!ssoConfig.providers) {
      ssoConfig.providers = [];
    }
    
    // Only return enabled providers with minimal info needed for login UI
    const enabledProviders = ssoConfig.providers
      .filter((p: SsoProvider) => p && p.enabled === true)
      .map((p: SsoProvider) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        // Include callback URL hint for configuration
        callbackUrlHint: withBaseURL(`/api/auth/sso/${p.type}/callback`)
      }));

    return {
      providers: enabledProviders,
      allowMultipleProviders: ssoConfig.allowMultipleProviders ?? true,
      defaultProvider: ssoConfig.defaultProvider
    };
  } catch (error: any) {
    // Missing table (42P01) or missing permissions (42501) simply mean SSO
    // hasn't been set up yet. The UI already falls back to hiding SSO buttons,
    // so don't spam production logs for an expected state.
    const pgError = error?.cause || error;
    const pgCode = pgError?.code;
    if (pgCode !== '42P01' && pgCode !== '42501') {
      console.error('Error fetching SSO providers:', error);
    }

    // Return empty config on error
    return {
      providers: [],
      allowMultipleProviders: true,
      defaultProvider: undefined
    };
  }
});
