import { toast } from "vue3-toastify";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export const useDocChat = () => {
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  function generateId() {
    return Math.random().toString(36).substring(2, 15);
  }

  async function sendMessage(content: string, docId?: string) {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    messages.value.push(userMessage);
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch("/api/chat", {
        method: "POST",
        body: {
          messages: messages.value.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          docId: docId || undefined,
        },
      });

      // For streaming response, the response will be a stream
      // But $fetch doesn't handle streams well for text/event-stream
      // We'll handle the streaming via the UI component using fetch directly

      return response;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to send message";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      error.value = msg;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function clearMessages() {
    messages.value = [];
    error.value = null;
  }

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
};
