/** Shared upload handler for SimpleImageTool (Editor.js tools are not Vue components). */
let uploadByFile: ((file: File) => Promise<string>) | null = null;

export function setEditorImageUploadByFile(
  fn: ((file: File) => Promise<string>) | null
) {
  uploadByFile = fn;
}

export function getEditorImageUploadByFile(): ((file: File) => Promise<string>) | null {
  return uploadByFile;
}
