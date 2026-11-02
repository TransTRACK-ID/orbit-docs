import {
  formatUploadLimitMb,
  getDocImageMaxBytes,
  getDocPdfMaxBytes,
  getDocVideoMaxBytes,
  validateDocAttachmentSize,
  validateDocImageSize,
} from "~/utils/doc-upload-limits";

function envOverride(value: unknown): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

export function useDocUploadLimits() {
  const config = useRuntimeConfig();

  const pdfMaxBytes = computed(() =>
    getDocPdfMaxBytes(envOverride(config.public.docPdfMaxBytes)),
  );
  const videoMaxBytes = computed(() =>
    getDocVideoMaxBytes(envOverride(config.public.docVideoMaxBytes)),
  );
  const imageMaxBytes = computed(() =>
    getDocImageMaxBytes(envOverride(config.public.docImageMaxBytes)),
  );

  const attachmentSizeHint = computed(
    () =>
      `PDF up to ${formatUploadLimitMb(pdfMaxBytes.value)} · video up to ${formatUploadLimitMb(videoMaxBytes.value)}`,
  );

  function validateAttachment(file: File): string | null {
    return validateDocAttachmentSize(file, pdfMaxBytes.value, videoMaxBytes.value);
  }

  function validateImage(file: File): string | null {
    return validateDocImageSize(file, imageMaxBytes.value);
  }

  return {
    pdfMaxBytes,
    videoMaxBytes,
    imageMaxBytes,
    attachmentSizeHint,
    validateAttachment,
    validateImage,
  };
}
