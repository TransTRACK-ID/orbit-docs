import { defineEventHandler } from "h3";
import { getAuthorizationServerMetadata } from "~/server/utils/mcp-oauth/handlers";

export default defineEventHandler((event) => getAuthorizationServerMetadata(event));
