import { spawn } from "child_process";
import { getCursorModel as getCursorModelFromEnv } from "~/server/utils/agent-config";

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
}

let cursorInstalledCache: boolean | null = null;

interface CursorEvent {
  type: string;
  chatId?: string;
  delta?: string;
  result?: string;
  tool?: string;
  args?: Record<string, unknown>;
  error?: string;
  message?: string;
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

      if (workdir) {
        args.push("--workspace", workdir);
      }

      args.push(prompt);

      return new Promise((resolve, reject) => {
        let accumulated = "";
        let chatId: string | undefined;
        const proc = spawn(getCursorPath(), args, {
          stdio: ["ignore", "pipe", "pipe"],
          cwd: workdir || process.cwd(),
          env: { ...process.env },
        });

        onDebugEvent?.({ type: "cursor.spawn", payload: { args, pid: proc.pid } });

        const stderrBuf: string[] = [];

        let buffer = "";
        let exitCode: number | null = null;
        let stdoutEnded = false;

        function processEvent(ev: CursorEvent) {
          onDebugEvent?.({ type: `cursor.${ev.type}`, payload: ev as Record<string, unknown> });

          // Always check for content fields regardless of event type
          if (typeof ev.result === "string" && ev.result) {
            accumulated = ev.result;
            onText?.("", accumulated);
          }
          if (typeof ev.delta === "string" && ev.delta) {
            accumulated += ev.delta;
            onText?.(ev.delta, accumulated);
          }
          if (typeof ev.message === "string" && ev.message) {
            accumulated += ev.message;
            onText?.(ev.message, accumulated);
          }

          switch (ev.type) {
            case "start": {
              chatId = ev.chatId;
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
              // delta handled above
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
            case "end":
            case "complete":
            case "finished": {
              // Final result may be in ev.result (handled above)
              break;
            }
            case "error": {
              const msg = ev.message || ev.error || "Cursor agent error";
              onDebugEvent?.({ type: "cursor.error", payload: { message: msg } });
              break;
            }
            default: {
              // Unknown event type — content fields already handled above
              onDebugEvent?.({ type: "cursor.unhandled", payload: { type: ev.type, keys: Object.keys(ev) } });
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
          if (exitCode === null || !stdoutEnded) return;

          if (signal?.aborted) {
            reject(new Error("Generation cancelled"));
            return;
          }
          if (exitCode !== 0) {
            const stderr = stderrBuf.join("").trim();
            const hint = stderr.includes("auth")
              ? " (Hint: run 'cursor-agent login' to authenticate)"
              : "";
            reject(new Error(`Cursor agent exited with code ${exitCode}${hint}. ${stderr.slice(0, 500)}`));
          } else {
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
