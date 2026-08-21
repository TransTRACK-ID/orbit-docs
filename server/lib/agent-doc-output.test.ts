import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { resolveAgentDocOutput, preferDiskDocOutput } from "./agent-doc-output";

describe("resolveAgentDocOutput", () => {
  it("prefers on-disk file when chat output is truncated", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "orbit-doc-output-"));
    const relPath = "docs/SDD-Frontend.md";
    const fullDoc = "# System Design Document (SDD)\n\n" + "section\n\n".repeat(200);
    await mkdir(join(workdir, "docs"), { recursive: true });
    await writeFile(join(workdir, relPath), fullDoc, "utf-8");

    const chat =
      "## Daftar Isi\n\n[... full 1,120-line document in docs/SDD-Frontend.md ...]";

    const resolved = await resolveAgentDocOutput(chat, workdir, {
      outputRelativePath: relPath,
      existingContent: fullDoc.slice(0, 5000),
      fileContentBefore: fullDoc.slice(0, 5000),
      docType: "sdd",
    });

    expect(resolved.trim()).toBe(fullDoc.trim());
    await rm(workdir, { recursive: true, force: true });
  });

  it("uses chat output when no file path is configured", async () => {
    const chat = "# Functional Specification Document (FSD)\n\nBody";
    const resolved = await resolveAgentDocOutput(chat, "/tmp", {});
    expect(resolved).toBe(chat);
  });

  it("extracts markdown from agent JSON when chat includes reasoning preamble", async () => {
    const chat =
      'Searching for the PRD file...\n{"heading":"# Product Requirements Document (PRD) — MMS","content":"## 1. Pendahuluan\\n\\nUpdated body."}';
    const resolved = await resolveAgentDocOutput(chat, "/tmp", { docType: "srs" });
    expect(resolved).toBe(
      "# Product Requirements Document (PRD) — MMS\n\n## 1. Pendahuluan\n\nUpdated body."
    );
  });
});

describe("preferDiskDocOutput", () => {
  it("prefers on-disk file when chat output is truncated", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "orbit-doc-prefer-"));
    const relPath = "docs/SDD-Frontend.md";
    const fullDoc = "# System Design Document (SDD)\n\n" + "section\n\n".repeat(100);
    await mkdir(join(workdir, "docs"), { recursive: true });
    await writeFile(join(workdir, relPath), fullDoc, "utf-8");

    const truncated = "[... full document in docs/SDD-Frontend.md ...]";
    const resolved = await preferDiskDocOutput(workdir, relPath, truncated, "sdd");

    expect(resolved.trim()).toBe(fullDoc.trim());
    await rm(workdir, { recursive: true, force: true });
  });
});
