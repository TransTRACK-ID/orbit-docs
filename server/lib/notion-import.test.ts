import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  collectMarkdownAssetRefs,
  deriveHeroTitle,
  listMarkdownEntries,
  rewriteMarkdownAssets,
  sanitizeZipPath,
  unzipImportArchive,
} from "./notion-import";

function buildZip(files: Record<string, string | Uint8Array>): Buffer {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    entries[name] = typeof data === "string" ? strToU8(data) : data;
  }
  return Buffer.from(zipSync(entries));
}

describe("sanitizeZipPath", () => {
  it("keeps normal nested paths", () => {
    expect(sanitizeZipPath("Private & Shared/Page 1 2/img.png")).toBe(
      "Private & Shared/Page 1 2/img.png"
    );
  });

  it("rejects directories and empty names", () => {
    expect(sanitizeZipPath("folder/")).toBeNull();
    expect(sanitizeZipPath("")).toBeNull();
  });

  it("rejects traversal and absolute paths", () => {
    expect(sanitizeZipPath("../evil.md")).toBeNull();
    expect(sanitizeZipPath("/abs.md")).toBeNull();
    expect(sanitizeZipPath("a/../../b.md")).toBeNull();
  });

  it("rejects macOS metadata entries", () => {
    expect(sanitizeZipPath("__MACOSX/x.md")).toBeNull();
    expect(sanitizeZipPath("a/.DS_Store")).toBeNull();
  });

  it("normalizes backslashes", () => {
    expect(sanitizeZipPath("a\\b\\c.png")).toBe("a/b/c.png");
  });
});

describe("unzipImportArchive", () => {
  it("extracts sanitized entries", () => {
    const buf = buildZip({
      "Export/Page abc123.md": "# Hi",
      "Export/Page/img.png": new Uint8Array([1, 2, 3]),
      "__MACOSX/junk": "x",
      "../escape.md": "x",
    });
    const entries = unzipImportArchive(buf);
    expect([...entries.keys()].sort()).toEqual([
      "Export/Page abc123.md",
      "Export/Page/img.png",
    ]);
  });

  it("rejects non-zip buffers", () => {
    expect(() => unzipImportArchive(Buffer.from("not a zip"))).toThrowError(
      /valid ZIP/i
    );
  });
});

describe("listMarkdownEntries", () => {
  it("lists only .md files sorted by path", () => {
    const buf = buildZip({
      "b/Page two.md": "x",
      "a/Page one.md": "xx",
      "a/img.png": new Uint8Array([1]),
    });
    const list = listMarkdownEntries(unzipImportArchive(buf));
    expect(list.map((f) => f.path)).toEqual(["a/Page one.md", "b/Page two.md"]);
  });
});

describe("deriveHeroTitle", () => {
  it("strips the Notion hash suffix from the filename", () => {
    expect(
      deriveHeroTitle(
        "Private & Shared/HRIS Production v 1 1 3b1ccba5c5ad802bbe92d62e7c9b39c7.md",
        ""
      )
    ).toBe("HRIS Production v 1 1");
  });

  it("falls back to the first heading", () => {
    expect(deriveHeroTitle("x/aaaabbbbccccdddd0000111122223333.md", "# Cool Title\nbody")).toBe(
      "Cool Title"
    );
  });
});

describe("collectMarkdownAssetRefs", () => {
  const entries = new Map<string, Uint8Array>([
    ["Private & Shared/Page 1 1/img one.gif", new Uint8Array([1])],
    ["Private & Shared/Page 1 1/other.png", new Uint8Array([2])],
    ["shared/logo.png", new Uint8Array([3])],
  ]);

  it("resolves URI-encoded refs relative to the markdown dir", () => {
    const md = "![gif](Page%201%201/img%20one.gif)";
    const refs = collectMarkdownAssetRefs(entries, "Private & Shared/Page 1 1.md", md);
    expect(refs.get("Page%201%201/img%20one.gif")).toBe(
      "Private & Shared/Page 1 1/img one.gif"
    );
  });

  it("resolves refs from the archive root and html img tags", () => {
    const md = '<img src="shared/logo.png" />';
    const refs = collectMarkdownAssetRefs(entries, "Private & Shared/Page 1 1.md", md);
    expect(refs.get("shared/logo.png")).toBe("shared/logo.png");
  });

  it("falls back to a unique basename match", () => {
    const md = "![](other.png)";
    const refs = collectMarkdownAssetRefs(entries, "Private & Shared/Page 1 1.md", md);
    expect(refs.get("other.png")).toBe("Private & Shared/Page 1 1/other.png");
  });

  it("ignores external and missing refs", () => {
    const md = "![](https://cdn.example.com/x.png) ![](missing.png)";
    const refs = collectMarkdownAssetRefs(entries, "Private & Shared/Page 1 1.md", md);
    expect(refs.size).toBe(0);
  });
});

describe("rewriteMarkdownAssets", () => {
  it("replaces mapped refs and leaves the rest alone", () => {
    const md = "![a](folder/a.png)\n\n![b](https://x.test/b.png)\n\n<img src=\"folder/c.gif\">";
    const out = rewriteMarkdownAssets(
      md,
      new Map([
        ["folder/a.png", "/api/public/releases/r1/m1"],
        ["folder/c.gif", "/api/public/releases/r1/m2"],
      ])
    );
    expect(out).toContain("](/api/public/releases/r1/m1)");
    expect(out).toContain('src="/api/public/releases/r1/m2"');
    expect(out).toContain("https://x.test/b.png");
  });
});
