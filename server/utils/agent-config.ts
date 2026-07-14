import { useRuntimeConfig } from "#imports";

export type AgentType = "opencode" | "cursor";

/**
 * Agent selection must be read from process.env at request time.
 * Nuxt only overrides runtimeConfig from NUXT_* vars, and Docker images are
 * built without DOC_AGENT — so useRuntimeConfig().docAgent is often still
 * "opencode" in production even when DOC_AGENT=cursor is set on the host.
 */
export function getDocAgent(): AgentType {
  const config = useRuntimeConfig();
  const raw =
    process.env.NUXT_DOC_AGENT ||
    process.env.DOC_AGENT ||
    (config.docAgent as string) ||
    "cursor";

  if (raw === "cursor") return "cursor";
  if (raw === "opencode") return "opencode";

  console.warn(`[AgentConfig] Unknown DOC_AGENT "${raw}", falling back to cursor`);
  return "cursor";
}

export function getCursorModel(): string {
  const config = useRuntimeConfig();

  return (
    process.env.NUXT_CURSOR_MODEL ||
    process.env.CURSOR_MODEL ||
    (config.cursorModel as string) ||
    "auto"
  );
}
