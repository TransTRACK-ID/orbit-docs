import { createOpencodeAgent } from "./opencode-agent";
import { createCursorAgent } from "./cursor-agent";
import type { AnalyzeOptions } from "./opencode-agent";
import { getCursorModel, getDocAgent } from "~/server/utils/agent-config";
import type { AgentType } from "~/server/utils/agent-config";

export type { AgentType };

export interface Agent {
  analyze(prompt: string, options: AnalyzeOptions): Promise<string>;
}

export interface AgentConfig {
  type: AgentType;
  model?: string;
}

export function getAgentConfig(): AgentConfig {
  const type = getDocAgent();
  return {
    type,
    model: type === "cursor" ? getCursorModel() : undefined,
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
