import type { DocItem } from "~/composables/useDocs";
import type { DocListGroup, DocListView } from "~/utils/doc-display";
import {
  groupDocsForList,
  isFeatureCatalogDoc,
} from "~/utils/doc-display";
import { DOCS_LIST_PAGE_SIZE } from "~/utils/docs-list-constants";

export interface DocsListSummary {
  viewCounts: Record<DocListView, number>;
  apps: { id: string; name: string; count: number }[];
  unboundCount: number;
  workspaceAdrCount: number;
  stats: { total: number; drafts: number; systems: number };
}

export interface AppDocLoadState {
  docs: DocItem[];
  total: number;
  offset: number;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
  error: boolean;
}

export interface DocsPageListFilters {
  search: string;
  appId: string;
  siteId: string;
  status: string;
}

function listQuery(filters: DocsPageListFilters, extra?: Record<string, string | undefined>) {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.appId ? { appId: filters.appId } : {}),
    ...(filters.siteId ? { siteId: filters.siteId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...extra,
  };
}

export function useDocsPageList() {
  const summary = ref<DocsListSummary | null>(null);
  const isSummaryLoading = ref(false);
  const workspaceAdrs = ref<DocItem[]>([]);
  const appLoads = ref<Map<string, AppDocLoadState>>(new Map());

  const knowledgeDocs = ref<DocItem[]>([]);
  const knowledgeTotal = ref(0);
  const knowledgeOffset = ref(0);
  const isKnowledgeLoading = ref(false);
  const isKnowledgeLoadingMore = ref(false);

  async function fetchSummary(view: DocListView, filters: DocsPageListFilters) {
    isSummaryLoading.value = true;
    try {
      const res = await $fetch<{ data: DocsListSummary }>("/api/docs/summary", {
        query: listQuery(filters, { view }),
      });
      summary.value = res.data;
    } catch (e) {
      console.error(e);
      summary.value = null;
    } finally {
      isSummaryLoading.value = false;
    }
  }

  async function fetchWorkspaceAdrs(filters: DocsPageListFilters, includeDraftAdrs: boolean) {
    if (!includeDraftAdrs) {
      try {
        const res = await $fetch<{ data: DocItem[]; total: number }>("/api/docs", {
          query: listQuery(filters, {
            view: "adrs",
            includeContent: "false",
            limit: String(DOCS_LIST_PAGE_SIZE),
            offset: "0",
          }),
        });
        workspaceAdrs.value = res.data.filter((doc) => !doc.appId);
      } catch {
        workspaceAdrs.value = [];
      }
      return;
    }
    try {
      const res = await $fetch<{ data: DocItem[] }>("/api/docs", {
        query: listQuery(filters, {
          view: "adrs",
          includeContent: "false",
        }),
      });
      workspaceAdrs.value = res.data.filter((doc) => !doc.appId);
    } catch {
      workspaceAdrs.value = [];
    }
  }

  function resetAppLoads() {
    appLoads.value = new Map();
  }

  function resetKnowledge() {
    knowledgeDocs.value = [];
    knowledgeTotal.value = 0;
    knowledgeOffset.value = 0;
  }

  async function ensureAppLoaded(
    appId: string,
    view: DocListView,
    filters: DocsPageListFilters,
    includeDraftAdrs: boolean,
  ) {
    const existing = appLoads.value.get(appId);
    if (existing?.loaded || existing?.loading) return;

    const next = new Map(appLoads.value);
    next.set(appId, {
      docs: existing?.docs ?? [],
      total: existing?.total ?? 0,
      offset: 0,
      loading: true,
      loadingMore: false,
      loaded: false,
      error: false,
    });
    appLoads.value = next;

    if (
      (view === "all" || view === "adrs")
      && workspaceAdrs.value.length === 0
      && summary.value?.workspaceAdrCount
    ) {
      await fetchWorkspaceAdrs(filters, includeDraftAdrs);
    }

    try {
      const queryExtra =
        appId === "__unbound__"
          ? { unboundOnly: "true" }
          : { appId };
      const res = await $fetch<{ data: DocItem[]; total: number }>("/api/docs", {
        query: listQuery(filters, {
          ...queryExtra,
          view,
          includeContent: "false",
          limit: String(DOCS_LIST_PAGE_SIZE),
          offset: "0",
        }),
      });
      const updated = new Map(appLoads.value);
      updated.set(appId, {
        docs: res.data,
        total: res.total,
        offset: res.data.length,
        loading: false,
        loadingMore: false,
        loaded: true,
        error: false,
      });
      appLoads.value = updated;
    } catch (e) {
      console.error(e);
      const updated = new Map(appLoads.value);
      updated.set(appId, {
        docs: [],
        total: 0,
        offset: 0,
        loading: false,
        loadingMore: false,
        loaded: false,
        error: true,
      });
      appLoads.value = updated;
    }
  }

  async function loadMoreAppDocs(
    appId: string,
    view: DocListView,
    filters: DocsPageListFilters,
  ) {
    const state = appLoads.value.get(appId);
    if (!state?.loaded || state.loadingMore || state.docs.length >= state.total) return;

    const updated = new Map(appLoads.value);
    updated.set(appId, { ...state, loadingMore: true });
    appLoads.value = updated;

    try {
      const queryExtra =
        appId === "__unbound__"
          ? { unboundOnly: "true" }
          : { appId };
      const res = await $fetch<{ data: DocItem[]; total: number }>("/api/docs", {
        query: listQuery(filters, {
          ...queryExtra,
          view,
          includeContent: "false",
          limit: String(DOCS_LIST_PAGE_SIZE),
          offset: String(state.offset),
        }),
      });
      const merged = new Map(appLoads.value);
      const current = merged.get(appId)!;
      merged.set(appId, {
        ...current,
        docs: [...current.docs, ...res.data],
        total: res.total,
        offset: current.offset + res.data.length,
        loadingMore: false,
      });
      appLoads.value = merged;
    } catch (e) {
      console.error(e);
      const merged = new Map(appLoads.value);
      const current = merged.get(appId)!;
      merged.set(appId, { ...current, loadingMore: false });
      appLoads.value = merged;
    }
  }

  async function fetchKnowledgePage(filters: DocsPageListFilters, reset: boolean) {
    if (reset) {
      knowledgeDocs.value = [];
      knowledgeOffset.value = 0;
    }
    const loadingRef = reset ? isKnowledgeLoading : isKnowledgeLoadingMore;
    loadingRef.value = true;
    try {
      const res = await $fetch<{ data: DocItem[]; total: number }>("/api/docs", {
        query: listQuery(filters, {
          view: "knowledge",
          includeContent: "false",
          limit: String(DOCS_LIST_PAGE_SIZE),
          offset: String(knowledgeOffset.value),
        }),
      });
      knowledgeDocs.value = reset ? res.data : [...knowledgeDocs.value, ...res.data];
      knowledgeTotal.value = res.total;
      knowledgeOffset.value = knowledgeDocs.value.length;
    } catch (e) {
      console.error(e);
      if (reset) {
        knowledgeDocs.value = [];
        knowledgeTotal.value = 0;
      }
    } finally {
      loadingRef.value = false;
    }
  }

  function loadedDocsForGrouping(): DocItem[] {
    const parts: DocItem[] = [];
    for (const state of appLoads.value.values()) {
      parts.push(...state.docs);
    }
    parts.push(...workspaceAdrs.value);
    return parts;
  }

  function buildAccordionGroups(
    allApps: { id: string; name: string }[],
    view: DocListView,
    includeDraftAdrs: boolean,
    appFilter: string,
  ): DocListGroup[] {
    const grouped = groupDocsForList(loadedDocsForGrouping(), view, {
      includeDraftAdrs,
    });
    const byKey = new Map(grouped.map((group) => [group.key, group]));

    const appRows = appFilter
      ? allApps.filter((app) => app.id === appFilter)
      : allApps;

    const result: DocListGroup[] = appRows.map((app) => {
      const existing = byKey.get(app.id);
      if (existing) return existing;
      return { key: app.id, label: app.name, sections: [] };
    });

    if (!appFilter && (summary.value?.unboundCount ?? 0) > 0) {
      const unbound = byKey.get("__unbound__");
      if (unbound) result.push(unbound);
    }

    return result;
  }

  function appDocCount(appId: string, _group: DocListGroup | undefined): number {
    const state = appLoads.value.get(appId);
    if (state && (state.loaded || state.loading)) return state.total;
    return summary.value?.apps.find((row) => row.id === appId)?.count ?? 0;
  }

  function unboundDocCount(group: DocListGroup | undefined): number {
    const state = appLoads.value.get("__unbound__");
    if (state && (state.loaded || state.loading)) return state.total;
    if (group) {
      return group.sections.reduce((sum, section) => sum + section.docs.length, 0);
    }
    return summary.value?.unboundCount ?? 0;
  }

  function patchDocInCaches(doc: DocItem) {
    const next = new Map(appLoads.value);
    for (const [key, state] of next.entries()) {
      const idx = state.docs.findIndex((row) => row.id === doc.id);
      if (idx === -1) continue;
      const docs = [...state.docs];
      docs[idx] = { ...docs[idx], ...doc };
      next.set(key, { ...state, docs });
    }
    appLoads.value = next;
    const kIdx = knowledgeDocs.value.findIndex((row) => row.id === doc.id);
    if (kIdx !== -1) {
      const rows = [...knowledgeDocs.value];
      rows[kIdx] = { ...rows[kIdx], ...doc };
      knowledgeDocs.value = rows;
    }
  }

  function removeDocFromCaches(docId: string) {
    const next = new Map(appLoads.value);
    for (const [key, state] of next.entries()) {
      if (!state.docs.some((row) => row.id === docId)) continue;
      next.set(key, {
        ...state,
        docs: state.docs.filter((row) => row.id !== docId),
        total: Math.max(0, state.total - 1),
      });
    }
    appLoads.value = next;
    knowledgeDocs.value = knowledgeDocs.value.filter((row) => row.id !== docId);
    knowledgeTotal.value = Math.max(0, knowledgeTotal.value - 1);
  }

  function knowledgeCatalogDocs() {
    return knowledgeDocs.value.filter(isFeatureCatalogDoc);
  }

  return {
    summary,
    isSummaryLoading,
    appLoads,
    workspaceAdrs,
    knowledgeDocs,
    knowledgeTotal,
    isKnowledgeLoading,
    isKnowledgeLoadingMore,
    fetchSummary,
    fetchWorkspaceAdrs,
    resetAppLoads,
    resetKnowledge,
    ensureAppLoaded,
    loadMoreAppDocs,
    fetchKnowledgePage,
    buildAccordionGroups,
    appDocCount,
    unboundDocCount,
    patchDocInCaches,
    removeDocFromCaches,
    knowledgeCatalogDocs,
  };
}
