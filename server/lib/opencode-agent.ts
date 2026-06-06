import { createOpencodeServer } from "@opencode-ai/sdk/server";
import { createOpencodeClient } from "@opencode-ai/sdk";
import { useRuntimeConfig } from "#imports";
import type { Config } from "@opencode-ai/sdk";
import * as net from "net";

interface OpencodeConfig extends Config {
  provider?: Record<string, unknown>;
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

/** Find a free TCP port on localhost */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Could not determine free port"));
        }
      });
    });
  });
}


/**
 * Spawn an ephemeral Opencode server on a free port and return a connected client.
 *
 * We always spawn a new server instead of reusing an existing one because:
 *  - Kilocode/VS Code runs its own Opencode server on port 4096 with Basic auth,
 *    which we can't authenticate against.
 *  - A fresh server uses our own OPENCODE_CONFIG_B64 config (model, provider, permissions).
 *
 * Returns { client, close } — caller MUST call close() when done.
 */
async function resolveClient(
  cfg: OpencodeConfig,
  workdir?: string
): Promise<{ client: ReturnType<typeof createOpencodeClient>; close: () => void }> {
  const port = await getFreePort();
  console.log(`[OpencodeAgent] Spawning Opencode server on port ${port}...`);
  const server = await createOpencodeServer({
    port,
    config: cfg,
    timeout: 120000,
  });
  console.log(`[OpencodeAgent] Opencode server started at: ${server.url}`);

  const client = createOpencodeClient({
    baseUrl: server.url,
    directory: workdir,
  });
  return { client, close: () => { server.close(); } };
}

export function createOpencodeAgent() {
  const cfg = getConfig();

  return {
    /**
     * Analyze a codebase by sending a prompt to Opencode as a real agent.
     * Opencode explores the repo with its tools (read files, bash, etc.)
     * and returns the assistant's final text response.
     */
    async analyze(prompt: string, workdir?: string): Promise<string> {
      const { client, close } = await resolveClient(cfg, workdir);

      try {
        // Create a fresh session
        const sessionResult = await client.session.create({});
        const session =
          (sessionResult as { data: { id: string } }).data ?? sessionResult;

        if (!session?.id) {
          throw new Error("Failed to create Opencode session");
        }
        const sessionId = session.id;
        console.log("[OpencodeAgent] Session created:", sessionId);

        // Send the prompt and wait for the agent to finish
        // session.prompt() is a blocking call — returns after the agent completes its turn
        const promptResult = await client.session.prompt({
          path: { id: sessionId },
          body: {
            parts: [{ type: "text", text: prompt }],
          },
        });

        // Extract all text parts from the response
        const response =
          (promptResult as { data: { parts: Array<{ type: string; text?: string }> } }).data ??
          promptResult;

        let text = "";
        if (response?.parts && Array.isArray(response.parts)) {
          for (const part of response.parts) {
            if (part.type === "text" && part.text) {
              text += part.text;
            }
          }
        }

        if (!text) {
          const info = (response as { info?: { content?: string } })?.info;
          if (info?.content) text = info.content;
        }

        console.log(
          "[OpencodeAgent] Analysis complete, response length:",
          text.length
        );

        // Clean up the session to avoid leaking state
        try {
          await client.session.delete({ path: { id: sessionId } });
        } catch {
          // Non-fatal — session will expire on its own
        }

        return text;
      } finally {
        close();
      }
    },

    /**
     * Same as analyze() but calls onChunk for each text fragment as it arrives.
     * Uses SSE events from the global event stream to stream partial output.
     */
    async analyzeStreaming(
      prompt: string,
      onChunk: (chunk: string) => void,
      workdir?: string
    ): Promise<string> {
      const { client, close } = await resolveClient(cfg, workdir);

      try {
        // Create session
        const sessionResult = await client.session.create({});
        const session =
          (sessionResult as { data: { id: string } }).data ?? sessionResult;

        if (!session?.id) {
          throw new Error("Failed to create Opencode session");
        }
        const sessionId = session.id;
        console.log("[OpencodeAgent] Session created:", sessionId);

        const fullText: string[] = [];

        // Subscribe to global events to receive streaming text deltas
        const eventPromise = new Promise<void>((resolve) => {
          client.global.event().then((sse) => {
            sse.on(
              "message",
              (event: {
                data: {
                  payload?: {
                    type: string;
                    properties?: {
                      info?: { role?: string };
                      part?: { type: string; text?: string };
                      sessionID?: string;
                    };
                  };
                };
              }) => {
                const payload = event?.data?.payload;
                if (!payload) return;

                if (
                  payload.type === "message.part.updated" &&
                  payload.properties?.info?.role === "assistant"
                ) {
                  const part = payload.properties?.part;
                  if (part?.type === "text" && part.text) {
                    onChunk(part.text);
                    fullText.push(part.text);
                  }
                }

                if (
                  payload.type === "session.idle" &&
                  payload.properties?.sessionID === sessionId
                ) {
                  resolve();
                }
              }
            );
          });
        });

        // Send asynchronously so events fire while we listen
        await client.session.promptAsync({
          path: { id: sessionId },
          body: {
            parts: [{ type: "text", text: prompt }],
          },
        });

        // Wait for the session to go idle (agent finished) or timeout
        await Promise.race([
          eventPromise,
          new Promise<void>((_, reject) =>
            setTimeout(
              () => reject(new Error("Opencode agent timed out after 10 minutes")),
              600000
            )
          ),
        ]);

        const result = fullText.join("");
        console.log(
          "[OpencodeAgent] Streaming complete, total length:",
          result.length
        );

        try {
          await client.session.delete({ path: { id: sessionId } });
        } catch {
          // Non-fatal
        }

        return result;
      } finally {
        close();
      }
    },
  };
}

export type OpencodeAgent = ReturnType<typeof createOpencodeAgent>;
