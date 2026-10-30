import { describe, expect, it } from "vitest";
import { markdownToEditorJs, editorJsToMarkdown } from "~/composables/useEditorJsConverter";
import { renderMarkdown, splitVideoBlocks } from "~/composables/useMarkdown";
import { formatTimestamp, parseTimestamp, parseVideoBlock, serializeVideoBlock } from "~/utils/video-block";

const ASSET = "3f2b8c1e-5d4a-4c7b-9e1f-2a3b4c5d6e7f";

const block = [
  `:::video ${ASSET} Login walkthrough`,
  "[00:00-00:42] Intro and goals",
  "[01:05] Password reset <b>flow</b>",
  ":::",
].join("\n");

describe("timestamps", () => {
  it("formats and parses mm:ss and h:mm:ss", () => {
    expect(formatTimestamp(65)).toBe("01:05");
    expect(formatTimestamp(3723)).toBe("1:02:03");
    expect(parseTimestamp("01:05")).toBe(65);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp("1:75")).toBeNull();
    expect(parseTimestamp("65")).toBeNull();
  });
});

describe("video block", () => {
  it("parses and serializes back to the same markdown", () => {
    const parsed = parseVideoBlock(block.split("\n"), 0);
    expect(parsed?.data).toEqual({
      assetId: ASSET,
      title: "Login walkthrough",
      segments: [
        { start: 0, end: 42, text: "Intro and goals" },
        { start: 65, end: null, text: "Password reset <b>flow</b>" },
      ],
    });
    expect(parsed?.next).toBe(4);
    expect(serializeVideoBlock(parsed!.data)).toBe(block);
  });

  it("rejects openers without a valid asset id", () => {
    expect(parseVideoBlock([":::video not-a-uuid Title", ":::"], 0)).toBeNull();
  });

  it("round-trips through the Editor.js converter", () => {
    const md = `Before the video.\n\n${block}\n\nAfter the video.`;
    const data = markdownToEditorJs(md);
    expect(data.blocks.map((b) => b.type)).toEqual(["paragraph", "video", "paragraph"]);
    expect(editorJsToMarkdown(data)).toBe(md);
  });

  it("ends a paragraph when a video block starts on the next line", () => {
    const data = markdownToEditorJs(`Intro line\n${block}`);
    expect(data.blocks.map((b) => b.type)).toEqual(["paragraph", "video"]);
  });
});

describe("video rendering", () => {
  it("renders a player with escaped, seekable transcript", () => {
    const html = renderMarkdown(`# Title\n\n${block}`);
    expect(html).toContain(`<figure class="doc-video" data-asset-id="${ASSET}">`);
    expect(html).toContain(`src="/api/doc-assets/${ASSET}/file"`);
    expect(html).toContain('data-seek="65"');
    expect(html).toContain("Password reset &lt;b&gt;flow&lt;/b&gt;");
    expect(html).not.toContain(":::video");
  });

  it("leaves video syntax inside code fences alone", () => {
    const parts = splitVideoBlocks(["```", block, "```"].join("\n"));
    expect(parts).toHaveLength(1);
    expect(parts[0]!.kind).toBe("markdown");
  });
});
