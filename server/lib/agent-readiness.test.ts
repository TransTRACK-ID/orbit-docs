import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/server/lib/cursor-agent", () => ({
  isCursorInstalled: vi.fn(),
  isCursorAuthenticated: vi.fn(),
}));

vi.mock("~/server/utils/opencode-config", () => ({
  getOpencodeConfigB64: vi.fn(),
}));

vi.mock("~/server/utils/agent-config", () => ({
  getDocAgent: vi.fn(),
}));

import { assertDocAgentReady } from "~/server/lib/agent-readiness";
import { isCursorInstalled, isCursorAuthenticated } from "~/server/lib/cursor-agent";
import { getOpencodeConfigB64 } from "~/server/utils/opencode-config";
import { getDocAgent } from "~/server/utils/agent-config";

describe("assertDocAgentReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when cursor agent is installed and authenticated", async () => {
    vi.mocked(getDocAgent).mockReturnValue("cursor");
    vi.mocked(isCursorInstalled).mockResolvedValue(true);
    vi.mocked(isCursorAuthenticated).mockResolvedValue({ ok: true, method: "api_key" });

    await expect(assertDocAgentReady()).resolves.toBeUndefined();
  });

  it("throws 503 when cursor agent is not installed", async () => {
    vi.mocked(getDocAgent).mockReturnValue("cursor");
    vi.mocked(isCursorInstalled).mockResolvedValue(false);

    await expect(assertDocAgentReady()).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("cursor-agent is not installed"),
    });
  });

  it("throws 503 when cursor agent is not authenticated", async () => {
    vi.mocked(getDocAgent).mockReturnValue("cursor");
    vi.mocked(isCursorInstalled).mockResolvedValue(true);
    vi.mocked(isCursorAuthenticated).mockResolvedValue({
      ok: false,
      method: "none",
      error: "Not authenticated",
    });

    await expect(assertDocAgentReady()).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("Not authenticated"),
    });
  });

  it("throws 503 when opencode config is missing", async () => {
    vi.mocked(getDocAgent).mockReturnValue("opencode");
    vi.mocked(getOpencodeConfigB64).mockReturnValue(undefined);

    await expect(assertDocAgentReady()).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("OPENCODE_CONFIG_B64"),
    });
  });

  it("passes when opencode config is present", async () => {
    vi.mocked(getDocAgent).mockReturnValue("opencode");
    vi.mocked(getOpencodeConfigB64).mockReturnValue("e30=");

    await expect(assertDocAgentReady()).resolves.toBeUndefined();
  });
});
