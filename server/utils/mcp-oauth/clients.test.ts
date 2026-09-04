import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isRedirectUriAllowed, validateStaticClientCredentials } from "./clients";

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
