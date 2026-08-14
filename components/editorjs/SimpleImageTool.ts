import { readFileAsDataUrl, isLoadableImageUrl } from "~/composables/useEditorJsConverter";
import { getEditorImageUploadByFile } from "./imageUploadBridge";
import BaseSimpleImage from "@editorjs/simple-image";

type SimpleImageData = {
  url: string;
  caption: string;
  withBorder?: boolean;
  withBackground?: boolean;
  stretched?: boolean;
};

type SimpleImageToolConfig = {
  uploadByFile?: (file: File) => Promise<string>;
};

const IMAGE_TOOLBOX_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15l-5-5L5 21"/></svg>';

export default class SimpleImageTool extends BaseSimpleImage {
  private uploading = false;
  private configUploadByFile?: (file: File) => Promise<string>;

  constructor(params: {
    data: SimpleImageData;
    config?: SimpleImageToolConfig;
    api: any;
    readOnly: boolean;
  }) {
    super(params);
    this.configUploadByFile = params.config?.uploadByFile;
  }

  static get toolbox() {
    return {
      title: "Upload image",
      icon: IMAGE_TOOLBOX_ICON,
    };
  }

  private getUploadByFile(): ((file: File) => Promise<string>) | null {
    return this.configUploadByFile ?? getEditorImageUploadByFile();
  }

  private readFileAsDataUrl(file: File): Promise<SimpleImageData> {
    return readFileAsDataUrl(file).then((url) => ({
      url,
      caption: file.name.replace(/\.[^.]+$/, ""),
    }));
  }

  private uploadFile(file: File): Promise<SimpleImageData> {
    const upload = this.getUploadByFile();
    if (upload) {
      return upload(file).then((url) => ({
        url,
        caption: file.name.replace(/\.[^.]+$/, ""),
      }));
    }
    return this.readFileAsDataUrl(file);
  }

  onDropHandler(file: File): Promise<SimpleImageData> {
    return this.uploadFile(file);
  }

  onPaste(event: { type: string; detail: { file?: File; data?: string } }) {
    if (event.type === "file" && event.detail.file) {
      this.uploadFile(event.detail.file)
        .then((data) => {
          this.applyUploadedImage(data);
        })
        .catch(() => {
          /* upload handler shows toast */
        });
      return;
    }
    super.onPaste(event);
  }

  private applyUploadedImage(data: SimpleImageData) {
    this.data = {
      ...this.data,
      url: data.url,
      caption: data.caption || this.data.caption,
    };
    const wrapper = this.nodes.wrapper;
    const imageHolder = this.nodes.imageHolder;
    const image = this.nodes.image;
    if (!wrapper || !imageHolder || !image) return;

    wrapper.querySelector(".cdx-simple-image__error")?.remove();
    wrapper.querySelector(".cdx-simple-image__upload")?.remove();
    imageHolder.classList.remove("cdx-simple-image__picture--broken");
    image.onload = () => {
      wrapper.classList.remove(this.CSS.loading);
      wrapper.querySelector(`.${this.CSS.loading}`)?.remove();
      if (!imageHolder.contains(image)) {
        imageHolder.appendChild(image);
      }
      if (!wrapper.contains(imageHolder)) {
        wrapper.appendChild(imageHolder);
      }
      if (this.nodes.caption && !wrapper.contains(this.nodes.caption)) {
        wrapper.appendChild(this.nodes.caption);
      }
      this._acceptTuneView();
    };
    image.onerror = () => {
      image.alt = "Image failed to load.";
      imageHolder.classList.add("cdx-simple-image__picture--broken");
    };
    image.src = data.url;
  }

  private async handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    this.uploading = true;
    const loader = this.nodes.wrapper?.querySelector(`.${this.CSS.loading}`);
    if (loader instanceof HTMLElement) {
      loader.style.display = "block";
    }

    try {
      const data = await this.uploadFile(file);
      this.applyUploadedImage(data);
    } catch {
      /* upload handler shows toast */
    } finally {
      this.uploading = false;
      if (loader instanceof HTMLElement) {
        loader.style.display = "none";
      }
    }
  }

  render() {
    const wrapper = this._make("div", [this.CSS.baseClass, this.CSS.wrapper]);
    const loader = this._make("div", this.CSS.loading);
    const imageHolder = this._make("div", this.CSS.imageHolder);
    const image = this._make("img");
    const caption = this._make("div", [this.CSS.input, this.CSS.caption], {
      contentEditable: !this.readOnly,
      innerHTML: this.data.caption || "",
    });

    caption.dataset.placeholder = "Enter a caption";
    wrapper.appendChild(loader);

    this.nodes.imageHolder = imageHolder;
    this.nodes.wrapper = wrapper;
    this.nodes.image = image;
    this.nodes.caption = caption;

    const finishLayout = () => {
      wrapper.classList.remove(this.CSS.loading);
      loader.remove();
      if (!imageHolder.contains(image)) {
        imageHolder.appendChild(image);
      }
      if (!wrapper.contains(imageHolder)) {
        wrapper.appendChild(imageHolder);
      }
      if (!wrapper.contains(caption)) {
        wrapper.appendChild(caption);
      }
      this._acceptTuneView();
    };

    const showBrokenState = (message: string, withUpload = false) => {
      finishLayout();
      image.alt = message;
      image.onload = null;
      image.onerror = null;
      const originalUrl = (this.data.url || "").trim();
      if (originalUrl) {
        image.src = originalUrl;
      }
      imageHolder.classList.add("cdx-simple-image__picture--broken");
      const hint = this._make("div", "cdx-simple-image__error");
      hint.textContent = message;
      if (!wrapper.querySelector(".cdx-simple-image__error")) {
        wrapper.insertBefore(hint, caption);
      }
      if (withUpload && !wrapper.querySelector(".cdx-simple-image__upload")) {
        appendUploadPanel(wrapper, caption);
      }
    };

    const appendUploadPanel = (parent: HTMLElement, insertBefore?: HTMLElement | null) => {
      const panel = this._make("div", "cdx-simple-image__upload");
      const label = this._make("label", "cdx-simple-image__upload-btn");
      label.textContent = "Upload image";
      const input = this._make("input", "cdx-simple-image__upload-input", {
        type: "file",
        accept: "image/jpeg,image/png,image/gif,image/webp",
      }) as HTMLInputElement;
      input.addEventListener("change", (e) => this.handleFileInputChange(e));
      label.appendChild(input);

      const hint = this._make("div", "cdx-simple-image__upload-hint");
      hint.textContent = "JPEG, PNG, GIF, or WebP — or paste an image from your clipboard";

      panel.appendChild(label);
      panel.appendChild(hint);
      if (insertBefore) {
        parent.insertBefore(panel, insertBefore);
      } else {
        parent.appendChild(panel);
      }
    };

    const showUploadPrompt = () => {
      wrapper.classList.remove(this.CSS.loading);
      loader.remove();
      appendUploadPanel(wrapper);
      wrapper.appendChild(caption);
    };

    const canUpload = Boolean(this.getUploadByFile()) && !this.readOnly;

    const url = (this.data.url || "").trim();
    if (!url) {
      if (canUpload) {
        showUploadPrompt();
      } else {
        showBrokenState("Paste an image or enter an image URL.");
      }
    } else if (!isLoadableImageUrl(url)) {
      const label = this.data.caption || url;
      showBrokenState(
        `Could not load "${label}". Re-paste the GIF from Notion or copy the image directly.`,
        canUpload
      );
    } else {
      image.onload = () => finishLayout();
      image.onerror = () =>
        showBrokenState("Image failed to load. Re-paste or update the URL.", canUpload);
      image.src = url;
    }

    return wrapper;
  }

  save(blockContent: HTMLElement): { url: string; caption: string; [key: string]: any } {
    const saved = super.save(blockContent) as {
      url: string;
      caption: string;
      [key: string]: any;
    };
    saved.url = (this.data.url || "").trim();
    return saved;
  }
}
