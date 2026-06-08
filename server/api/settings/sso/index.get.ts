import type { SsoConfig, SsoProvider } from '~/types/sso';
import { getDb } from '~/server/database';
import { settings } from '~/server/database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const db = getDb();
    const setting = (await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'sso_config'))
      .limit(1))[0];
    
    let ssoConfig: SsoConfig;
    if (setting?.value) {
      const parsedValue = typeof setting.value === 'string' 
        ? JSON.parse(setting.value) 
        : setting.value;
      ssoConfig = parsedValue as SsoConfig;
    } else {
      ssoConfig = { providers: [], allowMultipleProviders: true };
    }
    
    if (!ssoConfig.providers) {
      ssoConfig.providers = [];
    }
    
    return {
      success: true,
      config: ssoConfig
    };
  } catch (error) {
    console.error('Error fetching SSO config:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch SSO configuration'
    });
  }
});
