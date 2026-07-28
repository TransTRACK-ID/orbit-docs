import { describe, expect, it } from "vitest";
import {
  defaultLinkLabel,
  isBareUrl,
  isInternalLink,
  looksLikeUrl,
  prepareLinkUrl,
} from "~/components/editorjs/linkUtils";

describe("linkUtils", () => {
  it("detects bare URLs", () => {
    expect(isBareUrl("https://example.com/docs")).toBe(true);
    expect(isBareUrl("example.com/page")).toBe(true);
    expect(isBareUrl("www.github.com")).toBe(true);
    expect(isBareUrl("not a url")).toBe(false);
    expect(isBareUrl("/internal/path")).toBe(false);
    expect(isBareUrl("../relative/path")).toBe(false);
    expect(isBareUrl("./relative/path")).toBe(false);
  });

  it("prepares URLs with protocol", () => {
    expect(prepareLinkUrl("example.com")).toBe("https://example.com");
    expect(prepareLinkUrl("https://example.com")).toBe("https://example.com");
    expect(prepareLinkUrl("/docs")).toBe("/docs");
    expect(prepareLinkUrl("#section")).toBe("#section");
  });

  it("preserves relative path URLs without prepending https://", () => {
    expect(prepareLinkUrl("../panduan-instalasi-transkiosk-mdm-cloud")).toBe(
      "../panduan-instalasi-transkiosk-mdm-cloud",
    );
    expect(prepareLinkUrl("./other-page")).toBe("./other-page");
    expect(prepareLinkUrl("../other-page#section")).toBe("../other-page#section");
  });

  it("derives a readable default label from hostname", () => {
    expect(defaultLinkLabel("https://www.example.com/path")).toBe("example.com");
  });

  it("identifies URL-like strings", () => {
    expect(looksLikeUrl("https://example.com")).toBe(true);
    expect(looksLikeUrl("Read the guide")).toBe(false);
  });

  it("detects internal links", () => {
    expect(isInternalLink("/docs")).toBe(true);
    expect(isInternalLink("#section")).toBe(true);
    expect(isInternalLink("../other-page")).toBe(true);
    expect(isInternalLink("./other-page")).toBe(true);
    expect(isInternalLink("https://example.com")).toBe(false);
    expect(isInternalLink("example.com")).toBe(false);
  });
});
