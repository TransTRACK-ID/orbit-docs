import { spawn } from "child_process";
import { getCursorModel as getCursorModelFromEnv } from "~/server/utils/agent-config";
import { getChatWorkspace } from "~/server/lib/chat-workspace";

export interface AnalyzeOptions {
  workdir?: string;
  signal?: AbortSignal;
  onText?: (delta: string, accumulated: string) => void;
  onActivity?: (activity: string) => void;
  onTokens?: (tokens: { input: number; output: number }) => void;
  onDebugEvent?: (event: { type: string; payload: Record<string, unknown> }) => void;
}

export type CursorExecutionMode = "agent" | "ask";

export interface CursorAgentOptions {
  model?: string;
  /** agent = full tool access (doc generation). ask = read-only Q&A (chat). */
  mode?: CursorExecutionMode;
  /** Chat-optimized: isolated workspace, end on result, parse assistant stream events. */
  chat?: boolean;
}

let cursorInstalledCache: boolean | null = null;

interface CursorEvent {
  type: string;
  subtype?: string;
  chatId?: string;
  session_id?: string;
  delta?: string;
  result?: string;
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
  error?: string;
  message?: string | {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
}

function getCursorPath(): string {
  return process.env.CURSOR_AGENT_PATH || "cursor-agent";
}

function getCursorModel(): string {
  return getCursorModelFromEnv();
}

export async function isCursorInstalled(): Promise<boolean> {
  if (cursorInstalledCache !== null) return cursorInstalledCache;

  const installed = await new Promise<boolean>((resolve) => {
    const proc = spawn(getCursorPath(), ["--version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("exit", (code) => resolve(code === 0));
  });

  cursorInstalledCache = installed;
  return installed;
}

export async function isCursorAuthenticated(): Promise<{ ok: boolean; method: "login" | "api_key" | "none"; error?: string }> {
  // Check for API key first (headless / production-friendly)
  if (process.env.CURSOR_API_KEY) {
    return { ok: true, method: "api_key" };
  }

  const installed = await isCursorInstalled();
  if (!installed) {
    return { ok: false, method: "none", error: "cursor-agent is not installed" };
  }

  return new Promise((resolve) => {
    const proc = spawn(getCursorPath(), ["whoami"], { stdio: "pipe" });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("exit", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve({ ok: true, method: "login" });
      } else {
        const err = stderr.trim() || stdout.trim() || "Not authenticated";
        resolve({ ok: false, method: "none", error: err });
      }
    });

    proc.on("error", () => {
      resolve({ ok: false, method: "none", error: "Failed to run cursor-agent whoami" });
    });
  });
}

export function createCursorAgent(opts: CursorAgentOptions = {}) {
  const model = opts.model || getCursorModel();
  const mode = opts.mode || "agent";
  const isChat = opts.chat === true;

  return {
    async analyze(prompt: string, options: AnalyzeOptions = {}): Promise<string> {
      const { workdir, signal, onText, onActivity, onTokens, onDebugEvent } = options;

      // Verify cursor-agent is available
      const installed = await isCursorInstalled();
      if (!installed) {
        throw new Error(
          "cursor-agent is not installed on this server. " +
          "Install it with: npm install -g cursor-agent, " +
          "then authenticate with: cursor-agent login (or set CURSOR_API_KEY env var)."
        );
      }

      const effectiveWorkdir = workdir || (isChat ? getChatWorkspace() : undefined);

      const args = [
        "--print",
        "--output-format", "stream-json",
        "--stream-partial-output",
        "--trust",
      ];

      if (mode === "ask") {
        args.push("--mode", "ask");
      } else {
        args.push("--force", "--approve-mcps");
      }

      if (model && model !== "auto") {
        args.push("--model", model);
      }

      if (effectiveWorkdir) {
        args.push("--workspace", effectiveWorkdir);
      }

      // Pass the prompt on stdin — large SDD prompts (diff + existing doc) exceed
      // Linux ARG_MAX (~128 KiB) and cause spawn E2BIG when passed as argv.
      return new Promise((resolve, reject) => {
        let accumulated = "";
        let chatId: string | undefined;
        let settled = false;

        const proc = spawn(getCursorPath(), args, {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: effectiveWorkdir || process.cwd(),
          env: { ...process.env },
        });

        onDebugEvent?.({
          type: "cursor.spawn",
          payload: { args, promptBytes: Buffer.byteLength(prompt, "utf-8"), pid: proc.pid },
        });

        proc.stdin.on("error", (err) => {
          if (!settled) {
            settled = true;
            reject(new Error(`Cursor agent stdin error: ${err.message}`));
          }
        });
        proc.stdin.write(prompt, "utf-8", (err) => {
          if (err && !settled) {
            settled = true;
            reject(new Error(`Cursor agent failed to write prompt: ${err.message}`));
            return;
          }
          proc.stdin.end();
        });

        const stderrBuf: string[] = [];

        let buffer = "";
        let exitCode: number | null = null;
        let stdoutEnded = false;

        const finishEarly = (finalText?: string) => {
          if (settled) return;
          settled = true;
          if (finalText !== undefined) {
            accumulated = finalText;
          }
          try {
            proc.kill("SIGTERM");
          } catch {
            /* noop */
          }
          resolve(accumulated);
        };

        function appendAssistantText(text: string) {
          if (!text) return;
          accumulated += text;
          onText?.(text, accumulated);
        }

        function processEvent(ev: CursorEvent) {
          onDebugEvent?.({ type: `cursor.${ev.type}`, payload: ev as Record<string, unknown> });

          // Cursor 2026 stream-json: incremental assistant tokens
          if (ev.type === "assistant" && ev.message && typeof ev.message === "object") {
            const parts = ev.message.content;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part?.type === "text" && typeof part.text === "string") {
                  appendAssistantText(part.text);
                }
              }
            }
          }

          // Legacy / alternate shapes
          if (typeof ev.result === "string" && ev.result && ev.type !== "result") {
            if (ev.result.length > accumulated.length) {
              appendAssistantText(ev.result.slice(accumulated.length));
            } else if (!accumulated) {
              appendAssistantText(ev.result);
            }
          }
          if (typeof ev.delta === "string" && ev.delta) {
            appendAssistantText(ev.delta);
          }
          if (typeof ev.message === "string" && ev.message) {
            appendAssistantText(ev.message);
          }

          switch (ev.type) {
            case "start": {
              chatId = ev.chatId || ev.session_id;
              if (chatId) {
                onDebugEvent?.({
                  type: "cursor.start",
                  payload: { chatId },
                });
                onDebugEvent?.({
                  type: "session.created",
                  payload: { sessionId: chatId },
                });
              }
              break;
            }
            case "content": {
              break;
            }
            case "result": {
              if (ev.subtype === "success" && typeof ev.result === "string") {
                if (ev.result.length > accumulated.length) {
                  appendAssistantText(ev.result.slice(accumulated.length));
                }
                if (isChat) {
                  finishEarly(ev.result);
                }
              }
              break;
            }
            case "tool_use": {
              const toolName = ev.tool || "tool";
              const toolArgs = ev.args || {};
              const argSummary = Object.entries(toolArgs)
                .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
                .join(", ");
              onActivity?.(`Tool: ${toolName}(${argSummary})`);
              break;
            }
            case "error": {
              const msg =
                (typeof ev.message === "string" ? ev.message : undefined) ||
                ev.error ||
                "Cursor agent error";
              onDebugEvent?.({ type: "cursor.error", payload: { message: msg } });
              break;
            }
            default: {
              onDebugEvent?.({
                type: "cursor.unhandled",
                payload: { type: ev.type, subtype: ev.subtype, keys: Object.keys(ev) },
              });
            }
          }
        }

        function flushBuffer() {
          if (!buffer.trim()) return;
          const lines = buffer.split("\n");
          buffer = "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const ev = JSON.parse(line) as CursorEvent;
              processEvent(ev);
            } catch {
              // Not JSON, treat as plain text delta
              onDebugEvent?.({ type: "cursor.raw", payload: { line } });
              accumulated += line + "\n";
              onText?.(line + "\n", accumulated);
            }
          }
        }

        proc.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const ev = JSON.parse(line) as CursorEvent;
              processEvent(ev);
            } catch {
              // Not JSON, treat as plain text delta
              onDebugEvent?.({ type: "cursor.raw", payload: { line } });
              accumulated += line + "\n";
              onText?.(line + "\n", accumulated);
            }
          }
        });

        proc.stdout.on("end", () => {
          stdoutEnded = true;
          flushBuffer();
          checkDone();
        });

        proc.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf-8");
          stderrBuf.push(text);
          onDebugEvent?.({ type: "cursor.stderr", payload: { text } });
        });

        proc.on("error", (err) => {
          reject(new Error(`Cursor agent failed to start: ${err.message}`));
        });

        proc.on("exit", (code) => {
          exitCode = code;
          checkDone();
        });

        function checkDone() {
          if (settled) return;
          if (exitCode === null || !stdoutEnded) return;

          if (signal?.aborted) {
            settled = true;
            reject(new Error("Generation cancelled"));
            return;
          }
          if (exitCode !== 0) {
            settled = true;
            const stderr = stderrBuf.join("").trim();
            const hint = stderr.includes("auth")
              ? " (Hint: run 'cursor-agent login' to authenticate)"
              : "";
            reject(new Error(`Cursor agent exited with code ${exitCode}${hint}. ${stderr.slice(0, 500)}`));
          } else {
            settled = true;
            resolve(accumulated);
          }
        }

        if (signal) {
          const onAbort = () => {
            proc.kill("SIGTERM");
            setTimeout(() => {
              if (!proc.killed) proc.kill("SIGKILL");
            }, 5000);
          };
          if (signal.aborted) {
            onAbort();
          } else {
            signal.addEventListener("abort", onAbort, { once: true });
          }
        }
      });
    },
  };
}

export type CursorAgent = ReturnType<typeof createCursorAgent>;
