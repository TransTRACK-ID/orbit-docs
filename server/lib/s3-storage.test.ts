import { describe, expect, it } from "vitest";
import {
  assertAllowedImageType,
  assertAllowedLogoType,
  buildLogoAssetKey,
  buildLogoProxyPath,
  buildReleaseAssetKey,
  buildReleaseMediaProxyPath,
  isValidUuid,
} from "./s3-storage";

const RELEASE_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const ASSET_ID = "b2c3d4e5-f6a7-4890-b123-456789abcdef";

describe("s3-storage helpers", () => {
  it("validates UUIDs", () => {
    expect(isValidUuid(RELEASE_ID)).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });

  it("builds release asset keys", () => {
    expect(buildReleaseAssetKey(RELEASE_ID, ASSET_ID)).toBe(
      `releases/${RELEASE_ID}/${ASSET_ID}`
    );
  });

  it("builds public proxy paths", () => {
    expect(buildReleaseMediaProxyPath(RELEASE_ID, ASSET_ID)).toBe(
      `/api/public/releases/${RELEASE_ID}/media/${ASSET_ID}`
    );
    expect(buildLogoProxyPath(ASSET_ID)).toBe(
      `/api/public/brand/logos/${ASSET_ID}`
    );
  });

  it("builds logo asset keys", () => {
    expect(buildLogoAssetKey(ASSET_ID)).toBe(`brand/logos/${ASSET_ID}`);
  });

  it("accepts allowed image types with matching signatures", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(assertAllowedImageType("image/png", png)).toBe("image/png");
  });

  it("rejects disallowed mime types", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => assertAllowedImageType("image/svg+xml", png)).toThrow();
  });

  it("rejects mismatched declared type and bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => assertAllowedImageType("image/jpeg", png)).toThrow();
  });

  it("accepts valid svg logos", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(assertAllowedLogoType("image/svg+xml", svg)).toBe("image/svg+xml");
  });
});
