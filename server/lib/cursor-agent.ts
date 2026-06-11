import { spawn } from "child_process";
import { useRuntimeConfig } from "#imports";

export interface AnalyzeOptions {
  workdir?: string;
  signal?: AbortSignal;
  onText?: (delta: string, accumulated: string) => void;
  onActivity?: (activity: string) => void;
  onTokens?: (tokens: { input: number; output: number }) => void;
  onDebugEvent?: (event: { type: string; payload: Record<string, unknown> }) => void;
}

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
  const config = useRuntimeConfig();
  return (config.cursorModel as string) || "auto";
}

export async function isCursorInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(getCursorPath(), ["--version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("exit", (code) => resolve(code === 0));
  });
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

export function createCursorAgent(opts: { model?: string } = {}) {
  const model = opts.model || getCursorModel();

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
        "-p",
        "--force",
        "--approve-mcps",
        "--output-format", "stream-json",
        "--stream-partial-output",
      ];

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

        const stdoutRL = proc.stdout;
        const stderrBuf: string[] = [];

        let buffer = "";
        stdoutRL.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const ev = JSON.parse(line) as CursorEvent;
              onDebugEvent?.({ type: `cursor.${ev.type}`, payload: ev as Record<string, unknown> });

              switch (ev.type) {
                case "start": {
                  chatId = ev.chatId;
                  break;
                }
                case "content": {
                  if (typeof ev.delta === "string") {
                    accumulated += ev.delta;
                    onText?.(ev.delta, accumulated);
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
                case "end": {
                  // Stream finished naturally
                  break;
                }
                case "error": {
                  const msg = ev.message || ev.error || "Cursor agent error";
                  onDebugEvent?.({ type: "cursor.error", payload: { message: msg } });
                  break;
                }
              }
            } catch {
              // Not JSON, treat as plain text delta
              onDebugEvent?.({ type: "cursor.raw", payload: { line } });
              if (line.trim()) {
                accumulated += line + "\n";
                onText?.(line + "\n", accumulated);
              }
            }
          }
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
          if (signal?.aborted) {
            reject(new Error("Generation cancelled"));
            return;
          }
          if (code !== 0) {
            const stderr = stderrBuf.join("").trim();
            const hint = stderr.includes("auth")
              ? " (Hint: run 'cursor-agent login' to authenticate)"
              : "";
            reject(new Error(`Cursor agent exited with code ${code}${hint}. ${stderr.slice(0, 500)}`));
          } else {
            resolve(accumulated);
          }
        });

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
