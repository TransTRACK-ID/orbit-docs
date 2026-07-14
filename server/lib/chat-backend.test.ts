import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("resolveChatBackend", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CHAT_BACKEND;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prefers openrouter when OPENAI_API_KEY is set (auto)", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { resolveChatBackend } = await import("~/server/lib/chat-backend");
    expect(resolveChatBackend()).toBe("openrouter");
  });

  it("falls back to cursor when no OPENAI_API_KEY (auto)", async () => {
    const { resolveChatBackend } = await import("~/server/lib/chat-backend");
    expect(resolveChatBackend()).toBe("cursor");
  });

  it("forces cursor when CHAT_BACKEND=cursor", async () => {
    process.env.CHAT_BACKEND = "cursor";
    process.env.OPENAI_API_KEY = "sk-test";
    const { resolveChatBackend } = await import("~/server/lib/chat-backend");
    expect(resolveChatBackend()).toBe("cursor");
  });
});
