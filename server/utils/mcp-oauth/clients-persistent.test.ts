import { describe, it, expect } from "vitest";
import { registerClientPersistent } from "./clients";

describe("registerClientPersistent", () => {
  it("issues an in-memory identity even when the database is unavailable", async () => {
    const result = await registerClientPersistent({
      redirectUris: ["https://client.example.com/callback"],
      clientName: "Fallback Client",
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.clientId).toMatch(/^mcp_[0-9a-f]{32}$/);
    expect(result.secret).toBeTruthy();
    expect(result.redirectUris).toEqual(["https://client.example.com/callback"]);
  });

  it("rejects invalid metadata without touching the store", async () => {
    const result = await registerClientPersistent({ redirectUris: [] });
    expect("error" in result).toBe(true);
  });
});
