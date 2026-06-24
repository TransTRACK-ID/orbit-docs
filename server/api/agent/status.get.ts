import { defineEventHandler } from "h3";
import { isCursorInstalled, isCursorAuthenticated } from "~/server/lib/cursor-agent";
import { getDocAgent, getCursorModel } from "~/server/utils/agent-config";
import { getOpencodeConfigB64 } from "~/server/utils/opencode-config";

export default defineEventHandler(async () => {
  const agent = getDocAgent();

  if (agent === "opencode") {
    return {
      agent: "opencode",
      ok: true,
      message: "Using OpenCode agent",
      config: {
        opencodeConfigB64: !!getOpencodeConfigB64(),
      },
    };
  }

  const installed = await isCursorInstalled();
  const auth = await isCursorAuthenticated();

  return {
    agent: "cursor",
    ok: installed && auth.ok,
    installed,
    authenticated: auth.ok,
    authMethod: auth.method,
    message: auth.ok
      ? `Cursor agent ready (${auth.method === "api_key" ? "API key" : "Login session"})`
      : auth.error || "Cursor agent not ready",
    instructions: installed
      ? auth.ok
        ? undefined
        : "Authenticate with: cursor-agent login (or set CURSOR_API_KEY env var)"
      : "Install cursor-agent: npm install -g cursor-agent",
    config: {
      model: getCursorModel(),
      hasApiKey: !!process.env.CURSOR_API_KEY,
    },
  };
});
