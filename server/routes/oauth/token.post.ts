import { defineEventHandler } from "h3";
import { handleOAuthToken } from "~/server/utils/mcp-oauth/handlers";

export default defineEventHandler((event) => handleOAuthToken(event));
