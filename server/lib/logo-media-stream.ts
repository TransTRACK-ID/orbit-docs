import { type H3Event, sendStream, setResponseHeader } from "h3";
import { getLogoAsset } from "~/server/lib/s3-storage";

export async function streamLogoMedia(event: H3Event, assetId: string) {
  const asset = await getLogoAsset(assetId);

  setResponseHeader(event, "Content-Type", asset.contentType);
  setResponseHeader(event, "Cache-Control", "public, max-age=86400, immutable");
  if (asset.contentLength) {
    setResponseHeader(event, "Content-Length", asset.contentLength);
  }

  return sendStream(event, asset.body);
}
