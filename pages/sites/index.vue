<script setup lang="ts">
import { usePageStore } from "~/store/page";
import type { DocSiteItem } from "~/composables/useDocSites";
import { slugify } from "~/utils/nav-client";

definePageMeta({
  auth: true,
  pageTransition: false,
});

const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Doc Sites");
});

const router = useRouter();
const { docSites, isLoading, fetchDocSites, createDocSite, deleteDocSite } = useDocSites();

const searchQuery = ref("");
const showCreateModal = ref(false);
const createForm = reactive({ name: "", slug: "", description: "" });
const createNameError = ref(false);
let prevCreateName = "";

watch(
  () => createForm.name,
  (name) => {
    if (!createForm.slug || createForm.slug === slugify(prevCreateName)) {
      createForm.slug = slugify(name);
    }
    prevCreateName = name;
  },
);
const isDeleting = ref(false);
const siteToDelete = ref<DocSiteItem | null>(null);

onMounted(() => {
  fetchDocSites();
});

const filteredSites = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return docSites.value;
  return docSites.value.filter(
    (s) =>
      s.name.toLowerCase().includes(q)
      || s.slug.toLowerCase().includes(q)
      || (s.description ?? "").toLowerCase().includes(q),
  );
});

function openCreateModal() {
  createForm.name = "";
  createForm.slug = "";
  createForm.description = "";
  createNameError.value = false;
  prevCreateName = "";
  showCreateModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
  createNameError.value = false;
}

async function submitCreate() {
  if (!createForm.name.trim()) {
    createNameError.value = true;
    return;
  }
  try {
    const created = await createDocSite({
      name: createForm.name.trim(),
      slug: createForm.slug.trim() || undefined,
      description: createForm.description.trim() || undefined,
    });
    closeCreateModal();
    router.push(`/sites/${created.id}`);
  } catch {
    // toast handled in composable
  }
}

function confirmDelete(site: DocSiteItem) {
  siteToDelete.value = site;
}

async function doDelete() {
  if (!siteToDelete.value || isDeleting.value) return;
  isDeleting.value = true;
  try {
    await deleteDocSite(siteToDelete.value.id);
  } finally {
    siteToDelete.value = null;
    isDeleting.value = false;
  }
}

const statusClass: Record<string, string> = {
  draft: "pill-blue",
  published: "pill-green",
  archived: "pill-amber",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
</script>

<template>
  <div class="sites-page">
    <header class="topbar">
      <h1>Doc Sites</h1>
      <div style="display:flex;align-items:center;gap:16px;">
        <input
          v-model="searchQuery"
          class="search"
          placeholder="Search doc sites…"
          aria-label="Search doc sites"
        />
        <button type="button" class="btn btn-primary" @click="openCreateModal">
          + New Doc Site
        </button>
      </div>
    </header>

    <div class="row-between" style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <h2>Your doc sites</h2>
        <span v-if="searchQuery" class="result-count">
          {{ filteredSites.length }} result{{ filteredSites.length === 1 ? '' : 's' }}
        </span>
      </div>
    </div>

    <div v-if="isLoading && docSites.length === 0" class="empty-state">
      Loading doc sites…
    </div>

    <div v-else-if="filteredSites.length === 0" class="empty-state">
      <p>No doc sites yet.</p>
      <button type="button" class="btn btn-primary" @click="openCreateModal">
        Create your first doc site
      </button>
    </div>

    <div v-else class="site-grid">
      <NuxtLink
        v-for="site in filteredSites"
        :key="site.id"
        :to="`/sites/${site.id}`"
        class="site-card"
      >
        <div class="site-card-header">
          <div class="site-card-title">{{ site.name }}</div>
          <span class="pill" :class="statusClass[site.status] || 'pill-blue'">
            {{ statusLabel[site.status] || site.status }}
          </span>
        </div>
        <div class="site-card-slug num">/s/{{ site.slug }}</div>
        <div v-if="site.description" class="site-card-desc">{{ site.description }}</div>
        <div class="site-card-meta">
          <span v-if="site.app">{{ site.app.name }}</span>
          <span v-else>Unbound</span>
          <span>· Updated {{ timeAgo(site.updatedAt) }}</span>
        </div>
        <div class="site-card-actions" @click.stop>
          <NuxtLink :to="`/docs?siteId=${site.id}`" class="site-card-action">
            View docs →
          </NuxtLink>
        </div>
      </NuxtLink>
    </div>

    <!-- Create modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <h3>New doc site</h3>
          <p class="modal-desc">A doc site groups multiple docs into one navigable public site.</p>
        </div>
        <div class="form-group">
          <label for="siteName">Name</label>
          <input
            id="siteName"
            v-model="createForm.name"
            class="input"
            :class="{ 'input-error': createNameError }"
            placeholder="e.g. Postrack Docs"
          />
        </div>
        <div class="form-group">
          <label for="siteSlug">Slug <span class="opt">(auto from name)</span></label>
          <input
            id="siteSlug"
            v-model="createForm.slug"
            class="input"
            placeholder="Auto-generated from name"
          />
        </div>
        <div class="form-group">
          <label for="siteDesc">Description (optional)</label>
          <input
            id="siteDesc"
            v-model="createForm.description"
            class="input"
            placeholder="Short description"
          />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="closeCreateModal">Cancel</button>
          <button type="button" class="btn btn-primary" @click="submitCreate">Create</button>
        </div>
      </div>
    </div>

    <!-- Delete modal -->
    <div v-if="siteToDelete" class="modal-overlay" @click="siteToDelete = null">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <h3>Delete doc site</h3>
          <p class="modal-desc">
            Delete <strong>{{ siteToDelete.name }}</strong>? Docs in this site will be unbound, not deleted.
          </p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="siteToDelete = null">Cancel</button>
          <button type="button" class="btn btn-danger" :disabled="isDeleting" @click="doDelete">
            <span v-if="isDeleting">Deleting…</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
