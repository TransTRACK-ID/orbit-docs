<script setup lang="ts">
import { renderMarkdown } from "~/composables/useMarkdown";
import { nextTick } from "vue";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const props = defineProps<{
  docId?: string;
  docContent?: string;
  docTitle?: string;
}>();

const emit = defineEmits<{ close: [] }>();

const messages = ref<ChatMessage[]>([]);
const inputValue = ref("");
const isStreaming = ref(false);
const chatContainer = ref<HTMLDivElement | null>(null);
const bottomAnchor = ref<HTMLDivElement | null>(null);
const abortController = ref<AbortController | null>(null);

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function scrollToBottom() {
  nextTick(() => {
    bottomAnchor.value?.scrollIntoView({ behavior: "smooth", block: "end" });
  });
}

async function sendMessage() {
  const content = inputValue.value.trim();
  if (!content || isStreaming.value) return;

  const userMessage: ChatMessage = {
    id: generateId(),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };

  messages.value.push(userMessage);
  inputValue.value = "";
  scrollToBottom();

  isStreaming.value = true;

  const assistantMessage: ChatMessage = {
    id: generateId(),
    role: "assistant",
    content: "",
    createdAt: new Date().toISOString(),
  };

  messages.value.push(assistantMessage);

  try {
    abortController.value = new AbortController();

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages.value
          .filter((m) => m.content)
          .map((m) => ({
            role: m.role,
            content: m.content,
          })),
        docId: props.docId,
        docContent: props.docContent,
        docTitle: props.docTitle,
      }),
      signal: abortController.value.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // toTextStreamResponse() emits raw plain text — append directly
      assistantMessage.content += decoder.decode(value, { stream: true });
      scrollToBottom();
    }
  } catch (e: any) {
    if (e.name !== "AbortError") {
      assistantMessage.content = "Sorry, I encountered an error. Please try again.";
    }
  } finally {
    isStreaming.value = false;
    abortController.value = null;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function clearChat() {
  messages.value = [];
}

function closeChat() {
  if (abortController.value) {
    abortController.value.abort();
  }
  emit("close");
}
</script>

<template>
  <div class="chat-widget">
    <div class="chat-header">
      <div class="chat-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3 3 3 0 0 0 3-3V5a3 3 0 0 0-3-3Z"/>
          <path d="M12 9h.01"/>
        </svg>
        <span>AI Assistant</span>
      </div>
      <div class="chat-actions">
        <button v-if="messages.length > 0" type="button" class="chat-btn" title="Clear chat" @click="clearChat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <button type="button" class="chat-btn" title="Close" @click="closeChat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <div ref="chatContainer" class="chat-messages">
      <div v-if="messages.length === 0" class="chat-empty">
        <div class="chat-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3 3 3 0 0 0 3-3V5a3 3 0 0 0-3-3Z"/>
            <path d="M12 9h.01"/>
          </svg>
        </div>
        <p>Ask me anything about this document</p>
        <div class="chat-suggestions">
          <button v-if="docTitle" type="button" class="suggestion" @click="inputValue = `What is ${docTitle} about?`">
            What is this about?
          </button>
          <button type="button" class="suggestion" @click="inputValue = 'Summarize the key points'">
            Summarize key points
          </button>
          <button type="button" class="suggestion" @click="inputValue = 'Explain the technical details'">
            Explain technical details
          </button>
        </div>
      </div>

      <div
        v-for="message in messages"
        :key="message.id"
        class="chat-message"
        :class="{ 'chat-message-user': message.role === 'user', 'chat-message-assistant': message.role === 'assistant' }"
      >
        <div class="chat-avatar">
          <svg v-if="message.role === 'user'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3 3 3 0 0 0 3-3V5a3 3 0 0 0-3-3Z"/>
            <path d="M12 9h.01"/>
          </svg>
        </div>
        <div class="chat-bubble">
          <div v-if="message.role === 'assistant' && !isStreaming" class="chat-content" v-html="renderMarkdown(message.content)" />
          <div v-else class="chat-content">{{ message.content }}</div>
          <div v-if="message.role === 'assistant' && isStreaming && message === messages[messages.length - 1]" class="chat-typing">
            <span class="typing-dot" />
            <span class="typing-dot" />
            <span class="typing-dot" />
          </div>
        </div>
      </div>
      <div ref="bottomAnchor" style="float: left; clear: both" />
    </div>

    <div class="chat-input-area">
      <textarea
        v-model="inputValue"
        class="chat-input"
        placeholder="Ask a question..."
        rows="1"
        @keydown="handleKeydown"
      />
      <button
        type="button"
        class="chat-send"
        :disabled="!inputValue.trim() || isStreaming"
        @click="sendMessage"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-widget {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
}

.chat-actions {
  display: flex;
  gap: 4px;
}

.chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.chat-btn:hover {
  color: var(--fg);
  border-color: var(--fg);
  background: var(--fg-soft);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 0;
  text-align: center;
  color: var(--muted);
}

.chat-empty-icon {
  color: var(--accent);
  opacity: 0.6;
}

.chat-empty p {
  margin: 0;
  font-size: 14px;
}

.chat-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.suggestion {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--fg);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: left;
}

.suggestion:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.chat-message {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.chat-message-user {
  flex-direction: row-reverse;
}

.chat-message-user .chat-bubble {
  background: var(--accent);
  color: var(--surface);
}

.chat-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--fg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--muted);
}

.chat-bubble {
  padding: 10px 14px;
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--fg);
  font-size: 13px;
  line-height: 1.5;
  max-width: calc(100% - 40px);
  word-break: break-word;
}

.chat-content :deep(p) {
  margin: 0 0 8px;
}

.chat-content :deep(p:last-child) {
  margin-bottom: 0;
}

.chat-content :deep(code) {
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.chat-content :deep(pre) {
  background: var(--surface);
  padding: 10px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin: 8px 0;
}

.chat-content :deep(pre code) {
  background: none;
  padding: 0;
}

.chat-content :deep(ul),
.chat-content :deep(ol) {
  padding-left: 16px;
  margin: 8px 0;
}

.chat-content :deep(li) {
  margin: 4px 0;
}

.chat-typing {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-top: 4px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted);
  animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.chat-input-area {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}

.chat-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  resize: none;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-height: 36px;
  max-height: 120px;
}

.chat-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.chat-send {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.chat-send:hover {
  background: color-mix(in oklch, var(--accent) 88%, black);
  border-color: color-mix(in oklch, var(--accent) 88%, black);
}

.chat-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
