import { defineEventHandler } from "h3";
import { handleOAuthAuthorize } from "~/server/utils/mcp-oauth/handlers";

export default defineEventHandler((event) => handleOAuthAuthorize(event));
