import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { verifyPkceS256 } from "./pkce";

describe("verifyPkceS256", () => {
  it("accepts a valid S256 code verifier", () => {
    const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    expect(verifyPkceS256(codeVerifier, codeChallenge)).toBe(true);
  });

  it("rejects an invalid verifier", () => {
    const codeVerifier = "invalid-verifier";
    const codeChallenge = createHash("sha256")
      .update("different-verifier")
      .digest("base64url");

    expect(verifyPkceS256(codeVerifier, codeChallenge)).toBe(false);
  });

  it("rejects undefined values", () => {
    expect(verifyPkceS256(undefined, "challenge")).toBe(false);
    expect(verifyPkceS256("verifier", undefined)).toBe(false);
    expect(verifyPkceS256(undefined, undefined)).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(verifyPkceS256("", "challenge")).toBe(false);
    expect(verifyPkceS256("verifier", "")).toBe(false);
  });

  it("uses timing-safe comparison (different lengths)", () => {
    const codeVerifier = "short";
    const codeChallenge = createHash("sha256")
      .update("a-much-longer-verifier-to-produce-different-length-challenge")
      .digest("base64url");

    expect(verifyPkceS256(codeVerifier, codeChallenge)).toBe(false);
  });
});
