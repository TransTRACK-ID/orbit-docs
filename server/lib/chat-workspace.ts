import { mkdtempSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const DEFAULT_CHAT_WORKSPACE = join(tmpdir(), "orbit-chat-ws");

/** Isolated empty workspace so chat does not explore the orbit-docs repo. */
export function getChatWorkspace(): string {
  const configured = process.env.CHAT_WORKSPACE_DIR;
  const dir = configured || DEFAULT_CHAT_WORKSPACE;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Optional one-off temp dir per request (unused by default — prefer stable empty dir). */
export function createEphemeralChatWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "orbit-chat-"));
}
