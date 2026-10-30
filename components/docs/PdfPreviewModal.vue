<script setup lang="ts">
import { publicPdfShareUrl, type DocAsset } from "~/composables/useDocAssets";

const props = defineProps<{
  asset: DocAsset | null;
  canEdit: boolean;
  isSharing?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "toggle-share", value: boolean): void;
}>();

const copied = ref(false);
const closeRef = ref<HTMLButtonElement | null>(null);

watch(
  () => props.asset?.id,
  (id) => {
    copied.value = false;
    if (id) nextTick(() => closeRef.value?.focus());
  },
);
const shareUrl = computed(() =>
  props.asset?.shareEnabled && props.asset.shareToken ? publicPdfShareUrl(props.asset.shareToken) : "",
);

async function copyLink() {
  if (!shareUrl.value) return;
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // clipboard unavailable; the URL stays selectable
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.asset) emit("close");
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
  <div
    class="modal-overlay pdf-overlay"
    :class="{ open: !!asset }"
    @click.self="emit('close')"
  >
    <div
      v-if="asset"
      class="modal pdf-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdfPreviewTitle"
    >
      <div class="modal-header">
        <h2 id="pdfPreviewTitle" class="pdf-title" :title="asset.fileName">{{ asset.title }}</h2>
        <div class="pdf-header-actions">
          <a class="btn btn-ghost btn-sm" :href="`${asset.url}?download=1`">Download PDF</a>
          <button ref="closeRef" type="button" class="modal-close" aria-label="Close preview" @click="emit('close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div class="pdf-frame-wrap">
        <iframe :src="asset.url" class="pdf-frame" :title="`Preview of ${asset.title}`" />
      </div>

      <div v-if="canEdit" class="pdf-share">
        <div class="pdf-share-row">
          <div class="pdf-share-copy">
            <span class="pdf-share-label">Public link</span>
            <span class="pdf-share-desc">
              {{ asset.shareEnabled ? "Anyone with the link can view and download this PDF." : "Only people in this workspace can open it." }}
            </span>
          </div>
          <button
            type="button"
            class="share-switch"
            :class="{ on: asset.shareEnabled }"
            role="switch"
            :aria-checked="asset.shareEnabled"
            aria-label="Toggle public link"
            :disabled="isSharing"
            @click="emit('toggle-share', !asset.shareEnabled)"
          >
            <span class="share-switch-thumb" />
          </button>
        </div>
        <div v-if="shareUrl" class="pdf-share-url-row">
          <code class="pdf-share-url">{{ shareUrl }}</code>
          <button type="button" class="btn btn-secondary btn-sm" @click="copyLink">
            {{ copied ? "Copied" : "Copy link" }}
          </button>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.pdf-modal {
  width: min(1040px, 94vw);
  max-width: 94vw;
  height: 90vh;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pdf-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.pdf-frame-wrap {
  flex: 1;
  min-height: 0;
  background: var(--bg);
}

.pdf-frame {
  width: 100%;
  height: 100%;
  border: 0;
}

.pdf-share {
  border-top: 1px solid var(--border);
  padding: 14px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pdf-share-row,
.pdf-share-url-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pdf-share-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pdf-share-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
}

.pdf-share-desc {
  font-size: 12.5px;
  color: var(--muted);
}

.pdf-share-url {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: all;
}

.share-switch {
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--fg-soft);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.share-switch.on {
  background: var(--accent);
  border-color: var(--accent);
}

.share-switch:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.share-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface);
  transition: transform 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.share-switch.on .share-switch-thumb {
  transform: translateX(18px);
}

.share-switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
