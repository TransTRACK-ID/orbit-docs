import { describe, expect, it } from "vitest";
import {
  mergeDocSectionUpdates,
  appendRevisionHistoryRow,
  parseDocSectionUpdatePayload,
  splitMarkdownSections,
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
});
