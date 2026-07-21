<script setup lang="ts">
import PublicSiteNav from "~/components/docs/PublicSiteNav.vue";
import DocOutline from "~/components/docs/DocOutline.vue";
import type { NormalizedOpenApiOperation } from "~/server/database/schema";
import type { DocOutlineItem } from "~/composables/useDocOutline";
import { useDocOutline } from "~/composables/useDocOutline";

definePageMeta({
  layout: false,
  auth: false,
  pageTransition: false,
});

const route = useRoute();
const { fetchSite } = usePublicSite();

const siteSlug = computed(() => route.params.siteSlug as string);
const operationSlug = computed(() => route.params.operationSlug as string);

const site = ref<Awaited<ReturnType<typeof fetchSite>> | null>(null);
const isLoading = ref(true);
const error = ref("");
const contentRef = ref<HTMLElement | null>(null);

const operation = computed<NormalizedOpenApiOperation | null>(() => {
  const norm = site.value?.openapiNormalized;
  if (!norm) return null;
  return norm.operationBySlug[operationSlug.value] || null;
});

const openapiOps = computed(() => {
  const fromNav = site.value?.navConfig?.openapi;
  if (fromNav?.length) return fromNav;
  return site.value?.openapiNormalized?.operations || [];
});

const outlineItems = computed<DocOutlineItem[]>(() => {
  const op = operation.value;
  if (!op) return [];
  const items: DocOutlineItem[] = [];
  if (op.parameters.length) items.push({ type: "section", text: "Parameters", slug: "params" });
  if (op.requestBody) items.push({ type: "section", text: "Request body", slug: "request" });
  if (op.responses.length) items.push({ type: "section", text: "Responses", slug: "responses" });
  return items;
});

const { activeSlug, scrollToSection, setupScrollSpy, teardownScrollSpy } =
  useDocOutline(contentRef);

async function load() {
  isLoading.value = true;
  error.value = "";
  site.value = null;
  teardownScrollSpy();
  try {
    site.value = await fetchSite(siteSlug.value);
    if (!operation.value) {
      error.value = "Operation not found";
    } else {
      await nextTick(() => setupScrollSpy("apiContent"));
    }
  } catch (e: any) {
    error.value = e?.statusMessage || "Site not found";
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
watch([siteSlug, operationSlug], load);

const METHOD_COLORS: Record<string, string> = {
  GET: "method-get",
  POST: "method-post",
  PUT: "method-put",
  PATCH: "method-patch",
  DELETE: "method-delete",
};
function methodClass(m: string): string {
  return METHOD_COLORS[m.toUpperCase()] || "method-other";
}

function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function schemaExample(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return undefined;
  if ("example" in schema) return schema.example;
  if ("default" in schema) return schema.default;
  const type = schema.type;
  if (type === "object" && schema.properties) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties as Record<string, any>)) {
      obj[k] = schemaExample(v);
    }
    return obj;
  }
  if (type === "array" && Array.isArray(schema.items)) {
    return schema.items.map((i: any) => schemaExample(i));
  }
  if (type === "array" && schema.items) {
    return [schemaExample(schema.items)];
  }
  if (type === "string") return "string";
  if (type === "integer" || type === "number") return 0;
  if (type === "boolean") return false;
  return null;
}

const requestExample = computed(() => {
  const rb = operation.value?.requestBody;
  if (!rb) return null;
  if (rb.example !== undefined) return prettyJson(rb.example);
  if (rb.schema) return prettyJson(schemaExample(rb.schema));
  return null;
});

const responseExample = computed(() => {
  const resp = operation.value?.responses?.find((r) => r.status === "200" || r.status === "201") || operation.value?.responses?.[0];
  if (!resp) return null;
  if (resp.example !== undefined) return prettyJson(resp.example);
  if (resp.examples) {
    const first = Object.values(resp.examples)[0];
    if (first?.value !== undefined) return prettyJson(first.value);
  }
  if (resp.schema) return prettyJson(schemaExample(resp.schema));
  return null;
});

useHead(() => ({
  title: operation.value
    ? `${operation.value.method} ${operation.value.path} · ${site.value?.name || "API"}`
    : site.value?.name || "API",
}));
</script>

<template>
  <div class="doc-reader-page">
    <div v-if="isLoading" class="ps-loading">Loading…</div>

    <div v-else-if="error || !operation" class="ps-error">
      <h1>{{ error || "Operation not found" }}</h1>
      <p>The API operation you are looking for could not be loaded.</p>
    </div>

    <div v-else class="doc-shell">
      <aside class="doc-sidebar">
        <div class="doc-sidebar-header">
          <NuxtLink :to="`/s/${siteSlug}`" class="doc-sidebar-title">{{ site?.name }}</NuxtLink>
          <p v-if="site?.app" class="doc-sidebar-meta">{{ site.app.name }}</p>
        </div>
        <div class="doc-sidebar-nav">
          <PublicSiteNav
            :nav-config="site?.navConfig || null"
            :site-slug="siteSlug"
            :pages="site?.pages || []"
            :openapi-operations="openapiOps"
            active-page-slug=""
            :active-operation-slug="operationSlug"
          />
        </div>
      </aside>

      <main ref="contentRef" class="doc-content">
        <article id="apiContent" class="doc-body">
          <div class="ps-op-headline">
            <span class="method-badge" :class="methodClass(operation.method)">{{ operation.method }}</span>
            <code class="op-path">{{ operation.path }}</code>
            <span v-if="operation.deprecated" class="deprecated-pill">deprecated</span>
          </div>
          <h1 class="doc-body-title">{{ operation.summary || operation.operationId || operation.label }}</h1>
          <p v-if="operation.description" class="ps-op-description">{{ operation.description }}</p>

          <section v-if="operation.parameters.length" id="params" class="ps-op-section">
            <h2 class="ps-op-section-title">Parameters</h2>
            <table class="param-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>In</th>
                  <th>Required</th>
                  <th>Description</th>
                  <th>Schema</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in operation.parameters" :key="`${p.in}-${p.name}`">
                  <td class="mono">{{ p.name }}</td>
                  <td>{{ p.in }}</td>
                  <td>{{ p.required ? "yes" : "no" }}</td>
                  <td>{{ p.description || "—" }}</td>
                  <td class="mono schema-cell">{{ p.schema ? prettyJson(p.schema) : "—" }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section v-if="operation.requestBody" id="request" class="ps-op-section">
            <h2 class="ps-op-section-title">
              Request body
              <span class="ps-muted">· {{ operation.requestBody.contentTypes.join(", ") }}</span>
              <span v-if="operation.requestBody.required" class="required-pill">required</span>
            </h2>
            <p v-if="operation.requestBody.description" class="ps-muted">{{ operation.requestBody.description }}</p>
            <pre v-if="requestExample" class="code-block"><code>{{ requestExample }}</code></pre>
          </section>

          <section v-if="operation.responses.length" id="responses" class="ps-op-section">
            <h2 class="ps-op-section-title">Responses</h2>
            <div v-for="r in operation.responses" :key="r.status" class="response-block">
              <div class="response-head">
                <span class="status-pill">{{ r.status }}</span>
                <span class="ps-muted">{{ r.contentTypes.join(", ") }}</span>
              </div>
              <p v-if="r.description">{{ r.description }}</p>
              <pre v-if="responseExample && (r.status === '200' || r.status === '201')" class="code-block"><code>{{ responseExample }}</code></pre>
            </div>
          </section>
        </article>
      </main>

      <DocOutline
        :items="outlineItems"
        :active-slug="activeSlug"
        @navigate="scrollToSection"
      />
    </div>
  </div>
</template>

<style scoped>
.method-badge {
  display: inline-block;
  min-width: 56px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  text-align: center;
}
.method-get { background: color-mix(in oklch, oklch(65% 0.15 145) 18%, transparent); color: oklch(45% 0.13 145); }
.method-post { background: color-mix(in oklch, oklch(60% 0.16 255) 18%, transparent); color: oklch(55% 0.14 255); }
.method-put { background: color-mix(in oklch, oklch(70% 0.15 85) 18%, transparent); color: oklch(48% 0.13 85); }
.method-patch { background: color-mix(in oklch, oklch(70% 0.14 60) 18%, transparent); color: oklch(50% 0.12 60); }
.method-delete { background: color-mix(in oklch, oklch(55% 0.18 25) 18%, transparent); color: oklch(50% 0.16 25); }
.method-other { background: var(--fg-soft); color: var(--muted); }
.op-path {
  font-family: var(--font-mono);
  font-size: 14px;
  background: color-mix(in oklch, var(--fg) 4%, var(--bg));
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.deprecated-pill,
.required-pill {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in oklch, oklch(55% 0.18 25) 15%, transparent);
  color: oklch(50% 0.16 25);
}
.param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.param-table th,
.param-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.param-table th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
}
.mono { font-family: var(--font-mono); font-size: 12px; }
.schema-cell { max-width: 280px; overflow-x: auto; white-space: pre; }
.code-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  margin: 8px 0 0;
}
.code-block code { font-family: inherit; }
.response-block {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 10px;
}
.response-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.status-pill {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--fg-soft);
  color: var(--fg);
}
</style>
