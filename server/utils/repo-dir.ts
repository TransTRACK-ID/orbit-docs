import { homedir, tmpdir } from "os";
import { join } from "path";

const DEFAULT_REPO_DIR = join(
  homedir(),
  ".local",
  "share",
  "orbit-docs-repositories"
);

/**
 * Writable directory for git clones during doc generation.
 *
 * Defaults to $HOME/.local/share/orbit-docs-repositories (owned by the
 * nodejs user in Docker). Avoids /tmp bind mounts that often arrive as
 * root:root from the host and cause EACCES for uid 1001.
 */
export function getRepoDir(): string {
  return process.env.ORBIT_REPO_DIR || DEFAULT_REPO_DIR;
}
