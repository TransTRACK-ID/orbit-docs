<script setup lang="ts">
import DocOutline from "~/components/docs/DocOutline.vue";
import { renderMarkdown, headingSlug } from "~/composables/useMarkdown";
import {
  buildOutlineFromMarkdown,
  useDocOutline,
  useMarkdownCopyHandler,
} from "~/composables/useDocOutline";

definePageMeta({
  layout: false,
  auth: false,
  pageTransition: false,
});

const route = useRoute();
const { fetchPage, getCachedPage } = usePublicSite();

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
  title: displayTitle.value || page.value?.site?.name || "Docs",
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

// Scroll the nested .doc-content container to the heading id from route.hash.
// The browser's native anchor jump doesn't work here because the article is
// inside a scrollable <main>, not the document body. Returns true if the
// heading was found and scrolled to.
//
// The hash may not exactly match the heading's DOM id — external systems or
// older slugifiers can produce different normalizations (e.g. double dashes
// where headingSlug produces single dashes). We try, in order:
//   1. Exact getElementById match
//   2. Normalize the hash with headingSlug and try again
//   3. Fuzzy: normalize every heading id in the DOM and compare
function scrollToHashFromRoute(): boolean {
  const hash = route.hash;
  if (!hash) return false;
  const rawId = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!rawId) return false;

  // 1. Exact match
  if (document.getElementById(rawId)) {
    scrollToSection(rawId);
    return true;
  }

  // 2. Normalize the hash the same way heading IDs are generated
  const normalized = headingSlug(rawId);
  if (normalized && document.getElementById(normalized)) {
    scrollToSection(normalized);
    return true;
  }

  // 3. Fuzzy: compare normalized hash against normalized heading IDs
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

// Wait for the rendered HTML to be in the DOM, then attempt the hash scroll.
// Mermaid/async rendering can delay heading availability, so retry with
// increasing delays.
async function applyHashAfterRender() {
  await nextTick();
  if (scrollToHashFromRoute()) return;
  const delays = [50, 100, 200, 400, 800, 1200];
  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay));
    if (scrollToHashFromRoute()) return;
  }
}

async function load() {
  error.value = "";
  teardownScrollSpy();

  const hasHash = Boolean(route.hash);

  const cached = getCachedPage(siteSlug.value, pageSlug.value);
  if (cached) {
    page.value = cached;
    isLoading.value = false;
    isContentLoading.value = false;
    await nextTick(() => {
      // Only force top-scroll when there's no hash to navigate to.
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
  }

  try {
    page.value = await fetchPage(siteSlug.value, pageSlug.value);
    error.value = "";
    await nextTick(() => {
      if (!hasHash) contentRef.value?.scrollTo?.({ top: 0 });
      refreshScrollSpy();
    });
    if (hasHash) await applyHashAfterRender();
  } catch (e: any) {
    error.value = e?.statusMessage || "Page not found";
    if (!keepContent) page.value = null;
  } finally {
    isLoading.value = false;
    isContentLoading.value = false;
  }
}

watch(renderedHtml, () => {
  if (!page.value?.content || isLoading.value) return;
  nextTick(() => refreshScrollSpy());
});

onMounted(load);
watch([siteSlug, pageSlug], load);

// Handle in-page hash changes (e.g. user clicks a #section link while
// already on the page — route params don't change, only the hash does).
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
</style>
