export interface McpConfig {
  host: string;
  url: string;
  protocol: string;
  configured: boolean;
  authRequired: boolean;
}

/**
 * Workspace MCP settings. When authRequired is true (MCP_API_KEY set on server),
 * internal wiki URLs (/wiki/) are the preferred doc site links in the UI.
 */
export function useMcpConfig() {
  const config = useState<McpConfig | null>("mcp-config", () => null);

  const preferInternalWiki = computed(() => config.value?.authRequired ?? false);

  async function fetchMcpConfig() {
    try {
      const res = await $fetch<{ data: McpConfig }>("/api/mcp-config");
      config.value = res.data;
    } catch {
      config.value = null;
    }
  }

  return {
    config,
    preferInternalWiki,
    fetchMcpConfig,
  };
}
