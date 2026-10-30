<script setup lang="ts">
import {
  formatTimestamp,
  parseTimestamp,
  videoFileUrl,
  type TranscriptSegment,
  type VideoBlockData,
} from "~/utils/video-block";
import { parseSubtitles } from "~/utils/subtitle-parser";

const props = defineProps<{
  video: VideoBlockData | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", segments: TranscriptSegment[]): void;
}>();

interface Row {
  key: number;
  start: string;
  end: string;
  text: string;
}

let nextKey = 0;
const rows = ref<Row[]>([]);
const touched = ref<Set<string>>(new Set());
const importError = ref("");
const playerRef = ref<HTMLVideoElement | null>(null);
const subtitleInput = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);

function toRow(segment: TranscriptSegment): Row {
  return {
    key: nextKey++,
    start: formatTimestamp(segment.start),
    end: segment.end != null ? formatTimestamp(segment.end) : "",
    text: segment.text,
  };
}

watch(
  () => props.video,
  (video) => {
    touched.value = new Set();
    importError.value = "";
    rows.value = video ? video.segments.map(toRow) : [];
    if (video) nextTick(() => panelRef.value?.focus());
  },
  { immediate: true },
);

function startError(row: Row): string {
  if (!row.start.trim()) return "Enter a start time, for example 01:05";
  return parseTimestamp(row.start) == null ? "Use mm:ss or h:mm:ss, for example 01:05" : "";
}

function endError(row: Row): string {
  if (!row.end.trim()) return "";
  const end = parseTimestamp(row.end);
  if (end == null) return "Use mm:ss or h:mm:ss, for example 01:30";
  const start = parseTimestamp(row.start);
  return start != null && end <= start ? "End must be after the start" : "";
}

function fieldError(row: Row, field: "start" | "end"): string {
  if (!touched.value.has(`${row.key}:${field}`)) return "";
  return field === "start" ? startError(row) : endError(row);
}

function touch(row: Row, field: "start" | "end") {
  touched.value = new Set(touched.value).add(`${row.key}:${field}`);
}

const filledRows = computed(() => rows.value.filter((row) => row.text.trim()));
const hasErrors = computed(() => filledRows.value.some((row) => startError(row) || endError(row)));

function currentTime(): number {
  return Math.floor(playerRef.value?.currentTime ?? 0);
}

function addSegment() {
  const last = rows.value[rows.value.length - 1];
  const fromPlayer = currentTime();
  const lastEnd = last ? parseTimestamp(last.end) ?? parseTimestamp(last.start) : null;
  const start = fromPlayer > 0 ? fromPlayer : lastEnd ?? 0;
  rows.value.push({ key: nextKey++, start: formatTimestamp(start), end: "", text: "" });
  nextTick(() => {
    const textareas = listRef.value?.querySelectorAll<HTMLTextAreaElement>("textarea");
    textareas?.[textareas.length - 1]?.focus();
  });
}

function useCurrentTime(row: Row, field: "start" | "end") {
  row[field] = formatTimestamp(currentTime());
  touch(row, field);
}

function seekTo(row: Row) {
  const seconds = parseTimestamp(row.start);
  if (seconds == null || !playerRef.value) return;
  playerRef.value.currentTime = seconds;
  void playerRef.value.play().catch(() => {});
}

function removeRow(index: number) {
  rows.value.splice(index, 1);
}

async function onSubtitleFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  importError.value = "";
  const segments = parseSubtitles(await file.text());
  if (segments.length === 0) {
    importError.value = `No cues found in ${file.name}. Use an .srt or .vtt subtitle file.`;
    return;
  }
  rows.value = segments.map(toRow);
}

function save() {
  filledRows.value.forEach((row) => {
    touch(row, "start");
    touch(row, "end");
  });
  if (hasErrors.value) return;
  const segments = filledRows.value
    .map((row) => ({
      start: parseTimestamp(row.start)!,
      end: row.end.trim() ? parseTimestamp(row.end) : null,
      text: row.text.trim(),
    }))
    .sort((a, b) => a.start - b.start);
  emit("save", segments);
}

function onKeydown(e: KeyboardEvent) {
  if (!props.video) return;
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    save();
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="drawer-overlay transcript-overlay" :class="{ open: !!video }" @click.self="emit('close')">
      <aside
        v-if="video"
        ref="panelRef"
        class="drawer-panel transcript-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcriptTitle"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <header class="drawer-header">
          <div class="transcript-heading">
            <h2 id="transcriptTitle">Transcript</h2>
            <p :title="video.title">{{ video.title || "Untitled video" }}</p>
          </div>
          <button type="button" class="modal-close" aria-label="Close transcript" @click="emit('close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <div class="transcript-player">
          <video ref="playerRef" :src="videoFileUrl(video.assetId)" controls preload="metadata" />
        </div>

        <div class="drawer-body transcript-body">
          <div class="transcript-toolbar">
            <p class="transcript-hint">
              Each segment is saved in the document with its timestamp, so the assistant can answer
              "at which minute is this explained?"
            </p>
            <input
              ref="subtitleInput"
              type="file"
              accept=".srt,.vtt,text/vtt,application/x-subrip"
              class="sr-only"
              tabindex="-1"
              aria-hidden="true"
              @change="onSubtitleFile"
            />
            <button type="button" class="btn btn-ghost btn-sm" @click="subtitleInput?.click()">
              Import .srt or .vtt
            </button>
          </div>
          <p v-if="importError" class="transcript-error" role="alert">{{ importError }}</p>

          <ol v-if="rows.length" ref="listRef" class="transcript-list">
            <li v-for="(row, index) in rows" :key="row.key" class="transcript-row">
              <div class="transcript-times">
                <div class="transcript-time-field">
                  <label :for="`seg-start-${row.key}`">Start</label>
                  <div class="transcript-time-input">
                    <input
                      :id="`seg-start-${row.key}`"
                      v-model="row.start"
                      class="input"
                      :class="{ 'input-error': fieldError(row, 'start') }"
                      inputmode="numeric"
                      placeholder="00:00"
                      :aria-invalid="!!fieldError(row, 'start')"
                      :aria-describedby="fieldError(row, 'start') ? `seg-start-err-${row.key}` : undefined"
                      @blur="touch(row, 'start')"
                    />
                    <button
                      type="button"
                      class="time-now"
                      :aria-label="`Set start of segment ${index + 1} to the current video time`"
                      title="Use current video time"
                      @click="useCurrentTime(row, 'start')"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    </button>
                  </div>
                </div>
                <div class="transcript-time-field">
                  <label :for="`seg-end-${row.key}`">End</label>
                  <div class="transcript-time-input">
                    <input
                      :id="`seg-end-${row.key}`"
                      v-model="row.end"
                      class="input"
                      :class="{ 'input-error': fieldError(row, 'end') }"
                      inputmode="numeric"
                      placeholder="optional"
                      :aria-invalid="!!fieldError(row, 'end')"
                      :aria-describedby="fieldError(row, 'end') ? `seg-end-err-${row.key}` : undefined"
                      @blur="touch(row, 'end')"
                    />
                    <button
                      type="button"
                      class="time-now"
                      :aria-label="`Set end of segment ${index + 1} to the current video time`"
                      title="Use current video time"
                      @click="useCurrentTime(row, 'end')"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    </button>
                  </div>
                </div>
                <div class="transcript-row-actions">
                  <button type="button" class="row-action" :aria-label="`Play from segment ${index + 1}`" title="Play from here" @click="seekTo(row)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                  </button>
                  <button type="button" class="row-action row-action--danger" :aria-label="`Delete segment ${index + 1}`" title="Delete segment" @click="removeRow(index)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <p v-if="fieldError(row, 'start')" :id="`seg-start-err-${row.key}`" class="transcript-error">{{ fieldError(row, "start") }}</p>
              <p v-if="fieldError(row, 'end')" :id="`seg-end-err-${row.key}`" class="transcript-error">{{ fieldError(row, "end") }}</p>
              <label :for="`seg-text-${row.key}`" class="sr-only">Segment {{ index + 1 }} text</label>
              <textarea
                :id="`seg-text-${row.key}`"
                v-model="row.text"
                class="input transcript-text"
                rows="2"
                placeholder="What is said or shown in this part"
              />
            </li>
          </ol>

          <div v-else class="transcript-empty">
            <p class="transcript-empty-title">No segments yet</p>
            <p>Play the video, pause where a topic starts, then add a segment. Or import an existing subtitle file.</p>
          </div>

          <button type="button" class="btn btn-secondary transcript-add" @click="addSegment">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add segment at current time
          </button>
        </div>

        <footer class="drawer-foot transcript-foot">
          <span class="transcript-count">
            <span class="mono">{{ filledRows.length }}</span> segment{{ filledRows.length === 1 ? "" : "s" }}
          </span>
          <button type="button" class="btn btn-ghost" @click="emit('close')">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="hasErrors" @click="save">Save transcript</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.transcript-overlay {
  z-index: 200;
}

.transcript-panel {
  width: 520px;
}

.transcript-panel:focus {
  outline: none;
}

.transcript-heading {
  min-width: 0;
}

.transcript-heading p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transcript-player {
  flex-shrink: 0;
  background: var(--fg);
}

.transcript-player video {
  display: block;
  width: 100%;
  max-height: 260px;
}

.transcript-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.transcript-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.transcript-hint {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--muted);
  max-width: 44ch;
}

.transcript-toolbar .btn {
  flex-shrink: 0;
}

.transcript-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.transcript-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}

.transcript-row:first-child {
  border-top: 0;
  padding-top: 0;
}

.transcript-times {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.transcript-time-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 124px;
}

.transcript-time-field label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.transcript-time-input {
  position: relative;
}

.transcript-time-input .input {
  padding: 6px 32px 6px 10px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.time-now {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.time-now:hover {
  color: var(--fg);
  background: var(--fg-soft);
}

.transcript-row-actions {
  margin-left: auto;
  display: flex;
  gap: 2px;
}

.row-action {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.row-action:hover {
  color: var(--fg);
  background: var(--fg-soft);
}

.row-action--danger:hover {
  color: var(--error-text);
}

.time-now:focus-visible,
.row-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.transcript-text {
  min-height: 56px;
  font-size: 13.5px;
}

.transcript-error {
  margin: 0;
  font-size: 12px;
  color: var(--error-text);
}

.transcript-empty {
  padding: 8px 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
}

.transcript-empty p {
  margin: 0;
}

.transcript-empty-title {
  margin-bottom: 4px !important;
  font-weight: 600;
  color: var(--fg);
}

.transcript-add {
  align-self: flex-start;
}

.transcript-foot {
  align-items: center;
}

.transcript-count {
  margin-right: auto;
  font-size: 12.5px;
  color: var(--muted);
}

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 600px) {
  .transcript-panel {
    width: 100vw;
    max-width: 100vw;
  }
  .transcript-time-field {
    width: 108px;
  }
}
</style>
