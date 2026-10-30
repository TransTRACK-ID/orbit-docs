import { getVideoToolBridge } from "./videoBridge";
import { videoFileUrl, type TranscriptSegment, type VideoBlockData } from "~/utils/video-block";

const VIDEO_TOOLBOX_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="2" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M17 10l5-3v10l-5-3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";

function segmentLabel(count: number): string {
  return count === 0 ? "Add transcript" : `Transcript · ${count} segment${count === 1 ? "" : "s"}`;
}

/** Uploaded doc video with a timestamped transcript the AI can cite. */
export default class VideoTool {
  private data: VideoBlockData;
  private readonly block: any;
  private readonly readOnly: boolean;
  private wrapper: HTMLDivElement | null = null;
  private titleInput: HTMLInputElement | null = null;

  static get toolbox() {
    return { title: "Video", icon: VIDEO_TOOLBOX_ICON };
  }

  static get isReadOnlySupported() {
    return true;
  }

  constructor(params: { data: Partial<VideoBlockData>; block: any; readOnly: boolean }) {
    this.data = {
      assetId: params.data?.assetId || "",
      title: params.data?.title || "",
      segments: Array.isArray(params.data?.segments) ? params.data.segments : [],
    };
    this.block = params.block;
    this.readOnly = params.readOnly;
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "cdx-video";
    if (this.data.assetId) this.renderPlayer();
    else this.renderUploader();
    return this.wrapper;
  }

  private renderPlayer() {
    const wrapper = this.wrapper!;
    wrapper.replaceChildren();
    wrapper.dataset.assetId = this.data.assetId;

    const video = document.createElement("video");
    video.className = "cdx-video__player";
    video.controls = true;
    video.preload = "metadata";
    video.src = videoFileUrl(this.data.assetId);

    const title = document.createElement("input");
    title.type = "text";
    title.className = "cdx-video__title";
    title.placeholder = "Video title";
    title.value = this.data.title;
    title.readOnly = this.readOnly;
    title.addEventListener("input", () => {
      this.data.title = title.value;
    });
    this.titleInput = title;

    wrapper.append(video, title);

    if (!this.readOnly) {
      const transcriptBtn = document.createElement("button");
      transcriptBtn.type = "button";
      transcriptBtn.className = "cdx-video__transcript-btn";
      transcriptBtn.textContent = segmentLabel(this.data.segments.length);
      transcriptBtn.addEventListener("click", () => {
        const bridge = getVideoToolBridge();
        if (!bridge) return;
        bridge.openTranscript({ ...this.data, title: title.value }, (segments: TranscriptSegment[]) => {
          this.data.segments = segments;
          transcriptBtn.textContent = segmentLabel(segments.length);
          this.block?.dispatchChange?.();
        });
      });
      wrapper.append(transcriptBtn);
    }
  }

  private renderUploader() {
    const wrapper = this.wrapper!;
    wrapper.replaceChildren();

    const panel = document.createElement("label");
    panel.className = "cdx-video__upload";
    const text = document.createElement("span");
    text.textContent = this.readOnly ? "No video uploaded" : "Upload a video (MP4, WebM, MOV)";
    panel.append(text);

    if (this.readOnly) {
      wrapper.append(panel);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = VIDEO_ACCEPT;
    input.className = "cdx-video__upload-input";
    const progress = document.createElement("div");
    progress.className = "cdx-video__progress";
    const bar = document.createElement("div");
    bar.className = "cdx-video__progress-bar";
    progress.append(bar);

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      const bridge = getVideoToolBridge();
      if (!file || !bridge) return;

      panel.classList.remove("cdx-video__upload--error");
      panel.classList.add("cdx-video__upload--busy");
      text.textContent = `Uploading ${file.name}…`;
      bar.style.transform = "scaleX(0)";
      wrapper.append(progress);
      try {
        const uploaded = await bridge.upload(file, (fraction) => {
          bar.style.transform = `scaleX(${fraction})`;
        });
        this.data = { assetId: uploaded.assetId, title: uploaded.title, segments: [] };
        this.renderPlayer();
        this.block?.dispatchChange?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        text.textContent = `${message.replace(/\.$/, "")}. Choose the file again to retry.`;
        panel.classList.remove("cdx-video__upload--busy");
        panel.classList.add("cdx-video__upload--error");
        progress.remove();
      }
    });

    panel.append(input);
    wrapper.append(panel);
  }

  save(): VideoBlockData {
    return {
      assetId: this.data.assetId,
      title: (this.titleInput?.value ?? this.data.title).trim(),
      segments: this.data.segments,
    };
  }

  validate(data: VideoBlockData): boolean {
    return Boolean(data.assetId);
  }
}
