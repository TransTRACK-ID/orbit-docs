import { describe, expect, it } from "vitest";
import {
  chunkMarkdownForEmbedding,
  isIndexableDocType,
  secondarySplitContent,
  splitWikiMarkdownSections,
} from "./doc-chunking";

const SDD_DOC = `# SDD Backend

## Durable Webhook Delivery

The system uses a transactional outbox pattern for webhook delivery.
Retries use exponential backoff with a durable queue.

## Authentication

JWT-based auth for all API routes.
`;

describe("isIndexableDocType", () => {
  it("allows feature, sdd, and wiki", () => {
    expect(isIndexableDocType("feature")).toBe(true);
    expect(isIndexableDocType("sdd")).toBe(true);
    expect(isIndexableDocType("wiki")).toBe(true);
    expect(isIndexableDocType("fsd")).toBe(false);
    expect(isIndexableDocType(null)).toBe(false);
  });
});

describe("chunkMarkdownForEmbedding", () => {
  it("splits SDD docs by ## headings", () => {
    const chunks = chunkMarkdownForEmbedding(SDD_DOC);
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.heading).toBe("Durable Webhook Delivery");
    expect(chunks[0]?.content).toContain("transactional outbox");
    expect(chunks[1]?.heading).toBe("Authentication");
  });

  it("returns preamble chunk when no ## headings exist", () => {
    const chunks = chunkMarkdownForEmbedding("Plain intro without headings.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.heading).toBe("(document)");
  });

  it("splits wiki pages on #, ##, and ### headings", () => {
    const wikiDoc = `# Overview

Intro text.

## Setup

Install steps.

### Config file

Edit config.yaml.
`;
    const sections = splitWikiMarkdownSections(wikiDoc);
    expect(sections.map((s) => s.headingLine)).toEqual([
      "# Overview",
      "## Setup",
      "### Config file",
    ]);

    const chunks = chunkMarkdownForEmbedding(wikiDoc, "wiki");
    expect(chunks).toHaveLength(3);
    expect(chunks[2]?.heading).toBe("Config file");
  });
});

describe("secondarySplitContent", () => {
  it("splits oversized content on paragraph boundaries", () => {
    const paragraphA = "A".repeat(100);
    const paragraphB = "B".repeat(100);
    const text = `${paragraphA}\n\n${paragraphB}`;
    const parts = secondarySplitContent(text, 120);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("\n\n")).toContain("AAAA");
    expect(parts.join("\n\n")).toContain("BBBB");
  });
});
