import type { DocGenerationJob } from "~/composables/useDocGenerator";

type WikiJobRef = Pick<DocGenerationJob, "scope" | "progressMessage">;

/** Whether the job is a wiki-site generation run (not product SRS/FSD/SDD). */
export function isWikiGenerationJob(job: WikiJobRef | null | undefined): boolean {
  return job?.scope === "wiki";
}

/**
 * Parse the internal wiki overview path from a completed wiki job's progress message.
 * Example: "Wiki site ready at /wiki/my-app/1-overview" → "/wiki/my-app/1-overview"
 */
export function wikiOverviewPathFromJob(job: WikiJobRef | null | undefined): string | null {
  if (!isWikiGenerationJob(job)) return null;
  const msg = job?.progressMessage || "";
  const match = msg.match(/\/wiki\/[a-z0-9-]+\/[a-z0-9-]+/i);
  return match ? match[0] : null;
}
