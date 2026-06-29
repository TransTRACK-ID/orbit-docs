import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/server/utils/runtime-env", () => ({
  getAppKey: () => "test-app-key-32-chars-long!!!!!",
}));

import { encryptSecret, decryptSecret, maskSecret } from "~/server/utils/secret-crypto";

describe("secret-crypto", () => {
  it("round-trips encryption", () => {
    const plain = "ntn_secret_abc123";
    const encrypted = encryptSecret(plain);
    expect(encrypted).not.toBe(plain);
    expect(decryptSecret(encrypted)).toBe(plain);
  });

  it("masks secrets for display", () => {
    expect(maskSecret("abcdefghijklmnop")).toMatch(/^abcd/);
    expect(maskSecret("")).toBe("");
  });
});
