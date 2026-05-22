import { toast } from "vue3-toastify";

export interface AppItem {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  status: "active" | "draft" | "maintenance";
  repoUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  latestVersion: {
    id: string;
    version: string;
    status: string;
    createdBy: string | null;
  } | null;
}

export interface AppStats {
  activeApps: number;
  totalVersions: number;
  publishedDocs: number;
  draftVersions: number;
}

export interface ActivityLog {
  id: string;
  appId: string | null;
  appName: string | null;
  action: string;
  actor: string;
  createdAt: string | null;
}

export interface AppVersion {
  id: string;
  appId: string;
  version: string;
  status: "draft" | "published" | "rc";
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateAppPayload {
  name: string;
  description?: string;
  owner?: string;
  status?: string;
  repoUrl?: string;
}

export const useApps = () => {
  const apps = ref<AppItem[]>([]);
  const stats = ref<AppStats | null>(null);
  const activities = ref<ActivityLog[]>([]);
  const isLoading = ref(false);
  const isCreating = ref(false);
  const search = ref("");

  async function fetchApps() {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: AppItem[] }>("/api/apps", {
        query: search.value ? { search: search.value } : undefined,
      });
      apps.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load apps");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchApp(id: string) {
    try {
      const data = await $fetch<{ data: AppItem }>(`/api/apps/${id}`);
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load app");
      }
      console.error(e);
      throw e;
    }
  }

  async function fetchAppVersions(id: string) {
    try {
      const data = await $fetch<{ data: AppVersion[] }>(`/api/apps/${id}/versions`);
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load versions");
      }
      console.error(e);
      throw e;
    }
  }

  async function fetchStats() {
    try {
      const data = await $fetch<{ data: AppStats }>("/api/apps/stats");
      stats.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        navigateTo("/login");
      }
      console.error(e);
    }
  }

  async function fetchActivities() {
    try {
      const data = await $fetch<{ data: ActivityLog[] }>("/api/apps/activity", {
        query: { limit: "10" },
      });
      activities.value = data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        navigateTo("/login");
      }
      console.error(e);
    }
  }

  async function createApp(payload: CreateAppPayload) {
    isCreating.value = true;
    try {
      const data = await $fetch<{ data: AppItem }>("/api/apps", {
        method: "POST",
        body: payload,
      });
      apps.value.unshift({
        ...data.data,
        latestVersion: null,
      });
      toast.success(`App "${data.data.name}" created`);
      await Promise.all([fetchStats(), fetchActivities()]);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to create app";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isCreating.value = false;
    }
  }

  async function updateApp(id: string, payload: CreateAppPayload) {
    try {
      const data = await $fetch<{ data: AppItem }>(`/api/apps/${id}`, {
        method: "PUT",
        body: payload,
      });
      const idx = apps.value.findIndex((a) => a.id === id);
      if (idx !== -1) {
        apps.value[idx] = { ...apps.value[idx], ...data.data };
      }
      toast.success(`App "${data.data.name}" updated`);
      await Promise.all([fetchStats(), fetchActivities()]);
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update app";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function deleteApp(id: string) {
    try {
      await $fetch(`/api/apps/${id}`, {
        method: "DELETE",
      });
      apps.value = apps.value.filter((a) => a.id !== id);
      toast.success("App deleted");
      await Promise.all([fetchStats(), fetchActivities()]);
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete app";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  return {
    apps,
    stats,
    activities,
    isLoading,
    isCreating,
    search,
    fetchApps,
    fetchApp,
    fetchAppVersions,
    fetchStats,
    fetchActivities,
    createApp,
    updateApp,
    deleteApp,
  };
};
