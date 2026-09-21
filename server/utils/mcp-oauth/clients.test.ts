import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isRedirectUriAllowed,
  registerClient,
  validateClientCredentials,
  validateStaticClientCredentials,
} from "./clients";

describe("isRedirectUriAllowed", () => {
  beforeEach(() => {
    process.env.MCP_OAUTH_CLIENT_ID = "test-client-id";
    process.env.MCP_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.MCP_OAUTH_REDIRECT_URIS =
      "https://example.com/callback,https://example.org/callback";
  });

  afterEach(() => {
    delete process.env.MCP_OAUTH_CLIENT_ID;
    delete process.env.MCP_OAUTH_CLIENT_SECRET;
    delete process.env.MCP_OAUTH_REDIRECT_URIS;
  });

  it("allows configured redirect URIs", async () => {
    expect(
      await isRedirectUriAllowed("test-client-id", "https://example.com/callback"),
    ).toBe(true);
    expect(
      await isRedirectUriAllowed("test-client-id", "https://example.org/callback"),
    ).toBe(true);
  });

  it("rejects unconfigured redirect URIs for static client IDs", async () => {
    expect(
      await isRedirectUriAllowed("test-client-id", "https://evil.com/callback"),
    ).toBe(false);
  });

  it("allows Google-hosted redirect URIs for static client IDs", async () => {
    expect(
      await isRedirectUriAllowed(
        "test-client-id",
        "https://oauth-redirect.googleusercontent.com/r/some-callback-id",
      ),
    ).toBe(true);
  });

  it("allows Gemini Spark googleusercontent redirect URIs for CIMD client IDs", async () => {
    const allowed = await isRedirectUriAllowed(
      "https://accountlinking.google.com/clientidmetadata/example",
      "https://oauth-redirect.googleusercontent.com/r/some-callback-id",
    );
    expect(allowed).toBe(true);
  });

  it("rejects non-Google redirect URIs for unknown CIMD client IDs", async () => {
    const allowed = await isRedirectUriAllowed(
      "https://accountlinking.google.com/clientidmetadata/nonexistent-client",
      "https://evil.com/callback",
    );
    expect(allowed).toBe(false);
  });
});

describe("validateStaticClientCredentials", () => {
  beforeEach(() => {
    process.env.MCP_OAUTH_CLIENT_ID = "test-client-id";
    process.env.MCP_OAUTH_CLIENT_SECRET = "test-client-secret";
  });

  afterEach(() => {
    delete process.env.MCP_OAUTH_CLIENT_ID;
    delete process.env.MCP_OAUTH_CLIENT_SECRET;
  });

  it("accepts matching client ID and secret", () => {
    expect(validateStaticClientCredentials("test-client-id", "test-client-secret")).toBe(true);
  });

  it("rejects wrong client secret", () => {
    expect(validateStaticClientCredentials("test-client-id", "wrong-secret")).toBe(false);
  });

  it("rejects wrong client ID", () => {
    expect(validateStaticClientCredentials("wrong-id", "test-client-secret")).toBe(false);
  });

  it("rejects undefined values", () => {
    expect(validateStaticClientCredentials(undefined, "test-client-secret")).toBe(false);
    expect(validateStaticClientCredentials("test-client-id", undefined)).toBe(false);
  });
});

describe("registerClient", () => {
  it("issues a client id and secret for confidential clients", () => {
    const client = registerClient({
      redirectUris: ["https://client.example.com/callback"],
      clientName: "Test Client",
    });
    expect("error" in client).toBe(false);
    if ("error" in client) return;
    expect(client.clientId).toMatch(/^mcp_[0-9a-f]{32}$/);
    expect(client.clientSecret).toBeTruthy();
    expect(client.redirectUris).toEqual(["https://client.example.com/callback"]);
  });

  it("issues no secret for public clients (token_endpoint_auth_method none)", () => {
    const client = registerClient({
      redirectUris: ["https://client.example.com/callback"],
      tokenEndpointAuthMethod: "none",
    });
    expect("error" in client).toBe(false);
    if ("error" in client) return;
    expect(client.clientSecret).toBeUndefined();
  });

  it("rejects empty or invalid redirect URIs", () => {
    expect("error" in registerClient({ redirectUris: [] })).toBe(true);
    expect(
      "error" in registerClient({ redirectUris: ["http://evil.com/cb"] }),
    ).toBe(true);
    expect(
      "error" in registerClient({ redirectUris: ["javascript:alert(1)"] }),
    ).toBe(true);
  });

  it("allows http loopback redirect URIs", () => {
    const client = registerClient({
      redirectUris: ["http://localhost:8080/callback"],
    });
    expect("error" in client).toBe(false);
  });
});

describe("validateClientCredentials", () => {
  beforeEach(() => {
    process.env.MCP_OAUTH_CLIENT_ID = "test-client-id";
    process.env.MCP_OAUTH_CLIENT_SECRET = "test-client-secret";
  });

  afterEach(() => {
    delete process.env.MCP_OAUTH_CLIENT_ID;
    delete process.env.MCP_OAUTH_CLIENT_SECRET;
  });

  it("accepts the static client with its secret", () => {
    expect(validateClientCredentials("test-client-id", "test-client-secret")).toBe(true);
    expect(validateClientCredentials("test-client-id", "wrong")).toBe(false);
  });

  it("accepts registered confidential clients only with their secret", () => {
    const client = registerClient({
      redirectUris: ["https://client.example.com/cb"],
    });
    if ("error" in client) throw new Error(client.error);
    expect(validateClientCredentials(client.clientId, client.clientSecret)).toBe(true);
    expect(validateClientCredentials(client.clientId, "wrong")).toBe(false);
  });

  it("accepts registered public clients without a secret", () => {
    const client = registerClient({
      redirectUris: ["https://client.example.com/cb"],
      tokenEndpointAuthMethod: "none",
    });
    if ("error" in client) throw new Error(client.error);
    expect(validateClientCredentials(client.clientId, undefined)).toBe(true);
  });

  it("accepts CIMD URL client ids without a secret", () => {
    expect(
      validateClientCredentials("https://client.example.com/metadata.json", undefined),
    ).toBe(true);
  });

  it("rejects unknown client ids", () => {
    expect(validateClientCredentials("nope", undefined)).toBe(false);
  });
});

describe("isRedirectUriAllowed for registered clients", () => {
  it("allows registered redirect URIs", async () => {
    const client = registerClient({
      redirectUris: ["https://client.example.com/cb"],
      tokenEndpointAuthMethod: "none",
    });
    if ("error" in client) throw new Error(client.error);
    expect(await isRedirectUriAllowed(client.clientId, "https://client.example.com/cb")).toBe(true);
    expect(await isRedirectUriAllowed(client.clientId, "https://evil.com/cb")).toBe(false);
  });

  it("allows ephemeral loopback ports for public clients", async () => {
    const client = registerClient({
      redirectUris: ["http://localhost:1234/cb"],
      tokenEndpointAuthMethod: "none",
    });
    if ("error" in client) throw new Error(client.error);
    expect(await isRedirectUriAllowed(client.clientId, "http://127.0.0.1:9999/cb")).toBe(true);
  });

  it("does not allow arbitrary loopback for confidential clients", async () => {
    const client = registerClient({
      redirectUris: ["https://client.example.com/cb"],
    });
    if ("error" in client) throw new Error(client.error);
    expect(await isRedirectUriAllowed(client.clientId, "http://localhost:9999/cb")).toBe(false);
  });
});
