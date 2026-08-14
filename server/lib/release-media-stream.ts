import { type H3Event, sendStream, setResponseHeader } from "h3";
import { assertReleaseMediaAccess } from "~/server/lib/release-media-access";
import { getReleaseAsset } from "~/server/lib/s3-storage";

export async function streamReleaseMedia(
  event: H3Event,
  releaseId: string,
  assetId: string
) {
  await assertReleaseMediaAccess(event, releaseId);

  const asset = await getReleaseAsset(releaseId, assetId);

  setResponseHeader(event, "Content-Type", asset.contentType);
  setResponseHeader(event, "Cache-Control", "private, max-age=3600");
  if (asset.contentLength) {
    setResponseHeader(event, "Content-Length", asset.contentLength);
  }

  return sendStream(event, asset.body);
}
