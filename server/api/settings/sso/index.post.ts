import type { SsoConfig, SsoProvider } from '~/types/sso';
import { getDb } from '~/server/database';
import { settings } from '~/server/database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { provider } = body as { provider: SsoProvider };
    
    if (!provider || !provider.type || !provider.name || !provider.clientId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid provider data'
      });
    }
    
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
    
    // Check if a provider with this ID already exists
    const existingIndex = ssoConfig.providers.findIndex(p => p.id === provider.id);
    
    const now = new Date().toISOString();
    const newProvider: SsoProvider = {
      ...provider,
      createdAt: existingIndex >= 0 ? ssoConfig.providers[existingIndex].createdAt : now,
      updatedAt: now
    };
    
    if (existingIndex >= 0) {
      // Update existing
      ssoConfig.providers[existingIndex] = newProvider;
    } else {
      // Add new
      ssoConfig.providers.push(newProvider);
    }
    
    // Save back to database
    const configJson = JSON.stringify(ssoConfig);
    
    if (setting) {
      await db.update(settings)
        .set({ value: configJson, updatedAt: new Date() })
        .where(eq(settings.id, setting.id));
    } else {
      await db.insert(settings)
        .values({
          id: crypto.randomUUID(),
          key: 'sso_config',
          value: configJson
        });
    }
    
    return {
      success: true,
      provider: newProvider
    };
  } catch (error: any) {
    console.error('Error saving SSO provider:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save SSO provider'
    });
  }
});
