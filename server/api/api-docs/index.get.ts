import { defineEventHandler, getQuery, createError } from "h3";
import { getPostrackConfig } from "~/server/utils/postrack-config";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search.trim() : "";

  const { apiUrl: postrackApiUrl, apiKey: postrackApiKey } = getPostrackConfig();

  if (!postrackApiUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "Postrack API URL is not configured",
    });
  }

  try {
    let url = `${postrackApiUrl.replace(/\/+$/, "")}/api/public/collections`;
    if (search) {
      url += `?search=${encodeURIComponent(search)}`;
    }

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
    console.error("[api-docs-list] Postrack fetch error:", err?.statusCode, err?.message);

    throw createError({
      statusCode: 502,
      statusMessage: "Bad Gateway",
      message: "Unable to load API documentation list. Please try again later.",
    });
  }
});
