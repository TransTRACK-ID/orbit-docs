import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildDocPublicPath,
  buildDocPublicUrls,
  buildDocSitePublicPath,
  buildDocWikiPath,
  buildDocWikiUrls,
  buildMcpDocLinkFields,
  buildMcpShareLinks,
  isMcpInternalLinkMode,
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

describe("buildDocWikiPath", () => {
  it("returns wiki path for draft docs in a site", () => {
    expect(
      buildDocWikiPath({
        id: "doc-1",
        status: "draft",
        slug: "1-overview",
        siteId: "site-1",
        siteSlug: "api-docs",
        siteStatus: "draft",
      }),
    ).toBe("/wiki/api-docs/1-overview");
  });
});

describe("buildMcpShareLinks", () => {
  const originalKey = process.env.MCP_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.MCP_API_KEY;
    } else {
      process.env.MCP_API_KEY = originalKey;
    }
  });

  it("uses public links when MCP_API_KEY is not set", () => {
    delete process.env.MCP_API_KEY;
    const publicLinks = { path: "/s/api-docs/guide", url: "https://example.com/s/api-docs/guide" };
    const wikiLinks = { path: "/wiki/api-docs/guide", url: "https://example.com/wiki/api-docs/guide" };
    expect(buildMcpShareLinks(publicLinks, wikiLinks)).toEqual(publicLinks);
  });

  it("prefers wiki links when MCP_API_KEY is set", () => {
    process.env.MCP_API_KEY = "test-key";
    const publicLinks = { path: "/s/api-docs/guide", url: "https://example.com/s/api-docs/guide" };
    const wikiLinks = { path: "/wiki/api-docs/guide", url: "https://example.com/wiki/api-docs/guide" };
    expect(buildMcpShareLinks(publicLinks, wikiLinks)).toEqual(wikiLinks);
  });

  it("falls back to public links when wiki path is unavailable", () => {
    process.env.MCP_API_KEY = "test-key";
    const publicLinks = { path: "/p/doc-1", url: "https://example.com/p/doc-1" };
    const wikiLinks = { path: null, url: null };
    expect(buildMcpShareLinks(publicLinks, wikiLinks)).toEqual(publicLinks);
  });
});

describe("buildMcpDocLinkFields", () => {
  const originalKey = process.env.MCP_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.MCP_API_KEY;
    } else {
      process.env.MCP_API_KEY = originalKey;
    }
  });

  it("sets sharePath to wiki when MCP_API_KEY is set", () => {
    process.env.MCP_API_KEY = "test-key";
    const fields = buildMcpDocLinkFields({
      id: "doc-1",
      status: "draft",
      slug: "1-overview",
      siteId: "site-1",
      siteSlug: "api-docs",
      siteStatus: "draft",
    });
    expect(fields.publicPath).toBeNull();
    expect(fields.wikiPath).toBe("/wiki/api-docs/1-overview");
    expect(fields.sharePath).toBe("/wiki/api-docs/1-overview");
  });

  it("sets sharePath to public when MCP_API_KEY is not set", () => {
    delete process.env.MCP_API_KEY;
    const fields = buildMcpDocLinkFields({
      id: "doc-1",
      status: "published",
      slug: "getting-started",
      siteId: "site-1",
      siteSlug: "api-docs",
      siteStatus: "published",
    });
    expect(fields.sharePath).toBe("/s/api-docs/getting-started");
    expect(fields.wikiPath).toBe("/wiki/api-docs/getting-started");
  });
});

describe("isMcpInternalLinkMode", () => {
  const originalKey = process.env.MCP_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.MCP_API_KEY;
    } else {
      process.env.MCP_API_KEY = originalKey;
    }
  });

  it("returns true when MCP_API_KEY is set", () => {
    process.env.MCP_API_KEY = "secret";
    expect(isMcpInternalLinkMode()).toBe(true);
  });

  it("returns false when MCP_API_KEY is unset", () => {
    delete process.env.MCP_API_KEY;
    expect(isMcpInternalLinkMode()).toBe(false);
  });
});
