import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { useRuntimeConfig } from "#imports";

interface ProviderConfig {
  options?: {
    baseURL?: string;
    apiKey?: string;
  };
  models?: Record<string, { name: string }>;
}

interface OpencodeConfig {
  provider?: Record<string, ProviderConfig>;
  model?: string;
  permission?: {
    edit?: string;
    bash?: string;
    read?: string;
  };
}

let _decodedConfig: OpencodeConfig | null = null;

function getConfig(): OpencodeConfig {
  if (_decodedConfig) return _decodedConfig;

  const config = useRuntimeConfig();
  const b64 = config.opencodeConfigB64 as string | undefined;

  if (!b64) {
    throw new Error("OPENCODE_CONFIG_B64 is not set in runtime config");
  }

  try {
    const json = Buffer.from(b64, "base64").toString("utf-8");
    _decodedConfig = JSON.parse(json) as OpencodeConfig;
    return _decodedConfig;
  } catch (e) {
    throw new Error(
      `Failed to decode OPENCODE_CONFIG_B64: ${e instanceof Error ? e.message : "Unknown error"}`
    );
  }
}

export function createOpencodeAgent() {
  const cfg = getConfig();
  const providers = cfg.provider || {};

  // Find the first provider with a valid apiKey
  let provider: ProviderConfig | undefined;
  let providerName = "default";
  for (const [name, p] of Object.entries(providers)) {
    if (p.options?.apiKey) {
      provider = p;
      providerName = name;
      break;
    }
  }

  const baseURL = provider?.options?.baseURL;
  const apiKey = provider?.options?.apiKey;
  const modelName = cfg.model || `${providerName}/accounts/fireworks/routers/kimi-k2p6-turbo`;

  if (!apiKey) {
    throw new Error("No provider API key found in decoded config. Make sure your config has a provider with an apiKey.");
  }

  // Debug: log the actual baseURL and model being used
  console.log("[OpencodeAgent] Using baseURL:", baseURL);
  console.log("[OpencodeAgent] Using model:", modelName);
  console.log("[OpencodeAgent] Provider name:", providerName);

  const openai = createOpenAI({
    baseURL: baseURL || "https://api.fireworks.ai/inference/v1",
    apiKey,
  });

  // Extract the actual model name from the provider/model format
  const actualModel = modelName.includes("/")
    ? modelName.split("/").slice(1).join("/")
    : modelName;

  return {
    async analyze(prompt: string): Promise<string> {
      const { text } = await generateText({
        model: openai(actualModel),
        system:
          "You are an expert software architect and technical analyst. You analyze codebases and generate detailed technical documentation. You have read access to the file system and bash access to run commands. You do NOT have write or edit permissions.",
        prompt,
        temperature: 0.2,
        maxTokens: 8000,
      });
      return text;
    },

    async analyzeStreaming(
      prompt: string,
      onChunk: (chunk: string) => void
    ): Promise<string> {
      const { text } = await generateText({
        model: openai(actualModel),
        system:
          "You are an expert software architect and technical analyst. You analyze codebases and generate detailed technical documentation. You have read access to the file system and bash access to run commands. You do NOT have write or edit permissions.",
        prompt,
        temperature: 0.2,
        maxTokens: 8000,
        onChunk: ({ chunk }) => {
          if (chunk.type === "text-delta") {
            onChunk(chunk.textDelta);
          }
        },
      });
      return text;
    },
  };
}

export type OpencodeAgent = ReturnType<typeof createOpencodeAgent>;
