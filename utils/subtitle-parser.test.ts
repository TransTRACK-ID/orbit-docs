import { describe, expect, it } from "vitest";
import { parseSubtitles } from "~/utils/subtitle-parser";

describe("parseSubtitles", () => {
  it("parses SRT cues", () => {
    const srt = [
      "1",
      "00:00:01,200 --> 00:00:04,800",
      "Hello <i>team</i>",
      "",
      "2",
      "00:01:05,000 --> 00:01:09,500",
      "Second line",
      "continues here",
    ].join("\n");
    expect(parseSubtitles(srt)).toEqual([
      { start: 1, end: 5, text: "Hello team" },
      { start: 65, end: 70, text: "Second line continues here" },
    ]);
  });

  it("parses WebVTT cues with short timestamps and settings", () => {
    const vtt = [
      "WEBVTT",
      "",
      "NOTE skip me",
      "",
      "intro",
      "00:10.000 --> 00:12.000 align:start",
      "<v Ana>Welcome</v>",
    ].join("\n");
    expect(parseSubtitles(vtt)).toEqual([{ start: 10, end: 12, text: "Welcome" }]);
  });

  it("returns no segments for unrelated text", () => {
    expect(parseSubtitles("just some notes")).toEqual([]);
  });
});
