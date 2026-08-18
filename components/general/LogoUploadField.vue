<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string;
    inputId?: string;
    label?: string;
    optionalLabel?: string;
    urlPlaceholder?: string;
    dropHint?: string;
    browseLabel?: string;
    removeLabel?: string;
    urlLabel?: string;
    disabled?: boolean;
  }>(),
  {
    inputId: "logo-upload",
    label: "Logo",
    optionalLabel: "(optional)",
    urlPlaceholder: "https://cdn.example.com/logo.svg",
    dropHint: "Drop an image here, or",
    browseLabel: "browse",
    removeLabel: "Remove",
    urlLabel: "Or paste a URL",
    disabled: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { uploadLogo, isUploading } = useLogoUpload();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
const previewError = ref(false);
const uploadError = ref("");

const previewUrl = computed(() => props.modelValue.trim());

watch(
  () => props.modelValue,
  () => {
    previewError.value = false;
  }
);

function updateValue(value: string) {
  emit("update:modelValue", value);
}

function openFilePicker() {
  if (props.disabled || isUploading.value) return;
  fileInputRef.value?.click();
}

async function handleFiles(files: FileList | File[] | null | undefined) {
  const file = files?.[0];
  if (!file || props.disabled || isUploading.value) return;

  uploadError.value = "";
  try {
    const url = await uploadLogo(file);
    updateValue(url);
  } catch (error: any) {
    uploadError.value = error?.message || "Upload failed";
  }
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  void handleFiles(input.files);
  input.value = "";
}

function onDragEnter(event: DragEvent) {
  event.preventDefault();
  if (props.disabled || isUploading.value) return;
  isDragOver.value = true;
}

function onDragOver(event: DragEvent) {
  event.preventDefault();
  if (props.disabled || isUploading.value) return;
  isDragOver.value = true;
}

function onDragLeave(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = false;
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = false;
  if (props.disabled || isUploading.value) return;
  void handleFiles(event.dataTransfer?.files);
}

function clearLogo() {
  if (props.disabled || isUploading.value) return;
  uploadError.value = "";
  previewError.value = false;
  updateValue("");
}
</script>

<template>
  <div class="logo-upload-field">
    <label v-if="label" :for="`${inputId}-url`" class="logo-upload-field__label">
      {{ label }}
      <span v-if="optionalLabel" class="logo-upload-field__opt">{{ optionalLabel }}</span>
    </label>

    <div class="logo-upload-field__body">
      <div
        class="logo-upload-field__preview"
        :class="{ 'logo-upload-field__preview--empty': !previewUrl || previewError }"
        aria-hidden="true"
      >
        <img
          v-if="previewUrl && !previewError"
          :src="previewUrl"
          alt=""
          class="logo-upload-field__preview-img"
          @error="previewError = true"
        />
        <span v-else class="logo-upload-field__preview-placeholder">Logo</span>
      </div>

      <div class="logo-upload-field__controls">
        <button
          type="button"
          class="logo-upload-field__dropzone"
          :class="{
            'logo-upload-field__dropzone--active': isDragOver,
            'logo-upload-field__dropzone--disabled': disabled || isUploading,
          }"
          :disabled="disabled || isUploading"
          @click="openFilePicker"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <span v-if="isUploading" class="logo-upload-field__dropzone-text">Uploading…</span>
          <span v-else class="logo-upload-field__dropzone-text">
            {{ dropHint }}
            <span class="logo-upload-field__browse">{{ browseLabel }}</span>
          </span>
          <span class="logo-upload-field__dropzone-meta">PNG, JPG, GIF, WebP, SVG · max 2 MB</span>
        </button>

        <input
          ref="fileInputRef"
          type="file"
          class="logo-upload-field__file-input"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg"
          :disabled="disabled || isUploading"
          @change="onFileInputChange"
        />

        <div v-if="previewUrl" class="logo-upload-field__actions">
          <button
            type="button"
            class="logo-upload-field__remove"
            :disabled="disabled || isUploading"
            @click="clearLogo"
          >
            {{ removeLabel }}
          </button>
        </div>
      </div>
    </div>

    <div class="logo-upload-field__url">
      <label :for="`${inputId}-url`" class="logo-upload-field__url-label">{{ urlLabel }}</label>
      <input
        :id="`${inputId}-url`"
        :value="modelValue"
        type="url"
        class="logo-upload-field__url-input"
        :placeholder="urlPlaceholder"
        :disabled="disabled || isUploading"
        @input="updateValue(($event.target as HTMLInputElement).value)"
      />
    </div>

    <p v-if="uploadError" class="logo-upload-field__error" role="alert">{{ uploadError }}</p>
  </div>
</template>

<style scoped>
.logo-upload-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logo-upload-field__label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
}

.logo-upload-field__opt {
  color: var(--muted);
  font-weight: 400;
}

.logo-upload-field__body {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

.logo-upload-field__preview {
  flex: 0 0 72px;
  width: 72px;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.logo-upload-field__preview--empty {
  color: var(--muted);
}

.logo-upload-field__preview-img {
  max-width: 56px;
  max-height: 56px;
  object-fit: contain;
}

.logo-upload-field__preview-placeholder {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.logo-upload-field__controls {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.logo-upload-field__dropzone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 72px;
  padding: 12px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  transition:
    border-color 0.15s ease-out,
    background-color 0.15s ease-out,
    box-shadow 0.15s ease-out;
}

.logo-upload-field__dropzone:hover:not(:disabled) {
  border-color: color-mix(in oklch, var(--fg) 24%, var(--border));
  background: color-mix(in oklch, var(--fg) 3%, var(--bg));
}

.logo-upload-field__dropzone--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.logo-upload-field__dropzone--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logo-upload-field__dropzone-text {
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
}

.logo-upload-field__browse {
  color: var(--accent);
  font-weight: 500;
}

.logo-upload-field__dropzone-meta {
  font-size: 11px;
  color: var(--muted);
}

.logo-upload-field__file-input {
  display: none;
}

.logo-upload-field__actions {
  display: flex;
  justify-content: flex-end;
}

.logo-upload-field__remove {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.logo-upload-field__remove:hover:not(:disabled) {
  color: var(--fg);
}

.logo-upload-field__remove:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logo-upload-field__url {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.logo-upload-field__url-label {
  font-size: 12px;
  color: var(--muted);
}

.logo-upload-field__url-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.logo-upload-field__url-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.logo-upload-field__url-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logo-upload-field__error {
  margin: 0;
  font-size: 12px;
  color: oklch(50% 0.16 25);
}

@media (max-width: 520px) {
  .logo-upload-field__body {
    flex-direction: column;
  }

  .logo-upload-field__preview {
    width: 100%;
    min-height: 64px;
  }
}
</style>
