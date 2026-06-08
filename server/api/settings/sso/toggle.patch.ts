import type { SsoConfig } from '~/types/sso';
import { getDb } from '~/server/database';
import { settings } from '~/server/database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { providerId, enabled } = body as { providerId: string; enabled: boolean };
    
    if (!providerId || typeof enabled !== 'boolean') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Provider ID and enabled state are required'
      });
    }
    
    const db = getDb();
    const setting = (await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'sso_config'))
      .limit(1))[0];
    
    if (!setting?.value) {
      throw createError({
        statusCode: 404,
        statusMessage: 'SSO configuration not found'
      });
    }
    
    const parsedValue = typeof setting.value === 'string' 
      ? JSON.parse(setting.value) 
      : setting.value;
    const ssoConfig: SsoConfig = parsedValue;
    
    if (!ssoConfig.providers) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No providers configured'
      });
    }
    
    const provider = ssoConfig.providers.find(p => p.id === providerId);
    if (!provider) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Provider not found'
      });
    }
    
    provider.enabled = enabled;
    provider.updatedAt = new Date().toISOString();
    
    // Save back
    const configJson = JSON.stringify(ssoConfig);
    await db.update(settings)
      .set({ value: configJson, updatedAt: new Date() })
      .where(eq(settings.id, setting.id));
    
    return {
      success: true,
      provider
    };
  } catch (error: any) {
    console.error('Error toggling SSO provider:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to toggle SSO provider'
    });
  }
});
