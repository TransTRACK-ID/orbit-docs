<script setup lang="ts">
import DocOutline from "~/components/docs/DocOutline.vue";
import { renderMarkdown, headingSlug } from "~/composables/useMarkdown";
import {
  buildOutlineFromMarkdown,
  useDocOutline,
  useMarkdownCopyHandler,
} from "~/composables/useDocOutline";
import { useWikiPageMeta } from "~/composables/useWikiPageMeta";

definePageMeta({
  layout: false,
  auth: true,
  pageTransition: false,
});

const route = useRoute();
const { fetchPage, getCachedPage } = useInternalWiki();
const wikiPageMeta = useWikiPageMeta();

const siteSlug = computed(() => route.params.siteSlug as string);
const pageSlug = computed(() => route.params.pageSlug as string);

const page = ref<any>(null);
const isLoading = ref(true);
const isContentLoading = ref(false);
const error = ref("");
const contentRef = ref<HTMLElement | null>(null);

const frontmatter = computed<Record<string, any>>(
  () => (page.value?.frontmatter as Record<string, any>) || {},
);
const displayTitle = computed(
  () => frontmatter.value.title || page.value?.title || "",
);
const layoutMode = computed<"default" | "wide" | "center">(() => {
  const m = frontmatter.value.mode;
  return m === "wide" || m === "center" ? m : "default";
});

const bodyClass = computed(() => {
  if (layoutMode.value === "wide") return "doc-body doc-body--wide";
  if (layoutMode.value === "center") return "doc-body doc-body--center";
  return "doc-body";
});

useHead(() => ({
  title: displayTitle.value ? `${displayTitle.value} · Wiki` : "Wiki",
}));
useSeoMeta(() => ({
  description: frontmatter.value.description || undefined,
  keywords: Array.isArray(frontmatter.value.keywords)
    ? frontmatter.value.keywords.join(", ")
    : undefined,
}));

const renderedHtml = computed(() => {
  if (!page.value?.content) return "";
  return renderMarkdown(page.value.content);
});

const outlineItems = computed(() =>
  page.value?.content ? buildOutlineFromMarkdown(page.value.content) : [],
);

const { activeSlug, scrollToSection, refreshScrollSpy, teardownScrollSpy } =
  useDocOutline(contentRef);
const { handleContentClick } = useMarkdownCopyHandler();

function scrollToHashFromRoute(): boolean {
  const hash = route.hash;
  if (!hash) return false;
  const rawId = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!rawId) return false;

  if (document.getElementById(rawId)) {
    scrollToSection(rawId);
    return true;
  }

  const normalized = headingSlug(rawId);
  if (normalized && document.getElementById(normalized)) {
    scrollToSection(normalized);
    return true;
  }

  const docEl = document.getElementById("docContent");
  if (docEl) {
    for (const heading of docEl.querySelectorAll<HTMLElement>("h2[id], h3[id]")) {
      if (headingSlug(heading.id) === normalized || heading.id === normalized) {
        scrollToSection(heading.id);
        return true;
      }
    }
  }

  return false;
}

async function applyHashAfterRender() {
  await nextTick();
  if (scrollToHashFromRoute()) return;
  const delays = [50, 100, 200, 400, 800, 1200];
  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay));
    if (scrollToHashFromRoute()) return;
  }
}

function syncWikiPageMeta() {
  if (!page.value) {
    wikiPageMeta.value = { pageId: "", pageStatus: "" };
    return;
  }
  wikiPageMeta.value = {
    pageId: page.value.id,
    pageStatus: page.value.status || "",
  };
}

async function load() {
  error.value = "";
  teardownScrollSpy();

  const hasHash = Boolean(route.hash);

  const cached = getCachedPage(siteSlug.value, pageSlug.value);
  if (cached) {
    page.value = cached;
    syncWikiPageMeta();
    isLoading.value = false;
    isContentLoading.value = false;
    await nextTick(() => {
      if (!hasHash) contentRef.value?.scrollTo?.({ top: 0 });
      refreshScrollSpy();
    });
    if (hasHash) await applyHashAfterRender();
    return;
  }

  const keepContent = !!page.value;
  if (keepContent) {
    isContentLoading.value = true;
  } else {
    isLoading.value = true;
    page.value = null;
    wikiPageMeta.value = { pageId: "", pageStatus: "" };
  }

  try {
    page.value = await fetchPage(siteSlug.value, pageSlug.value);
    syncWikiPageMeta();
    error.value = "";
    await nextTick(() => {
      if (!hasHash) contentRef.value?.scrollTo?.({ top: 0 });
      refreshScrollSpy();
    });
    if (hasHash) await applyHashAfterRender();
  } catch (e: any) {
    error.value = e?.statusMessage || "Page not found";
    if (!keepContent) {
      page.value = null;
      wikiPageMeta.value = { pageId: "", pageStatus: "" };
    }
  } finally {
    isLoading.value = false;
    isContentLoading.value = false;
  }
}

watch(renderedHtml, () => {
  if (!page.value?.content || isLoading.value) return;
  nextTick(() => refreshScrollSpy());
});

onBeforeUnmount(() => {
  wikiPageMeta.value = { pageId: "", pageStatus: "" };
});

onMounted(load);
watch([siteSlug, pageSlug], load);

watch(
  () => route.hash,
  (hash) => {
    if (!hash || !page.value || !contentRef.value) return;
    scrollToHashFromRoute();
  },
);
</script>

<template>
  <main
    v-if="isLoading && !page"
    class="doc-content doc-content--centered"
  >
    <div class="ps-loading">Loading…</div>
  </main>

  <main
    v-else-if="error && !page"
    class="doc-content doc-content--centered"
  >
    <div class="ps-error">
      <h1>{{ error }}</h1>
      <p>The page you are looking for could not be loaded.</p>
    </div>
  </main>

  <template v-else-if="page">
    <main ref="contentRef" class="doc-content" :aria-busy="isContentLoading">
      <div v-if="error" class="ps-error ps-error--inline">
        <h1>{{ error }}</h1>
        <p>The page you are looking for could not be loaded.</p>
      </div>
      <article v-else id="docContent" :class="[bodyClass, { 'is-content-loading': isContentLoading }]">
        <header class="doc-body-header">
          <h1 class="doc-body-title">{{ displayTitle }}</h1>
          <div v-if="page.updatedAt" class="doc-body-meta">
            Updated {{ new Date(page.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
            <span v-if="page.author"> · {{ page.author }}</span>
            <NuxtLink :to="`/docs/${page.id}`" class="wiki-inline-edit">Edit</NuxtLink>
          </div>
        </header>

        <MermaidHtml
          class="markdown-content markdown-body"
          :html="renderedHtml"
          @click="handleContentClick"
        />
      </article>
    </main>

    <DocOutline
      :items="outlineItems"
      :active-slug="activeSlug"
      @navigate="scrollToSection"
    />
  </template>
</template>

<style scoped>
.doc-content--centered {
  display: flex;
  align-items: center;
  justify-content: center;
}

.wiki-inline-edit {
  margin-left: 8px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.wiki-inline-edit:hover {
  text-decoration: underline;
}
</style>
