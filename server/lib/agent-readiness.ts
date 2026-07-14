import { createError } from "h3";
import { getDocAgent } from "~/server/utils/agent-config";
import { isCursorAuthenticated, isCursorInstalled } from "~/server/lib/cursor-agent";
import { getOpencodeConfigB64 } from "~/server/utils/opencode-config";

/**
 * Fail fast when the configured DOC_AGENT backend cannot run.
 * Used by doc generation jobs and /api/chat.
 */
export async function assertDocAgentReady(): Promise<void> {
  const agent = getDocAgent();

  if (agent === "cursor") {
    const installed = await isCursorInstalled();
    if (!installed) {
      throw createError({
        statusCode: 503,
        statusMessage: "Service Unavailable",
        message:
          "Doc generation agent is not available (cursor-agent is not installed). " +
          "Install cursor-agent or set DOC_AGENT=opencode.",
      });
    }

    const auth = await isCursorAuthenticated();
    if (!auth.ok) {
      throw createError({
        statusCode: 503,
        statusMessage: "Service Unavailable",
        message:
          auth.error ||
          "AI agent is not configured. Set CURSOR_API_KEY or run cursor-agent login.",
      });
    }
    return;
  }

  if (!getOpencodeConfigB64()) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message:
        "Doc generation agent is not configured (OPENCODE_CONFIG_B64 is missing). " +
        "Set OPENCODE_CONFIG_B64 or switch to DOC_AGENT=cursor with CURSOR_API_KEY.",
    });
  }
}
