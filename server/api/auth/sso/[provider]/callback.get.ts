import jwt from 'jsonwebtoken';
import type { SsoConfig, SsoProvider, KeycloakProvider, AzureProvider, GenericOIDCProvider } from '~/types/sso';
import { DEFAULT_OAUTH_ENDPOINTS, getAzureEndpoints, getKeycloakEndpoints } from '~/types/sso';
import { getDb } from '~/server/database';
import { settings } from '~/server/database/schema';
import { eq } from 'drizzle-orm';
import { ensureTeamMember } from '~/server/utils/team-access';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  login?: string; // GitHub
  avatar_url?: string; // GitHub
}

export default defineEventHandler(async (event) => {
  const providerType = getRouterParam(event, 'provider');
  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string;
  const error = query.error as string;
  const errorDescription = query.error_description as string;

  console.log(`[SSO Callback] Provider: ${providerType}, Code: ${code ? 'present' : 'missing'}, State: ${state ? 'present' : 'missing'}, Error: ${error || 'none'}`);

  if (error) {
    console.error(`[SSO Callback] Error from provider: ${errorDescription || error}`);
    throw createError({
      statusCode: 400,
      statusMessage: errorDescription || error
    });
  }

  if (!code || !state) {
    console.error(`[SSO Callback] Missing code or state`);
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing authorization code or state'
    });
  }

  // Get session data from cookie
  const stateCookie = getCookie(event, 'sso_oauth_state');
  console.log(`[SSO Callback] State cookie: ${stateCookie ? 'present' : 'missing'}`);
  
  if (!stateCookie) {
    console.error(`[SSO Callback] OAuth state cookie missing`);
    throw createError({
      statusCode: 400,
      statusMessage: 'OAuth state expired. Please try logging in again.'
    });
  }

  let sessionData: any;
  try {
    sessionData = JSON.parse(stateCookie);
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid OAuth state'
    });
  }

  if (state !== sessionData.state) {
    console.error(`[SSO Callback] State mismatch. Expected: ${sessionData.state}, Got: ${state}`);
    throw createError({
      statusCode: 400,
      statusMessage: 'State mismatch - potential CSRF attack'
    });
  }

  console.log(`[SSO Callback] State validation successful`);

  deleteCookie(event, 'sso_oauth_state');

  const db = getDb();
  // Get provider configuration from database
  const setting = (await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'sso_config'))
    .limit(1))[0];
  
  // Parse SSO config, handling both string and object formats
  let rawConfig = setting?.value;
  if (typeof rawConfig === 'string') {
    rawConfig = JSON.parse(rawConfig);
  }
  const config: SsoConfig = (rawConfig as SsoConfig) || { providers: [], allowMultipleProviders: true };
  
  if (!config.providers || config.providers.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: 'SSO configuration not found'
    });
  }

  const provider = config.providers.find((p: SsoProvider) => p.id === sessionData.providerId);
  
  if (!provider || !provider.enabled) {
    throw createError({
      statusCode: 400,
      statusMessage: 'SSO provider is not enabled'
    });
  }

  // Get token endpoint
  let tokenUrl: string;
  let userInfoUrl: string | undefined;

  switch (provider.type) {
    case 'keycloak': {
      const keycloakProvider = provider as KeycloakProvider;
      const endpoints = getKeycloakEndpoints(keycloakProvider.baseUrl, keycloakProvider.realm);
      tokenUrl = endpoints.tokenUrl;
      userInfoUrl = endpoints.userInfoUrl;
      break;
    }
    case 'azure': {
      const azureProvider = provider as AzureProvider;
      const endpoints = getAzureEndpoints(azureProvider.tenantId);
      tokenUrl = endpoints.tokenUrl;
      userInfoUrl = endpoints.userInfoUrl;
      break;
    }
    case 'google':
    case 'github': {
      const endpoints = DEFAULT_OAUTH_ENDPOINTS[provider.type];
      tokenUrl = endpoints.tokenUrl;
      userInfoUrl = endpoints.userInfoUrl;
      break;
    }
    case 'oidc': {
      const oidcProvider = provider as GenericOIDCProvider;
      tokenUrl = oidcProvider.tokenUrl;
      userInfoUrl = oidcProvider.userInfoUrl;
      break;
    }
    default:
      throw createError({
        statusCode: 400,
        statusMessage: 'Unsupported provider type'
      });
  }

  // Exchange code for tokens
  const tokenBody: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: sessionData.callbackUrl,
    client_id: provider.clientId,
    code_verifier: sessionData.codeVerifier
  };

  if (provider.clientSecret) {
    tokenBody.client_secret = provider.clientSecret;
  }

  let tokenResponse: TokenResponse;
  try {
    const tokenFetchResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(tokenBody).toString()
    });

    tokenResponse = await tokenFetchResponse.json();

    if (tokenResponse.error) {
      throw createError({
        statusCode: 400,
        statusMessage: tokenResponse.error_description || tokenResponse.error
      });
    }
  } catch (fetchError: any) {
    if (fetchError.statusCode) throw fetchError;
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to exchange authorization code for tokens'
    });
  }

  // Fetch user info
  let userInfo: UserInfo | null = null;
  if (userInfoUrl && tokenResponse.access_token) {
    try {
      const userInfoResponse = await fetch(userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${tokenResponse.access_token}`,
          'Accept': 'application/json'
        }
      });

      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json();
      }
    } catch {
      console.warn('Failed to fetch user info from provider');
    }
  }

  // Normalize user info based on provider
  const normalizedUserInfo = normalizeUserInfo(userInfo, provider.type);

  // Create JWT
  const runtimeConfig = useRuntimeConfig();
  const jwtSecret = runtimeConfig.jwtSecret as string;
  const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days

  if (!jwtSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'JWT secret not configured'
    });
  }

  const jwtPayload = {
    email: normalizedUserInfo.email,
    name: normalizedUserInfo.name,
    sub: normalizedUserInfo.sub,
    authMethod: provider.type,
    providerId: provider.id,
    providerName: provider.name
  };

  const token = jwt.sign(jwtPayload, jwtSecret, {
    expiresIn: AUTH_SESSION_MAX_AGE_SECONDS
  });

  // Set cookies
  setCookie(event, 'session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    path: '/'
  });

  setCookie(event, 'auth.token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    path: '/'
  });

  const userInfoCookie = Buffer.from(JSON.stringify(normalizedUserInfo)).toString('base64');
  setCookie(event, 'user_info', userInfoCookie, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    path: '/'
  });

  // Auto-provision the user as workspace admin if they don't have a member record
  try {
    if (normalizedUserInfo.email) {
      await ensureTeamMember({
        id: normalizedUserInfo.sub,
        email: normalizedUserInfo.email,
        name: normalizedUserInfo.name,
      });
    }
  } catch (e) {
    console.error('Failed to auto-provision team member on SSO login:', e);
  }

  // Get redirect URL from session data
  let redirectUrl = sessionData.redirectUrl || '/';
  
  console.log(`[SSO Callback] Authentication successful, redirecting to ${redirectUrl}`);
  return sendRedirect(event, redirectUrl);
});

function normalizeUserInfo(userInfo: UserInfo | null, providerType: string): {
  sub: string;
  email: string;
  name: string;
  username: string;
  givenName: string;
  familyName: string;
  picture: string;
  idToken: string;
} {
  if (!userInfo) {
    return {
      sub: 'unknown',
      email: '',
      name: '',
      username: '',
      givenName: '',
      familyName: '',
      picture: '',
      idToken: ''
    };
  }

  // GitHub uses different field names
  if (providerType === 'github') {
    return {
      sub: userInfo.sub || String(userInfo.login || ''),
      email: userInfo.email || '',
      name: userInfo.name || userInfo.login || '',
      username: userInfo.login || '',
      givenName: '',
      familyName: '',
      picture: userInfo.avatar_url || '',
      idToken: ''
    };
  }

  return {
    sub: userInfo.sub || 'unknown',
    email: userInfo.email || '',
    name: userInfo.name || userInfo.preferred_username || '',
    username: userInfo.preferred_username || '',
    givenName: userInfo.given_name || '',
    familyName: userInfo.family_name || '',
    picture: userInfo.picture || '',
    idToken: ''
  };
}
