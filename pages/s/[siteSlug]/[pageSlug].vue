<script setup lang="ts">
import PublicSiteNav from "~/components/docs/PublicSiteNav.vue";
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
const { fetchPage } = usePublicSite();

const siteSlug = computed(() => route.params.siteSlug as string);
const pageSlug = computed(() => route.params.pageSlug as string);

const page = ref<any>(null);
const isLoading = ref(true);
const error = ref("");
const contentRef = ref<HTMLElement | null>(null);

const sitePages = computed(() => page.value?.site?.pages || []);
const openapiOps = computed(() => {
  const fromNav = page.value?.site?.navConfig?.openapi;
  if (fromNav?.length) return fromNav;
  return page.value?.site?.openapiNormalized?.operations || [];
});

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
  isLoading.value = true;
  error.value = "";
  page.value = null;
  teardownScrollSpy();
  try {
    page.value = await fetchPage(siteSlug.value, pageSlug.value);
  } catch (e: any) {
    error.value = e?.statusMessage || "Page not found";
  } finally {
    isLoading.value = false;
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
  <div class="doc-reader-page">
    <div v-if="isLoading" class="ps-loading">Loading…</div>

    <div v-else-if="error" class="ps-error">
      <h1>{{ error }}</h1>
      <p>The page you are looking for could not be loaded.</p>
    </div>

    <div v-else-if="page" class="doc-shell">
      <aside class="doc-sidebar">
        <div class="doc-sidebar-header">
          <NuxtLink :to="`/s/${siteSlug}`" class="doc-sidebar-title">{{ page.site.name }}</NuxtLink>
          <p v-if="page.site.app" class="doc-sidebar-meta">{{ page.site.app.name }}</p>
        </div>
        <div class="doc-sidebar-nav">
          <PublicSiteNav
            :nav-config="page.site.navConfig"
            :site-slug="siteSlug"
            :pages="sitePages"
            :openapi-operations="openapiOps"
            :active-page-slug="pageSlug as string"
          />
        </div>
      </aside>

      <main ref="contentRef" class="doc-content">
        <article id="docContent" :class="bodyClass">
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
    </div>
  </div>
</template>
