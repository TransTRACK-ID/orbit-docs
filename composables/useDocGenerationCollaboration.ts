import { toast } from "vue3-toastify";

export type GenerationReviewStatus = "in_review" | "approved" | "changes_requested";
export type GenerationCommentStatus = "open" | "resolved";

export interface GenerationComment {
  id: string;
  jobId: string;
  docKey: string;
  authorId: string | null;
  authorName: string;
  body: string;
  quote: string | null;
  status: GenerationCommentStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GenerationReview {
  docKey: string;
  status: GenerationReviewStatus;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface GenerationShareState {
  shareEnabled: boolean;
  shareToken: string | null;
  sharedAt: string | null;
  canShare: boolean;
}

export function useDocGenerationCollaboration(appId: Ref<string>, jobId: Ref<string | null>) {
  const comments = ref<GenerationComment[]>([]);
  const reviews = ref<GenerationReview[]>([]);
  const share = ref<GenerationShareState | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);

  async function fetchCollaboration() {
    if (!jobId.value) return;
    isLoading.value = true;
    try {
      const [commentsRes, reviewsRes, shareRes] = await Promise.all([
        $fetch<{ data: GenerationComment[] }>(
          `/api/apps/${appId.value}/generate-docs/${jobId.value}/comments`
        ),
        $fetch<{ data: GenerationReview[] }>(
          `/api/apps/${appId.value}/generate-docs/${jobId.value}/reviews`
        ),
        $fetch<{ data: GenerationShareState }>(
          `/api/apps/${appId.value}/generate-docs/${jobId.value}/share`
        ),
      ]);
      comments.value = commentsRes.data;
      reviews.value = reviewsRes.data;
      share.value = shareRes.data;
    } catch (e: any) {
      if (e?.statusCode !== 401) {
        toast.error("Failed to load review data");
      }
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  watch(
    jobId,
    (id) => {
      if (id) fetchCollaboration();
      else {
        comments.value = [];
        reviews.value = [];
        share.value = null;
      }
    },
    { immediate: true }
  );

  function reviewForDoc(docKey: string): GenerationReviewStatus {
    return reviews.value.find((r) => r.docKey === docKey)?.status || "in_review";
  }

  function commentsForDoc(docKey: string) {
    return comments.value.filter((c) => c.docKey === docKey);
  }

  function openCommentCount(docKey: string) {
    return commentsForDoc(docKey).filter((c) => c.status === "open").length;
  }

  async function addComment(docKey: string, text: string, quote?: string | null) {
    if (!jobId.value) return;
    isSaving.value = true;
    try {
      const { data } = await $fetch<{ data: GenerationComment }>(
        `/api/apps/${appId.value}/generate-docs/${jobId.value}/comments`,
        { method: "POST", body: { docKey, text, quote } }
      );
      comments.value = [data, ...comments.value];
      toast.success("Comment added");
      return data;
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to add comment");
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function setCommentStatus(commentId: string, status: GenerationCommentStatus) {
    if (!jobId.value) return;
    const { data } = await $fetch<{ data: GenerationComment }>(
      `/api/apps/${appId.value}/generate-docs/${jobId.value}/comments/${commentId}`,
      { method: "PATCH", body: { status } }
    );
    const idx = comments.value.findIndex((c) => c.id === commentId);
    if (idx !== -1) comments.value[idx] = data;
  }

  async function setReviewStatus(docKey: string, status: GenerationReviewStatus) {
    if (!jobId.value) return;
    isSaving.value = true;
    try {
      const { data } = await $fetch<{ data: GenerationReview & { docKey: string } }>(
        `/api/apps/${appId.value}/generate-docs/${jobId.value}/reviews`,
        { method: "PUT", body: { docKey, status } }
      );
      const idx = reviews.value.findIndex((r) => r.docKey === docKey);
      const entry: GenerationReview = {
        docKey: data.docKey,
        status: data.status as GenerationReviewStatus,
        updatedBy: data.updatedBy,
        updatedAt: data.updatedAt as string | null,
      };
      if (idx === -1) reviews.value.push(entry);
      else reviews.value[idx] = entry;
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to update review status");
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  async function enableShare() {
    if (!jobId.value) return;
    const { data } = await $fetch<{ data: GenerationShareState }>(
      `/api/apps/${appId.value}/generate-docs/${jobId.value}/share`,
      { method: "POST" }
    );
    share.value = { ...share.value, ...data, canShare: true } as GenerationShareState;
    toast.success("Share link enabled");
    return data;
  }

  async function disableShare() {
    if (!jobId.value) return;
    await $fetch(`/api/apps/${appId.value}/generate-docs/${jobId.value}/share`, {
      method: "DELETE",
    });
    if (share.value) share.value.shareEnabled = false;
    toast.success("Share link disabled");
  }

  function buildShareUrl(token: string) {
    const config = useRuntimeConfig();
    const base = (config.app?.baseURL as string) || "/";
    const path = `${base.replace(/\/$/, "")}/docs/generate/share/${token}`;
    if (import.meta.client) {
      return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
    }
    return path;
  }

  return {
    comments,
    reviews,
    share,
    isLoading,
    isSaving,
    fetchCollaboration,
    reviewForDoc,
    commentsForDoc,
    openCommentCount,
    addComment,
    setCommentStatus,
    setReviewStatus,
    enableShare,
    disableShare,
    buildShareUrl,
  };
}
