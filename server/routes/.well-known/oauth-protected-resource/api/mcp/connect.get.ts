import { defineEventHandler } from "h3";
import { getProtectedResourceMetadata } from "~/server/utils/mcp-oauth/handlers";

export default defineEventHandler((event) => getProtectedResourceMetadata(event));
