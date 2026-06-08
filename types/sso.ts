/**
 * SSO Provider Types
 */

export type SsoProviderType = 'keycloak' | 'google' | 'github' | 'azure' | 'oidc';

export interface BaseSsoProvider {
  id: string;
  type: SsoProviderType;
  name: string;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  callbackUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeycloakProvider extends BaseSsoProvider {
  type: 'keycloak';
  realm: string;
  baseUrl: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  logoutUrl: string;
}

export interface GoogleProvider extends BaseSsoProvider {
  type: 'google';
  // Google uses standard OAuth2 endpoints
}

export interface GithubProvider extends BaseSsoProvider {
  type: 'github';
  // GitHub uses standard OAuth2 endpoints
}

export interface AzureProvider extends BaseSsoProvider {
  type: 'azure';
  tenantId: string;
}

export interface GenericOIDCProvider extends BaseSsoProvider {
  type: 'oidc';
  issuerUrl: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  logoutUrl?: string;
}

export type SsoProvider = KeycloakProvider | GoogleProvider | GithubProvider | AzureProvider | GenericOIDCProvider;

export interface SsoConfig {
  providers: SsoProvider[];
  defaultProvider?: string;
  allowMultipleProviders: boolean;
}

// Provider metadata for UI
export interface SsoProviderMetadata {
  type: SsoProviderType;
  name: string;
  description: string;
  icon: string;
  color: string;
  fields: SsoProviderField[];
}

export interface SsoProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
}

// Provider metadata configuration
export const SSO_PROVIDER_METADATA: Record<SsoProviderType, SsoProviderMetadata> = {
  keycloak: {
    type: 'keycloak',
    name: 'Keycloak',
    description: 'Open Source Identity and Access Management',
    icon: 'keycloak',
    color: '#005786',
    fields: [
      { key: 'name', label: 'Display Name', type: 'text', required: true, placeholder: 'My Keycloak', helpText: 'Name shown on the login button' },
      { key: 'realm', label: 'Realm', type: 'text', required: true, placeholder: 'my-realm', helpText: 'The Keycloak realm containing your application' },
      { key: 'baseUrl', label: 'Base URL', type: 'url', required: true, placeholder: 'https://keycloak.example.com', helpText: 'Base URL of your Keycloak server' },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'my-app', helpText: 'The OAuth 2.0 client ID registered in Keycloak' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: false, placeholder: '••••••••', helpText: 'The client secret (leave empty for public clients)' },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: false, placeholder: 'Auto-generated', helpText: 'Must be registered as a valid redirect URI in Keycloak' }
    ]
  },
  google: {
    type: 'google',
    name: 'Google',
    description: 'Sign in with Google accounts',
    icon: 'google',
    color: '#4285F4',
    fields: [
      { key: 'name', label: 'Display Name', type: 'text', required: true, placeholder: 'Google', helpText: 'Name shown on the login button' },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'your-client-id.apps.googleusercontent.com', helpText: 'Google OAuth 2.0 Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: '••••••••', helpText: 'Google OAuth 2.0 Client Secret' },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: false, placeholder: 'Auto-generated', helpText: 'Must be added to authorized redirect URIs in Google Console' }
    ]
  },
  github: {
    type: 'github',
    name: 'GitHub',
    description: 'Sign in with GitHub accounts',
    icon: 'github',
    color: '#333333',
    fields: [
      { key: 'name', label: 'Display Name', type: 'text', required: true, placeholder: 'GitHub', helpText: 'Name shown on the login button' },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Iv1.xxxxxxxxxx', helpText: 'GitHub OAuth App Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: '••••••••', helpText: 'GitHub OAuth App Client Secret' },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: false, placeholder: 'Auto-generated', helpText: 'Must match the Authorization callback URL in GitHub App settings' }
    ]
  },
  azure: {
    type: 'azure',
    name: 'Microsoft Azure AD',
    description: 'Sign in with Microsoft work or school accounts',
    icon: 'azure',
    color: '#0078D4',
    fields: [
      { key: 'name', label: 'Display Name', type: 'text', required: true, placeholder: 'Microsoft', helpText: 'Name shown on the login button' },
      { key: 'tenantId', label: 'Tenant ID', type: 'text', required: true, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', helpText: 'Azure AD Tenant ID' },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', helpText: 'Azure AD Application (client) ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: '••••••••', helpText: 'Azure AD Client Secret' },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: false, placeholder: 'Auto-generated', helpText: 'Must be added to redirect URIs in Azure AD' }
    ]
  },
  oidc: {
    type: 'oidc',
    name: 'Generic OIDC',
    description: 'Any OpenID Connect compatible provider',
    icon: 'oidc',
    color: '#6366F1',
    fields: [
      { key: 'name', label: 'Display Name', type: 'text', required: true, placeholder: 'My OIDC Provider', helpText: 'Name shown on the login button' },
      { key: 'issuerUrl', label: 'Issuer URL', type: 'url', required: true, placeholder: 'https://auth.example.com', helpText: 'The OIDC issuer URL' },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'my-client-id', helpText: 'The OAuth 2.0 client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: false, placeholder: '••••••••', helpText: 'The client secret (if required)' },
      { key: 'authUrl', label: 'Authorization URL', type: 'url', required: true, placeholder: 'https://auth.example.com/oauth/authorize', helpText: 'The authorization endpoint URL' },
      { key: 'tokenUrl', label: 'Token URL', type: 'url', required: true, placeholder: 'https://auth.example.com/oauth/token', helpText: 'The token endpoint URL' },
      { key: 'userInfoUrl', label: 'UserInfo URL', type: 'url', required: true, placeholder: 'https://auth.example.com/oauth/userinfo', helpText: 'The userinfo endpoint URL' },
      { key: 'logoutUrl', label: 'Logout URL', type: 'url', required: false, placeholder: 'https://auth.example.com/oauth/logout', helpText: 'The logout endpoint URL (optional)' },
      { key: 'callbackUrl', label: 'Callback URL', type: 'url', required: false, placeholder: 'Auto-generated', helpText: 'Must be registered as a valid redirect URI' }
    ]
  }
};

// Default OAuth endpoints for known providers
export const DEFAULT_OAUTH_ENDPOINTS: Record<string, { authUrl: string; tokenUrl: string; userInfoUrl: string; logoutUrl?: string; scopes: string[] }> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile']
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email']
  }
};

// Helper to generate Azure endpoints from tenant ID
export function getAzureEndpoints(tenantId: string) {
  return {
    authUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    logoutUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`,
    scopes: ['openid', 'email', 'profile', 'User.Read']
  };
}

// Helper to generate Keycloak endpoints
export function getKeycloakEndpoints(baseUrl: string, realm: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return {
    authUrl: `${normalizedBase}/realms/${realm}/protocol/openid-connect/auth`,
    tokenUrl: `${normalizedBase}/realms/${realm}/protocol/openid-connect/token`,
    userInfoUrl: `${normalizedBase}/realms/${realm}/protocol/openid-connect/userinfo`,
    logoutUrl: `${normalizedBase}/realms/${realm}/protocol/openid-connect/logout`,
    scopes: ['openid', 'email', 'profile']
  };
}
