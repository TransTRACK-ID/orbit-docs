import { describe, expect, it } from "vitest";
import {
  mergeDocSectionUpdates,
  appendRevisionHistoryRow,
  parseDocSectionUpdatePayload,
  splitMarkdownSections,
  buildFullDocFromAllSections,
  extractFullMarkdownFromAgentJson,
  normalizeMarkdownDiagrams,
} from "./doc-section-merge";


const BASE_DOC = `# SDD Frontend — Demo

| Informasi Dokumen | Detail |
|---|---|
| **Versi Dokumen** | 1.0 |

---

## Daftar Isi

1. [Pendahuluan](#1-pendahuluan)

---

## 1. Pendahuluan

Old intro text.

---

## 3. Tech Stack & Modul

Old stack list.

---

## Riwayat Revisi

| Versi | Tanggal | Perubahan | Author |
|---|---|---|---|
| 1.0 | 2026-01-01 | Draft | Orbit Docs Agent |
`;

describe("splitMarkdownSections", () => {
  it("finds ## sections in SDD-style docs", () => {
    const sections = splitMarkdownSections(BASE_DOC);
    expect(sections.map((s) => s.headingLine)).toEqual([
      "## Daftar Isi",
      "## 1. Pendahuluan",
      "## 3. Tech Stack & Modul",
      "## Riwayat Revisi",
    ]);
  });
});

describe("mergeDocSectionUpdates", () => {
  it("replaces only the targeted section", () => {
    const payload = parseDocSectionUpdatePayload(
      JSON.stringify({
        sections: [
          {
            heading: "## 3. Tech Stack & Modul",
            content: "New stack:\n\n- Nuxt 3\n- Vue 3",
          },
        ],
        revisionSummary: "Updated dependencies",
      })
    );

    const merged = mergeDocSectionUpdates(BASE_DOC, payload);
    expect(merged).toContain("New stack:");
    expect(merged).toContain("Old intro text.");
    expect(merged).not.toContain("Old stack list.");
    expect(splitMarkdownSections(merged)).toHaveLength(4);
  });

  it("preserves preamble before first heading", () => {
    const payload = parseDocSectionUpdatePayload(
      JSON.stringify({
        sections: [{ heading: "## 1. Pendahuluan", content: "Updated intro." }],
      })
    );
    const merged = mergeDocSectionUpdates(BASE_DOC, payload);
    expect(merged.startsWith("# SDD Frontend — Demo")).toBe(true);
    expect(merged).toContain("Updated intro.");
  });

  it("appends sections with unmatched headings instead of failing", () => {
    const payload = parseDocSectionUpdatePayload(
      JSON.stringify({
        sections: [
          {
            heading: "## 99. New Section",
            content: "Brand new content.",
          },
        ],
      })
    );

    const merged = mergeDocSectionUpdates(BASE_DOC, payload);
    expect(merged).toContain("Brand new content.");
    expect(merged).toContain("## 99. New Section");
    expect(merged).toContain("Old intro text.");
    expect(splitMarkdownSections(merged)).toHaveLength(5);
  });
});

describe("appendRevisionHistoryRow", () => {
  it("appends a row to an existing revision table", () => {
    const withRow = appendRevisionHistoryRow(BASE_DOC, "Routing update");
    expect(withRow).toMatch(/\| — \| \d{4}-\d{2}-\d{2} \| Routing update \| Orbit Docs Agent \|/);
  });
});

describe("parseDocSectionUpdatePayload", () => {
  it("extracts JSON from fenced agent output", () => {
    const raw =
      'Here are the updates:\n```json\n{"sections":[{"heading":"## 1. Pendahuluan","content":"x"}]}\n```';
    const payload = parseDocSectionUpdatePayload(raw);
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].heading).toBe("## 1. Pendahuluan");
  });

  it("normalizes a single heading/content object into sections", () => {
    const raw =
      'I\'ll read the existing PRD...\n{"heading":"# Product Requirements Document (PRD) — MMS","content":"| Informasi | Detail |\\n|---|---|\\n| Nama | MMS |"}';
    const payload = parseDocSectionUpdatePayload(raw);
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].heading).toBe("# Product Requirements Document (PRD) — MMS");
    expect(payload.sections[0].content).toContain("Informasi");
  });
});

describe("extractFullMarkdownFromAgentJson", () => {
  it("builds a full markdown doc from agent JSON with preamble", () => {
    const raw =
      'Searching for the PRD file...\n{"heading":"# Product Requirements Document (PRD) — MMS","content":"## 1. Pendahuluan\\n\\nBody text."}';
    const doc = extractFullMarkdownFromAgentJson(raw);
    expect(doc).toBe(
      "# Product Requirements Document (PRD) — MMS\n\n## 1. Pendahuluan\n\nBody text."
    );
  });
});

describe("buildFullDocFromAllSections", () => {
  it("builds a standalone doc from all payload sections", () => {
    const payload = parseDocSectionUpdatePayload(
      JSON.stringify({
        sections: [
          { heading: "## 1. Pendahuluan", content: "Intro text." },
          { heading: "## 2. Arsitektur", content: "Architecture details." },
        ],
      })
    );
    const doc = buildFullDocFromAllSections(payload);
    expect(doc).toBe("## 1. Pendahuluan\n\nIntro text.\n\n## 2. Arsitektur\n\nArchitecture details.");
  });
});

describe("normalizeMarkdownDiagrams", () => {
  it("wraps bare mermaid diagrams in code fences", () => {
    const bare = "mermaid\nflowchart TB\n subgraph presentation\n FE[Frontend]\n end";
    const normalized = normalizeMarkdownDiagrams(bare);
    expect(normalized).toBe("```mermaid\nflowchart TB\n subgraph presentation\n FE[Frontend]\n end\n```");
  });

  it("leaves already-fenced mermaid diagrams untouched", () => {
    const fenced = "```mermaid\nflowchart LR\n A --> B\n```";
    const normalized = normalizeMarkdownDiagrams(fenced);
    expect(normalized).toBe(fenced);
  });
});
