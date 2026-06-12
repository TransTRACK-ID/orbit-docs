import { toast } from "vue3-toastify";
import type {
  InternalFeedbackItem,
  InternalFeedbackStats,
  SubmitInternalFeedbackPayload,
  FeedbackStatus,
} from "~/types";

export const useInternalFeedback = () => {
  const feedbackItems = ref<InternalFeedbackItem[]>([]);
  const stats = ref<InternalFeedbackStats>({ total: 0, open: 0 });
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);

  async function fetchInternalFeedback(query?: {
    search?: string;
    status?: string;
    category?: string;
    limit?: number;
  }) {
    isLoading.value = true;
    try {
      const data = await $fetch<{ data: InternalFeedbackItem[]; stats: InternalFeedbackStats }>(
        "/api/internal-feedback",
        { query: query || undefined }
      );
      feedbackItems.value = data.data;
      stats.value = data.stats;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else if (e?.statusCode === 403) {
        toast.error("You do not have access to internal feedback.");
      } else {
        toast.error("Failed to load internal feedback");
      }
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function submitInternalFeedback(payload: SubmitInternalFeedbackPayload) {
    isSubmitting.value = true;
    try {
      const data = await $fetch<{ data: InternalFeedbackItem }>(
        "/api/internal-feedback",
        { method: "POST", body: payload }
      );
      toast.success("Feedback submitted");
      return data.data;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to submit feedback";
      toast.error(msg);
      throw e;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function updateInternalFeedbackStatus(id: string, status: FeedbackStatus) {
    isUpdating.value = true;
    try {
      const data = await $fetch<{ data: InternalFeedbackItem }>(`/api/internal-feedback/${id}`, {
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
      toast.error(msg);
      throw e;
    } finally {
      isUpdating.value = false;
    }
  }

  async function deleteInternalFeedback(id: string) {
    isDeleting.value = true;
    try {
      await $fetch(`/api/internal-feedback/${id}`, { method: "DELETE" });
      feedbackItems.value = feedbackItems.value.filter((f) => f.id !== id);
      toast.success("Feedback deleted");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to delete feedback";
      toast.error(msg);
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
    fetchInternalFeedback,
    submitInternalFeedback,
    updateInternalFeedbackStatus,
    deleteInternalFeedback,
  };
};
