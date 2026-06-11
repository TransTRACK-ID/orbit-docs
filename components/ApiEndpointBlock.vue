<script setup lang="ts">
import type { ApiDocEndpoint } from "~/types/apiDocs";

interface Props {
  endpoint: ApiDocEndpoint;
  baseUrl?: string | null;
}

const props = defineProps<Props>();

const copiedCurl = ref(false);

const getMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    GET: "oklch(55% 0.16 255)",
    POST: "oklch(55% 0.16 145)",
    PUT: "oklch(60% 0.16 85)",
    PATCH: "oklch(55% 0.16 300)",
    DELETE: "oklch(55% 0.16 25)",
    HEAD: "oklch(55% 0.02 250)",
    OPTIONS: "oklch(55% 0.1 190)",
  };
  return colors[method] || "oklch(55% 0.02 250)";
};

const methodBg = (method: string): string => {
  const color = getMethodColor(method);
  return `color-mix(in oklch, ${color} 12%, transparent)`;
};

const generatedCurl = computed(() => {
  if (props.endpoint.curlExample) return props.endpoint.curlExample;

  const method = props.endpoint.method;
  const url = props.baseUrl
    ? props.endpoint.url.replace(/^\{\{\w+\}\}/, props.baseUrl)
    : props.endpoint.url;

  let curl = `curl --location --request ${method} '${url}'`;

  if (props.endpoint.headers) {
    Object.entries(props.endpoint.headers).forEach(([key, value]) => {
      curl += ` \\\n--header '${key}: ${value}'`;
    });
  }

  if (props.endpoint.auth?.type === "bearer") {
    curl += ` \\\n--header 'Authorization: Bearer <token>'`;
  }

  const rb = props.endpoint.requestBody;
  if (rb?.content) {
    const entries = Object.entries(rb.content);
    const firstEntry = entries[0];
    if (firstEntry) {
      const [ct, contentData] = firstEntry;
      const schema = contentData?.schema;
      if (schema?.example) {
        const body =
          typeof schema.example === "string"
            ? schema.example
            : JSON.stringify(schema.example, null, 2);
        curl += ` \\\n--header 'Content-Type: ${ct}'`;
        curl += ` \\\n--data '${body.replace(/'/g, "\\'")}'`;
      }
    }
  }

  return curl;
});

const copyCurl = async () => {
  try {
    await navigator.clipboard.writeText(generatedCurl.value);
    copiedCurl.value = true;
    setTimeout(() => {
      copiedCurl.value = false;
    }, 2000);
  } catch (e) {
    console.error("Failed to copy cURL:", e);
  }
};

const responseStatusClass = (statusCode: string): string => {
  const code = parseInt(statusCode);
  if (code >= 200 && code < 300) return "status-2xx";
  if (code >= 300 && code < 400) return "status-3xx";
  if (code >= 400 && code < 500) return "status-4xx";
  return "status-5xx";
};
</script>

<template>
  <div class="api-endpoint-block">
    <!-- Header: Method + Path -->
    <div class="endpoint-header">
      <span
        class="method-badge"
        :style="{
          backgroundColor: methodBg(endpoint.method),
          color: getMethodColor(endpoint.method),
        }"
      >
        {{ endpoint.method }}
      </span>
      <code class="endpoint-path">{{ endpoint.cleanPath }}</code>
    </div>

    <!-- Name + Notes -->
    <div class="endpoint-section">
      <h3 class="endpoint-name">{{ endpoint.name }}</h3>
      <MermaidHtml
        v-if="endpoint.notes"
        class="endpoint-notes"
        :html="renderMarkdown(endpoint.notes)"
      />
    </div>

    <!-- Auth -->
    <div v-if="endpoint.auth" class="endpoint-section">
      <h4 class="section-label">Authentication</h4>
      <div class="info-box">
        Type: <span class="font-medium">{{ endpoint.auth.type }}</span>
      </div>
    </div>

    <!-- Headers -->
    <div
      v-if="endpoint.headers && Object.keys(endpoint.headers).length"
      class="endpoint-section"
    >
      <h4 class="section-label">Headers</h4>
      <div class="code-box">
        <div
          v-for="(v, k) in endpoint.headers"
          :key="k"
          class="code-row"
        >
          <span class="code-key">{{ k }}</span>
          <span class="code-value">{{ v }}</span>
        </div>
      </div>
    </div>

    <!-- Param Schema Table -->
    <div
      v-if="endpoint.paramSchema && endpoint.paramSchema.length"
      class="endpoint-section"
    >
      <h4 class="section-label">Request Parameters</h4>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Data Type</th>
              <th>Required</th>
              <th>Example</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="param in endpoint.paramSchema" :key="param.name">
              <td class="mono">{{ param.name }}</td>
              <td>{{ param.dataType }}</td>
              <td>
                <span :class="param.required ? 'text-required' : 'text-muted'">
                  {{ param.required ? "Y" : "N" }}
                </span>
              </td>
              <td class="mono muted">{{ param.exampleValue }}</td>
              <td>{{ param.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Fallback: Auto-extracted Parameters -->
    <div
      v-else-if="endpoint.parameters && endpoint.parameters.length"
      class="endpoint-section"
    >
      <h4 class="section-label">Parameters</h4>
      <div class="info-list">
        <div
          v-for="param in endpoint.parameters"
          :key="`${param.in}:${param.name}`"
          class="info-row"
        >
          <div class="info-row-header">
            <span class="mono">{{ param.name }}</span>
            <span :class="['param-badge', param.required ? 'required' : 'optional']">
              {{ param.in }}
            </span>
          </div>
          <div v-if="param.description" class="param-desc">
            {{ param.description }}
          </div>
        </div>
      </div>
    </div>

    <!-- Request Body -->
    <div v-if="endpoint.requestBody" class="endpoint-section">
      <h4 class="section-label">Request Body</h4>
      <pre class="code-pre"><code>{{ typeof endpoint.requestBody.content === 'object' && endpoint.requestBody.content ? JSON.stringify(endpoint.requestBody.content, null, 2) : String(endpoint.requestBody.content || '') }}</code></pre>
    </div>

    <!-- cURL Example -->
    <div v-if="generatedCurl" class="endpoint-section">
      <div class="section-header-flex">
        <h4 class="section-label">cURL</h4>
        <button class="copy-btn" @click="copyCurl">
          {{ copiedCurl ? "Copied!" : "Copy" }}
        </button>
      </div>
      <pre class="code-pre"><code>{{ generatedCurl }}</code></pre>
    </div>

    <!-- Responses -->
    <div
      v-if="endpoint.responses && Object.keys(endpoint.responses).length"
      class="endpoint-section"
    >
      <h4 class="section-label">Responses</h4>
      <div class="responses">
        <div
          v-for="([statusCode, response]) in Object.entries(endpoint.responses)"
          :key="statusCode"
          class="response-card"
        >
          <div class="response-header">
            <span :class="['status-badge', responseStatusClass(statusCode)]">
              {{ statusCode }}
            </span>
            <span class="response-desc">{{ response.description }}</span>
          </div>

          <div v-if="response.examples && response.examples.length > 0" class="response-body">
            <div
              v-for="(example, exIndex) in response.examples"
              :key="exIndex"
              class="example-card"
            >
              <div class="example-title">{{ example.name }}</div>

              <div
                v-if="example.headers && Object.keys(example.headers).length > 0"
                class="example-headers"
              >
                <div
                  v-for="(headerValue, headerKey) in example.headers"
                  :key="headerKey"
                  class="header-row"
                >
                  <span class="mono">{{ headerKey }}</span>
                  <span class="muted">{{ headerValue }}</span>
                </div>
              </div>

              <div v-if="example.body !== undefined && example.body !== null" class="example-body">
                <pre class="code-pre"><code>{{ typeof example.body === 'string' ? example.body : JSON.stringify(example.body, null, 2) }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-endpoint-block {
  margin-bottom: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.method-badge {
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 4px 8px;
  border-radius: var(--radius);
  line-height: 1;
  text-transform: uppercase;
}

.endpoint-path {
  font-size: 14px;
  font-family: var(--font-mono);
  color: var(--fg);
}

.endpoint-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.endpoint-section:last-child {
  border-bottom: none;
}

.endpoint-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
  margin: 0;
}

.endpoint-notes {
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
  line-height: 1.6;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-header-flex .section-label {
  margin-bottom: 0;
}

.info-box {
  font-size: 13px;
  color: var(--fg);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}

.info-list {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.info-row {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.param-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.param-badge.required {
  background: color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent);
  color: oklch(55% 0.16 25);
}

.param-badge.optional {
  background: var(--bg);
  color: var(--muted);
}

.param-desc {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}

.code-box {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0;
}

.code-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 13px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.code-row:last-child {
  border-bottom: none;
}

.code-key {
  font-family: var(--font-mono);
  color: var(--fg);
  flex-shrink: 0;
  font-weight: 500;
}

.code-value {
  color: var(--muted);
  flex: 1;
  min-width: 0;
  word-break: break-all;
  line-height: 1.5;
}

.table-wrap {
  overflow-x: auto;
}

.table-wrap table {
  width: 100%;
  font-size: 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
}

.table-wrap thead {
  background: var(--bg);
}

.table-wrap th,
.table-wrap td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.table-wrap th {
  font-weight: 600;
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.table-wrap tbody tr:last-child td {
  border-bottom: none;
}

.mono {
  font-family: var(--font-mono);
}

.muted {
  color: var(--muted);
}

.text-required {
  color: oklch(55% 0.16 25);
}

.text-muted {
  color: var(--muted);
}

.code-pre {
  font-size: 13px;
  background: var(--bg);
  padding: 12px;
  border-radius: var(--radius);
  overflow-x: auto;
  border: 1px solid var(--border);
  margin: 0;
  font-family: var(--font-mono);
  line-height: 1.5;
  color: var(--fg);
}

.code-pre code {
  background: none;
  padding: 0;
  font-size: 13px;
}

.copy-btn {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--accent);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.copy-btn:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.responses {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.response-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.response-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-badge {
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 3px 8px;
  border-radius: 4px;
  line-height: 1;
}

.status-2xx {
  background: color-mix(in oklch, oklch(55% 0.16 145) 12%, transparent);
  color: oklch(55% 0.16 145);
}

.status-3xx {
  background: color-mix(in oklch, oklch(55% 0.16 255) 12%, transparent);
  color: oklch(55% 0.16 255);
}

.status-4xx {
  background: color-mix(in oklch, oklch(60% 0.16 85) 15%, transparent);
  color: oklch(60% 0.16 85);
}

.status-5xx {
  background: color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent);
  color: oklch(55% 0.16 25);
}

.response-desc {
  font-size: 13px;
  color: var(--muted);
  flex: 1;
}

.response-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.example-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.example-title {
  padding: 8px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 500;
  color: var(--fg);
}

.example-headers {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.header-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
}

.header-row .mono {
  min-width: 0;
  color: var(--fg);
}

.example-body {
  padding: 12px;
}

.font-medium {
  font-weight: 500;
}

.api-endpoint-block :deep(.endpoint-notes p) {
  margin: 0.25em 0;
}

.api-endpoint-block :deep(.endpoint-notes p:first-child) {
  margin-top: 0;
}

.api-endpoint-block :deep(.endpoint-notes p:last-child) {
  margin-bottom: 0;
}

.api-endpoint-block :deep(.endpoint-notes a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.api-endpoint-block :deep(.endpoint-notes code) {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.api-endpoint-block :deep(.endpoint-notes pre) {
  background: var(--bg);
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: auto;
}

.api-endpoint-block :deep(.endpoint-notes pre code) {
  background: none;
  padding: 0;
}
</style>
