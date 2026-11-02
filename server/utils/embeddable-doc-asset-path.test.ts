import { describe, expect, it } from "vitest";
import { isEmbeddableDocAssetFilePath } from "~/server/utils/embeddable-doc-asset-path";

describe("isEmbeddableDocAssetFilePath", () => {
  it("matches authenticated doc attachment file routes", () => {
    expect(isEmbeddableDocAssetFilePath("/api/doc-assets/3f2b8c1e-5d4a-4c7b-9e1f-2a3b4c5d6e7f/file")).toBe(true);
  });

  it("matches public shared attachment file routes", () => {
    expect(isEmbeddableDocAssetFilePath("/api/public/doc-assets/8594551d01a84119aba8fbd2833337c9cf5bb9ed/file")).toBe(
      true,
    );
  });

  it("ignores metadata and non-file API routes", () => {
    expect(isEmbeddableDocAssetFilePath("/api/public/doc-assets/abc/file/import")).toBe(false);
    expect(isEmbeddableDocAssetFilePath("/api/docs/1/assets")).toBe(false);
  });

  it("matches when the app is mounted under a base path", () => {
    const prev = process.env.NUXT_APP_BASE_URL;
    process.env.NUXT_APP_BASE_URL = "/docs";
    try {
      expect(isEmbeddableDocAssetFilePath("/docs/api/doc-assets/3f2b8c1e-5d4a-4c7b-9e1f-2a3b4c5d6e7f/file")).toBe(
        true,
      );
    } finally {
      if (prev === undefined) delete process.env.NUXT_APP_BASE_URL;
      else process.env.NUXT_APP_BASE_URL = prev;
    }
  });
});
