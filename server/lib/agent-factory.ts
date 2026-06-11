import { useRuntimeConfig } from "#imports";
import { createOpencodeAgent } from "./opencode-agent";
import { createCursorAgent } from "./cursor-agent";
import type { AnalyzeOptions } from "./opencode-agent";

export type AgentType = "opencode" | "cursor";

export interface Agent {
  analyze(prompt: string, options: AnalyzeOptions): Promise<string>;
}

export interface AgentConfig {
  type: AgentType;
  model?: string;
}

export function getAgentConfig(): AgentConfig {
  const config = useRuntimeConfig();
  const type = (config.docAgent as string) || "opencode";
  if (type !== "opencode" && type !== "cursor") {
    console.warn(`[AgentFactory] Unknown DOC_AGENT "${type}", falling back to opencode`);
    return { type: "opencode" };
  }
  return {
    type,
    model: type === "cursor" ? (config.cursorModel as string | undefined) : undefined,
  };
}

export function createAgent(opts: { model?: string } = {}) {
  const cfg = getAgentConfig();
  const effectiveModel = opts.model || cfg.model;

  if (cfg.type === "cursor") {
    return createCursorAgent({ model: effectiveModel });
  }

  return createOpencodeAgent();
}

export { createOpencodeAgent, createCursorAgent };
