import { defineEventHandler } from "h3";
import { useRuntimeConfig } from "#imports";
import { isCursorInstalled, isCursorAuthenticated } from "~/server/lib/cursor-agent";

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const agent = (config.docAgent as string) || "opencode";

  if (agent === "opencode") {
    return {
      agent: "opencode",
      ok: true,
      message: "Using OpenCode agent",
      config: {
        opencodeConfigB64: !!(config.opencodeConfigB64 as string),
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
      model: (config.cursorModel as string) || "auto",
      hasApiKey: !!process.env.CURSOR_API_KEY,
    },
  };
});
