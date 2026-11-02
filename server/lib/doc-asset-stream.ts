import { type H3Event, getRequestHeader, sendStream, setResponseHeader } from "h3";
import { getDocAssetStream } from "~/server/lib/s3-storage";

export async function streamDocAssetFile(
  event: H3Event,
  key: string,
  options: { fileName: string; contentType: string; download?: boolean },
) {
  const range = getRequestHeader(event, "range");
  const asset = await getDocAssetStream(key, range);
  const safeName = options.fileName.replace(/["\\\r\n]/g, "_");

  setResponseHeader(event, "Content-Type", options.contentType || asset.contentType);
  setResponseHeader(event, "Accept-Ranges", "bytes");
  setResponseHeader(event, "Cache-Control", "private, max-age=300");
  setResponseHeader(
    event,
    "Content-Disposition",
    `${options.download ? "attachment" : "inline"}; filename="${safeName}"`,
  );
  if (asset.contentLength != null) {
    setResponseHeader(event, "Content-Length", String(asset.contentLength));
  }
  if (asset.isPartial && asset.contentRange) {
    setResponseHeader(event, "Content-Range", asset.contentRange);
    event.node.res.statusCode = 206;
  }

  return sendStream(event, asset.body);
}
