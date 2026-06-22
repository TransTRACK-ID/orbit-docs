import { defineEventHandler, getRouterParam, createError } from "h3";
import { getPostrackConfig } from "~/server/utils/postrack-config";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Slug is required",
    });
  }

  const { apiUrl: postrackApiUrl, apiKey: postrackApiKey } = getPostrackConfig();

  if (!postrackApiUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "Postrack API URL is not configured",
    });
  }

  try {
    const url = `${postrackApiUrl.replace(/\/+$/, "")}/api/public/collection-docs/${encodeURIComponent(slug)}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (postrackApiKey) {
      headers.Authorization = `Bearer ${postrackApiKey}`;
    }

    const data = await $fetch(url, {
      headers,
      timeout: 10000,
    });

    return data;
  } catch (err: any) {
    console.error("[api-docs] Postrack fetch error:", err?.statusCode, err?.message);

    // Forward Postrack errors transparently
    if (err?.statusCode === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: "Not Found",
        message: "API documentation not found",
      });
    }

    if (err?.statusCode === 403) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "This documentation is not publicly available",
      });
    }

    throw createError({
      statusCode: 502,
      statusMessage: "Bad Gateway",
      message: "Unable to load documentation. Please try again later.",
    });
  }
});
