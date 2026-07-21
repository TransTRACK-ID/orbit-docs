<script setup lang="ts">
import DocOutline from "~/components/docs/DocOutline.vue";
import { renderMarkdown } from "~/composables/useMarkdown";
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

async function load() {
  error.value = "";
  teardownScrollSpy();

  const cached = getCachedPage(siteSlug.value, pageSlug.value);
  if (cached) {
    page.value = cached;
    isLoading.value = false;
    isContentLoading.value = false;
    await nextTick(() => {
      contentRef.value?.scrollTo?.({ top: 0 });
      refreshScrollSpy();
    });
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
      contentRef.value?.scrollTo?.({ top: 0 });
      refreshScrollSpy();
    });
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
