export type ChatBackend = "auto" | "openrouter" | "cursor";

/**
 * Chat backend selection. Doc generation always uses DOC_AGENT; chat can use a
 * faster OpenRouter/OpenAI stream when OPENAI_API_KEY is configured.
 */
export function resolveChatBackend(): "openrouter" | "cursor" {
  const raw = (process.env.CHAT_BACKEND || "auto").toLowerCase();

  if (raw === "cursor") return "cursor";
  if (raw === "openrouter") return "openrouter";

  // auto — prefer low-latency streaming API when configured
  if (process.env.OPENAI_API_KEY?.trim()) return "openrouter";
  return "cursor";
}
