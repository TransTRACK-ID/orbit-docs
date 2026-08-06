import { defineEventHandler } from "h3";
import { handleStreamableHttpRequest } from "~/server/utils/mcp-streamable-http";

export default defineEventHandler(async (event) => {
  await handleStreamableHttpRequest(event);
});
