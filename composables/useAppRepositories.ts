import { toast } from "vue3-toastify";

export interface AppRepository {
  id: string;
  appId: string;
  name: string;
  repoUrl: string;
  provider: "github" | "gitlab";
  /** Non-null for self-hosted GitLab / GitHub Enterprise, e.g. https://gitlab.myco.com */
  hostUrl?: string | null;
  defaultBranch: string;
  sddDocPath: string;
  hasAccessToken: boolean;
  accessTokenPreview?: string | null;
  lastProcessedRef?: string | null;
  webhookUrl?: string;
  webhookSecret?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RepositoryPayload {
  name?: string;
  repoUrl: string;
  provider?: "github" | "gitlab";
  /** Custom host for self-hosted GitLab / GitHub Enterprise */
  hostUrl?: string | null;
  defaultBranch?: string;
  accessToken?: string | null;
  sddDocPath?: string;
}

export const useAppRepositories = () => {
  const repositories = ref<AppRepository[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);

  async function fetchRepositories(appId: string) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: AppRepository[] }>(
        `/api/apps/${appId}/repositories`
      );
      repositories.value = data.data;
      return data.data;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load repositories");
      }
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function addRepository(appId: string, payload: RepositoryPayload) {
    isSaving.value = true;
    try {
      const data = await $fetch<{ data: AppRepository }>(
        `/api/apps/${appId}/repositories`,
        { method: "POST", body: payload }
      );
      repositories.value.push(data.data);
      toast.success("Repository added");
      return data.data;
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to add repository");
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function updateRepository(
    appId: string,
    repoId: string,
    payload: Partial<RepositoryPayload>
  ) {
    isSaving.value = true;
    try {
      const data = await $fetch<{ data: AppRepository }>(
        `/api/apps/${appId}/repositories/${repoId}`,
        { method: "PUT", body: payload }
      );
      const idx = repositories.value.findIndex((r) => r.id === repoId);
      if (idx !== -1) {
        repositories.value[idx] = { ...repositories.value[idx], ...data.data };
      }
      toast.success("Repository updated");
      return data.data;
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to update repository");
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function removeRepository(appId: string, repoId: string) {
    try {
      await $fetch(`/api/apps/${appId}/repositories/${repoId}`, {
        method: "DELETE",
      });
      repositories.value = repositories.value.filter((r) => r.id !== repoId);
      toast.success("Repository removed");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to remove repository");
      throw e;
    }
  }

  return {
    repositories,
    isLoading,
    isSaving,
    fetchRepositories,
    addRepository,
    updateRepository,
    removeRepository,
  };
};
