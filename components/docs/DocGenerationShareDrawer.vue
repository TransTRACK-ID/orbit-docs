<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  shareEnabled: boolean;
  shareToken: string | null;
  shareUrl: string;
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "enable"): void;
  (e: "disable"): void;
}>();

const copied = ref(false);

function close() {
  emit("update:open", false);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.shareUrl);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // ignore
  }
}
</script>

<template>
  <div class="share-modal" :class="{ open }" role="dialog" aria-modal="true" aria-labelledby="shareGenTitle" @click.self="close">
    <div class="share-drawer">
      <div class="share-header">
        <h3 id="shareGenTitle">Share generation session</h3>
        <button type="button" class="btn btn-ghost share-close" aria-label="Close" @click="close">×</button>
      </div>

      <div class="share-body">
        <p class="share-desc">
          Anyone with the link can view this generation session read-only. Comments stay visible to your team in Orbit.
        </p>

        <div class="share-toggle-row">
          <div>
            <span class="share-toggle-label">Public link</span>
            <span class="share-toggle-desc">{{ shareEnabled ? "Link is active" : "Link is disabled" }}</span>
          </div>
          <button
            type="button"
            class="share-toggle"
            :class="{ on: shareEnabled }"
            role="switch"
            :aria-checked="shareEnabled"
            :disabled="isSaving"
            @click="shareEnabled ? emit('disable') : emit('enable')"
          >
            <span class="share-toggle-thumb" />
          </button>
        </div>

        <div v-if="shareEnabled && shareToken" class="share-preview">
          <label>Share URL</label>
          <div class="share-copy-row">
            <code class="share-url">{{ shareUrl }}</code>
            <button type="button" class="btn btn-secondary btn-sm" @click="copyLink">
              {{ copied ? "Copied" : "Copy" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-modal {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: color-mix(in oklch, var(--fg) 25%, transparent);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.share-modal.open {
  opacity: 1;
  pointer-events: auto;
}

.share-drawer {
  width: min(480px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  transform: translateY(100%);
  transition: transform 0.22s cubic-bezier(0.25, 1, 0.5, 1);
}

.share-modal.open .share-drawer {
  transform: translateY(0);
}

.share-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.share-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.share-close {
  font-size: 22px;
  line-height: 1;
  padding: 4px 8px;
}

.share-body {
  padding: 16px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
}

.share-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--fg) 2%, var(--surface));
}

.share-toggle-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.share-toggle-desc {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
}

.share-toggle {
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in oklch, var(--fg) 10%, var(--bg));
  padding: 2px;
  cursor: pointer;
  flex-shrink: 0;
}

.share-toggle.on {
  background: var(--accent);
  border-color: var(--accent);
}

.share-toggle-thumb {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--surface);
  transition: transform 0.15s cubic-bezier(0.25, 1, 0.5, 1);
}

.share-toggle.on .share-toggle-thumb {
  transform: translateX(20px);
}

.share-preview label {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.share-copy-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.share-url {
  flex: 1;
  display: block;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.4;
  word-break: break-all;
  color: var(--fg);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--muted);
}

.btn-secondary {
  background: color-mix(in oklch, var(--fg) 8%, transparent);
  color: var(--fg);
  border-color: var(--border);
}

.btn-ghost:hover {
  color: var(--fg);
}

.btn-sm {
  padding: 6px 10px;
}
</style>
