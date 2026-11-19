import { describe, expect, it } from "vitest";
import {
  resolvePublishedPageSlug,
  rewritePublicSiteMarkdownLinks,
} from "./public-site-page-resolve";

const pages = [
  { slug: "panduan-instalasi-device-transkiosk", title: "Device kiosk" },
  { slug: "panduan-instalasi-transkiosk-mdm-cloud", title: "MDM cloud" },
];

describe("resolvePublishedPageSlug", () => {
  it("matches exact and case-insensitive slugs", () => {
    expect(resolvePublishedPageSlug("panduan-instalasi-device-transkiosk", pages)?.slug).toBe(
      "panduan-instalasi-device-transkiosk",
    );
    expect(resolvePublishedPageSlug("Panduan-Instalasi-Device-Transkiosk", pages)?.slug).toBe(
      "panduan-instalasi-device-transkiosk",
    );
  });

  it("resolves legacy .md filenames", () => {
    expect(resolvePublishedPageSlug("PANDUAN_INSTALASI_TRANSTRACK.md", pages)?.slug).toBe(
      "panduan-instalasi-transkiosk-mdm-cloud",
    );
  });
});

describe("rewritePublicSiteMarkdownLinks", () => {
  it("rewrites relative md links to published slugs", () => {
    const md = "See [guide](./PANDUAN_INSTALASI_TRANSTRACK.md#setup).";
    expect(rewritePublicSiteMarkdownLinks(md, pages)).toBe(
      "See [guide](./panduan-instalasi-transkiosk-mdm-cloud#setup).",
    );
  });
});