import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const url = process.env.URL || "https://docs.transtrack.id/api/mcp/connect";
const c = new Client({ name: "shtest", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(url));
try {
  await c.connect(transport);
  console.log("CLIENT CONNECT OK");
} catch (e) {
  console.error("CONNECT FAILED:", e.constructor?.name, e.message);
  if (e.cause) console.error("CAUSE:", e.cause.message);
  process.exit(1);
}
try {
  const res = await c.listTools();
  console.log("TOOLS OK:", res.tools.length);
} catch (e) {
  console.error("TOOLS FAILED:", e.message);
}
try { await transport.close(); } catch {}
