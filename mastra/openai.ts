import { createOpenAI } from "@ai-sdk/openai";

let openaiInstance: ReturnType<typeof createOpenAI> | null = null;

export function getCustomOpenAI() {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY || "";
    const baseURL = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
    
    if (!apiKey) {
      console.error("[OPENAI] OPENAI_API_KEY is not set!");
    }
    
    openaiInstance = createOpenAI({
      baseURL,
      apiKey,
      compatibility: "compatible",
    });
  }
  return openaiInstance;
}
