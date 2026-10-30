import type { TranscriptSegment, VideoBlockData } from "~/utils/video-block";

/** Host-page hooks for VideoTool (Editor.js tools are not Vue components). */
export interface VideoToolBridge {
  upload: (file: File, onProgress: (fraction: number) => void) => Promise<{ assetId: string; title: string }>;
  openTranscript: (data: VideoBlockData, onSave: (segments: TranscriptSegment[]) => void) => void;
}

let bridge: VideoToolBridge | null = null;

export function setVideoToolBridge(next: VideoToolBridge | null) {
  bridge = next;
}

export function getVideoToolBridge(): VideoToolBridge | null {
  return bridge;
}
