import { createOpencodeServer } from "@opencode-ai/sdk/server";
import { createOpencodeClient } from "@opencode-ai/sdk";
import { useRuntimeConfig } from "#imports";
import type { Config } from "@opencode-ai/sdk";
import * as net from "net";

// We use the async + SSE event pattern so:
//  - The HTTP request that submits the prompt returns quickly (no 5/10 min
//    blocking request that can be killed by undici / proxy timeouts).
//  - Each streamed event resets any body timers, so the run can be
//    arbitrarily long as long as the agent is making progress.
// Because of this, we no longer need a custom undici Agent with extended
// timeouts. We rely on globalThis.fetch (Node.js built-in undici).
const TEN_MINUTES_MS = 600_000;

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
    timeout: TEN_MINUTES_MS,
  });
  console.log(`[OpencodeAgent] Opencode server started at: ${server.url}`);

  const client = createOpencodeClient({
    baseUrl: server.url,
    directory: workdir,
  });
  return { client, close: () => { server.close(); } };
}

/** Determine whether an error is retryable (network / connect-level only). */
function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Connection-level issues — worth retrying because the SDK request never
  // reached the Opencode server.
  if (
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up") ||
    msg.includes("connect timeout") ||
    msg.includes("network")
  ) {
    return true;
  }
  // Header/body timeouts mean the LLM itself is slow — retrying just burns
  // tokens and fails the same way. Treat as non-retryable.
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { retries = 2, baseDelayMs = 5_000, label = "operation" } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryableError(err)) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[OpencodeAgent] ${label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms…`
      );
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastErr;
}

/** Turn a tool invocation into a short human-readable activity line. */
function formatToolActivity(tool: string, input: Record<string, unknown>): string {
  const get = (k: string) => {
    const v = input?.[k];
    return typeof v === "string" ? v : undefined;
  };
  const truncate = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);

  if (tool === "bash") {
    const cmd = get("command");
    if (cmd) return `Running: ${truncate(cmd.split("\n")[0], 140)}`;
  }
  if (tool === "read") {
    const path = get("path") ?? get("filePath");
    if (path) return `Reading ${path}`;
  }
  if (tool === "write" || tool === "edit") {
    const path = get("path") ?? get("filePath");
    if (path) return `${tool === "write" ? "Writing" : "Editing"} ${path}`;
  }
  if (tool === "glob") {
    const pattern = get("pattern") ?? get("glob_pattern");
    if (pattern) return `Searching files: ${pattern}`;
  }
  if (tool === "grep") {
    const pattern = get("pattern");
    if (pattern) return `Grepping: ${pattern}`;
  }
  if (tool === "list" || tool === "ls") {
    const path = get("path");
    if (path) return `Listing ${path}`;
  }
  if (tool === "webfetch") {
    const url = get("url");
    if (url) return `Fetching ${url}`;
  }
  return `Tool: ${tool}`;
}

export interface AnalyzeOptions {
  /** Working directory for the Opencode session (cloned repo path). */
  workdir?: string;
  /** Abort the analyze early (forwarded to Opencode's session.abort). */
  signal?: AbortSignal;
  /**
   * Called whenever a chunk of assistant text arrives. `accumulated` is the
   * full concatenated text so far across all text parts.
   */
  onText?: (delta: string, accumulated: string) => void;
  /**
   * Called when the agent's activity changes (running a tool, reading a file,
   * thinking, etc.). Useful to drive a live status line in the UI.
   */
  onActivity?: (activity: string) => void;
  /** Called when the agent reports updated token usage (per step). */
  onTokens?: (tokens: { input: number; output: number }) => void;
}

interface PartLike {
  id?: string;
  type?: string;
  text?: string;
  sessionID?: string;
  tool?: string;
  state?: {
    status?: string;
    input?: Record<string, unknown>;
    title?: string;
    error?: string;
  };
  tokens?: { input: number; output: number };
}

interface EventLike {
  type?: string;
  properties?: {
    part?: PartLike;
    delta?: string;
    sessionID?: string;
    info?: { id?: string };
    error?: { message?: string; name?: string };
  };
}

interface GlobalEventLike {
  directory?: string;
  payload?: EventLike;
}

export function createOpencodeAgent() {
  const cfg = getConfig();

  return {
    /**
     * Run the Opencode agent against a prompt and return the assistant's final
     * text. Uses the async + SSE event pattern so:
     *  - The HTTP request that submits the prompt returns quickly (no 5/10 min
     *    blocking request that can be killed by undici / proxy timeouts).
     *  - Each streamed event resets undici's body timer, so the run can be
     *    arbitrarily long as long as the agent is making progress.
     *  - Callers can react to live progress (text deltas, tool calls, tokens).
     *  - Callers can cancel mid-run via AbortSignal.
     */
    async analyze(prompt: string, options: AnalyzeOptions = {}): Promise<string> {
      const { workdir, signal, onText, onActivity, onTokens } = options;

      return await withRetry(
        async () => {
          const { client, close } = await resolveClient(cfg, workdir);

          // Track text per part-id so concatenation order matches the parts as
          // they appear in the final message (parts can interleave with tool
          // calls). Map preserves insertion order.
          const textByPartId = new Map<string, string>();
          const partOrder: string[] = [];
          let sessionId: string | null = null;
          let lastEmittedAccum = "";

          const abortHandlers: Array<() => void> = [];
          const cleanup = async () => {
            for (const fn of abortHandlers.splice(0)) {
              try { fn(); } catch { /* noop */ }
            }
            if (sessionId) {
              try {
                await client.session.delete({ path: { id: sessionId } });
              } catch { /* non-fatal */ }
            }
            close();
          };

          try {
            // 1. Create the session.
            const sessionResult = await client.session.create({});
            const session =
              (sessionResult as { data?: { id?: string } }).data ?? sessionResult;
            sessionId = (session as { id?: string })?.id ?? null;
            if (!sessionId) throw new Error("Failed to create Opencode session");
            console.log("[OpencodeAgent] Session created:", sessionId);

            // 2. Subscribe to the global event stream BEFORE sending the prompt
            //    so we don't miss early events.
            const sseAbort = new AbortController();
            abortHandlers.push(() => sseAbort.abort());
            const sse = await client.global.event({
              signal: sseAbort.signal,
            } as Parameters<typeof client.global.event>[0]);

            const accumulate = (): string => {
              let acc = "";
              for (const id of partOrder) acc += textByPartId.get(id) ?? "";
              return acc;
            };

            // 3. Set up the idle / error promise driven by SSE events.
            let resolveIdle: (() => void) | undefined;
            let rejectIdle: ((err: Error) => void) | undefined;
            const donePromise = new Promise<void>((resolve, reject) => {
              resolveIdle = resolve;
              rejectIdle = reject;
            });

            // 4. Pump the SSE stream in the background.
            const streamPromise = (async () => {
              try {
                for await (const raw of sse.stream as AsyncGenerator<unknown>) {
                  if (signal?.aborted) {
                    rejectIdle?.(new Error("Generation cancelled"));
                    return;
                  }
                  const globalEvent = raw as GlobalEventLike;
                  const payload = globalEvent?.payload;
                  if (!payload) continue;
                  const props = payload.properties;

                  // Some payload shapes carry the sessionID at the top level;
                  // others embed it on the part. Filter to our own session
                  // when we can identify it.
                  const partSession = props?.part?.sessionID;
                  const propsSession = props?.sessionID;
                  const eventSession = partSession ?? propsSession;
                  if (eventSession && eventSession !== sessionId) continue;

                  switch (payload.type) {
                    case "message.part.updated": {
                      const part = props?.part;
                      if (!part?.id) break;

                      if (!textByPartId.has(part.id) && (part.type === "text" || part.type === "tool")) {
                        partOrder.push(part.id);
                        if (part.type === "text") textByPartId.set(part.id, "");
                      }

                      if (part.type === "text" && typeof part.text === "string") {
                        const prev = textByPartId.get(part.id) ?? "";
                        const next = part.text;
                        if (next !== prev) {
                          textByPartId.set(part.id, next);
                          const accumulated = accumulate();
                          const delta =
                            props?.delta ??
                            (accumulated.length > lastEmittedAccum.length
                              ? accumulated.slice(lastEmittedAccum.length)
                              : "");
                          lastEmittedAccum = accumulated;
                          if (delta) onText?.(delta, accumulated);
                        }
                      } else if (part.type === "tool" && part.tool && part.state) {
                        const status = part.state.status;
                        if (status === "running" || status === "pending") {
                          onActivity?.(formatToolActivity(part.tool, part.state.input ?? {}));
                        } else if (status === "completed") {
                          onActivity?.(`Done: ${part.state.title ?? part.tool}`);
                        } else if (status === "error") {
                          onActivity?.(
                            `Tool failed (${part.tool}): ${part.state.error ?? "unknown error"}`
                          );
                        }
                      } else if (part.type === "step-finish" && part.tokens) {
                        onTokens?.({
                          input: part.tokens.input,
                          output: part.tokens.output,
                        });
                      } else if (part.type === "reasoning" && part.text) {
                        const line = part.text.split("\n")[0];
                        if (line) onActivity?.(`Thinking: ${line.slice(0, 140)}`);
                      }
                      break;
                    }
                    case "session.error": {
                      const err = props?.error;
                      const msg = err?.message ?? err?.name ?? "Opencode agent error";
                      rejectIdle?.(new Error(`Agent error: ${msg}`));
                      return;
                    }
                    case "session.idle": {
                      resolveIdle?.();
                      return;
                    }
                  }
                }
              } catch (err) {
                if (!signal?.aborted) {
                  rejectIdle?.(err instanceof Error ? err : new Error(String(err)));
                }
              }
            })();
            // Prevent "unhandled promise rejection" if donePromise resolves first.
            streamPromise.catch(() => { /* swallowed */ });

            // 5. Wire up the abort signal — abort the Opencode session AND the
            //    SSE stream so the run stops promptly.
            const onAbort = () => {
              try {
                if (sessionId) {
                  client.session.abort({ path: { id: sessionId } }).catch(() => {});
                }
              } finally {
                sseAbort.abort();
                rejectIdle?.(new Error("Generation cancelled"));
              }
            };
            if (signal) {
              if (signal.aborted) {
                onAbort();
              } else {
                signal.addEventListener("abort", onAbort, { once: true });
                abortHandlers.push(() => signal.removeEventListener("abort", onAbort));
              }
            }

            // 6. Submit the prompt asynchronously — server starts working
            //    immediately and the HTTP request returns once accepted.
            await client.session.promptAsync({
              path: { id: sessionId },
              body: { parts: [{ type: "text", text: prompt }] },
            });

            // 7. Wait for either session.idle, a session error, or abort.
            await donePromise;

            // 8. Fetch the canonical final message text. We prefer this over
            //    the streamed accumulation because parts can be reordered or
            //    truncated by the server when the run finishes.
            let finalText = accumulate();
            try {
              const messagesResult = await client.session.messages({
                path: { id: sessionId },
              });
              const messages =
                (messagesResult as { data?: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }> }).data ??
                (messagesResult as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>);
              if (Array.isArray(messages)) {
                const lastAssistant = [...messages]
                  .reverse()
                  .find((m) => m?.info?.role === "assistant");
                if (lastAssistant?.parts) {
                  const text = lastAssistant.parts
                    .filter((p) => p.type === "text" && typeof p.text === "string")
                    .map((p) => p.text as string)
                    .join("");
                  if (text.length >= finalText.length) {
                    finalText = text;
                  }
                }
              }
            } catch { /* fall back to streamed accumulation */ }

            console.log(
              `[OpencodeAgent] Analysis complete, length=${finalText.length}, parts=${partOrder.length}`
            );

            return finalText;
          } finally {
            await cleanup();
          }
        },
        { retries: 2, baseDelayMs: 5_000, label: "analyze" }
      );
    },
  };
}

export type OpencodeAgent = ReturnType<typeof createOpencodeAgent>;
