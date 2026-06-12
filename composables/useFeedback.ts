import { toast } from "vue3-toastify";
import type { FeedbackItem, FeedbackStats, SubmitDocFeedbackPayload } from "~/types";

const VISITOR_ID_KEY = "od_feedback_visitor_id";

export function getFeedbackVisitorId(): string {
  if (!import.meta.client) return "";
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export const useFeedback = () => {
  const feedbackItems = ref<FeedbackItem[]>([]);
  const stats = ref<FeedbackStats>({ total: 0, helpful: 0, notHelpful: 0, open: 0 });
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);

  async function fetchFeedback(query?: {
    search?: string;
    app?: string;
    status?: string;
    helpful?: string;
    limit?: number;
  }) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: FeedbackItem[]; stats: FeedbackStats }>("/api/feedback", {
        query: query || undefined,
      });
      feedbackItems.value = data.data;
      stats.value = data.stats;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load feedback");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function checkDocFeedbackStatus(docId: string, visitorId: string) {
    try {
      const data = await $fetch<{
        data: { submitted: boolean; feedback: { helpful: boolean; comment: string | null } | null };
      }>(`/api/published-docs/${docId}/feedback`, {
        query: { visitorId },
      });
      return data.data;
    } catch {
      return { submitted: false, feedback: null };
    }
  }

  async function submitDocFeedback(docId: string, payload: SubmitDocFeedbackPayload) {
    isSubmitting.value = true;
    try {
      const data = await $fetch<{ data: FeedbackItem; alreadySubmitted?: boolean }>(
        `/api/published-docs/${docId}/feedback`,
        {
          method: "POST",
          body: payload,
        }
      );
      return data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to submit feedback";
      toast.error(msg);
      throw e;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function updateFeedbackStatus(id: string, status: FeedbackItem["status"]) {
    isUpdating.value = true;
    try {
      const data = await $fetch<{ data: FeedbackItem }>(`/api/feedback/${id}`, {
        method: "PATCH",
        body: { status },
      });
      const idx = feedbackItems.value.findIndex((f) => f.id === id);
      if (idx !== -1) {
        feedbackItems.value[idx] = { ...feedbackItems.value[idx], ...data.data };
      }
      toast.success("Feedback updated");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update feedback";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isUpdating.value = false;
    }
  }

  async function deleteFeedback(id: string) {
    isDeleting.value = true;
    try {
      await $fetch(`/api/feedback/${id}`, { method: "DELETE" });
      feedbackItems.value = feedbackItems.value.filter((f) => f.id !== id);
      toast.success("Feedback deleted");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete feedback";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    feedbackItems,
    stats,
    isLoading,
    isSubmitting,
    isUpdating,
    isDeleting,
    fetchFeedback,
    checkDocFeedbackStatus,
    submitDocFeedback,
    updateFeedbackStatus,
    deleteFeedback,
    getFeedbackVisitorId,
  };
};
