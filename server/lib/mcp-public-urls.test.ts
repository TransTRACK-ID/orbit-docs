import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildDocPublicPath,
  buildDocPublicUrls,
  buildDocSitePublicPath,
  buildReleasePublicPath,
  toAbsolutePublicUrl,
} from "./mcp-public-urls";

describe("buildDocPublicPath", () => {
  it("returns doc site page path when site and doc are published", () => {
    expect(
      buildDocPublicPath({
        id: "doc-1",
        status: "published",
        slug: "getting-started",
        siteId: "site-1",
        siteSlug: "api-docs",
        siteStatus: "published",
      }),
    ).toBe("/s/api-docs/getting-started");
  });

  it("falls back to /p/{id} for published docs without a site page", () => {
    expect(
      buildDocPublicPath({
        id: "doc-1",
        status: "published",
      }),
    ).toBe("/p/doc-1");
  });

  it("returns null for unpublished docs", () => {
    expect(
      buildDocPublicPath({
        id: "doc-1",
        status: "draft",
      }),
    ).toBeNull();
  });

  it("returns null when site is not published", () => {
    expect(
      buildDocPublicPath({
        id: "doc-1",
        status: "published",
        slug: "guide",
        siteId: "site-1",
        siteSlug: "api-docs",
        siteStatus: "draft",
      }),
    ).toBe("/p/doc-1");
  });
});

describe("buildDocSitePublicPath", () => {
  it("returns site home path for published sites", () => {
    expect(
      buildDocSitePublicPath({ slug: "api-docs", status: "published" }),
    ).toBe("/s/api-docs");
  });

  it("returns null for draft sites", () => {
    expect(
      buildDocSitePublicPath({ slug: "api-docs", status: "draft" }),
    ).toBeNull();
  });
});

describe("buildReleasePublicPath", () => {
  it("returns release path when published", () => {
    expect(
      buildReleasePublicPath({ id: "rel-1", published: true }),
    ).toBe("/p/releases/rel-1");
  });

  it("returns null when not published", () => {
    expect(
      buildReleasePublicPath({ id: "rel-1", published: false }),
    ).toBeNull();
  });
});

describe("toAbsolutePublicUrl", () => {
  const original = process.env.NUXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NUXT_PUBLIC_APP_URL;
    } else {
      process.env.NUXT_PUBLIC_APP_URL = original;
    }
  });

  it("prefixes path with configured base URL", () => {
    process.env.NUXT_PUBLIC_APP_URL = "https://docs.example.com";
    expect(toAbsolutePublicUrl("/p/doc-1")).toBe("https://docs.example.com/p/doc-1");
  });

  it("returns path unchanged when base URL is not configured", () => {
    delete process.env.NUXT_PUBLIC_APP_URL;
    expect(toAbsolutePublicUrl("/p/doc-1")).toBe("/p/doc-1");
  });
});

describe("buildDocPublicUrls", () => {
  beforeEach(() => {
    process.env.NUXT_PUBLIC_APP_URL = "https://docs.example.com";
  });

  afterEach(() => {
    delete process.env.NUXT_PUBLIC_APP_URL;
  });

  it("returns both path and absolute url", () => {
    expect(
      buildDocPublicUrls({
        id: "doc-1",
        status: "published",
      }),
    ).toEqual({
      path: "/p/doc-1",
      url: "https://docs.example.com/p/doc-1",
    });
  });
});
