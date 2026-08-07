import { describe, expect, it } from "vitest";
import { isRedirectUriAllowed } from "~/server/utils/mcp-oauth/clients";

describe("isRedirectUriAllowed", () => {
  it("allows Gemini Spark googleusercontent redirect URIs for CIMD clients", async () => {
    const allowed = await isRedirectUriAllowed(
      "https://accountlinking.google.com/clientidmetadata/example",
      "https://oauth-redirect.googleusercontent.com/r/some-callback-id",
    );
    expect(allowed).toBe(true);
  });
});
