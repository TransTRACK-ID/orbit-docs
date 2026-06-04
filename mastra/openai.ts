import { createOpenAI } from "@ai-sdk/openai";

export const customOpenAI = createOpenAI({
  baseURL: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
  compatibility: "compatible",
});
