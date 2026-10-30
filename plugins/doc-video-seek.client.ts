function seek(video: HTMLVideoElement, seconds: number) {
  const play = () => {
    video.currentTime = seconds;
    void video.play().catch(() => {});
  };
  if (video.readyState >= 1) play();
  else video.addEventListener("loadedmetadata", play, { once: true });
}

/** Jumps to `?video=<assetId>&t=<seconds>` once the rendered video exists. */
function seekFromQuery(attempt = 0) {
  const params = new URLSearchParams(window.location.search);
  const assetId = params.get("video");
  const seconds = Number(params.get("t"));
  if (!assetId || !Number.isFinite(seconds)) return;
  const id = CSS.escape(assetId);
  const figure = document.querySelector<HTMLElement>(
    `.doc-video[data-asset-id="${id}"], .cdx-video[data-asset-id="${id}"]`,
  );
  const video = figure?.querySelector<HTMLVideoElement>("video");
  if (!figure || !video) {
    if (attempt < 40) window.setTimeout(() => seekFromQuery(attempt + 1), 250);
    return;
  }
  figure.scrollIntoView({ block: "center" });
  seek(video, Math.max(0, seconds));
}

export default defineNuxtPlugin((nuxtApp) => {
  document.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLElement>(".doc-video-ts");
    if (!button) return;
    const video = button.closest(".doc-video")?.querySelector<HTMLVideoElement>("video");
    const seconds = Number(button.dataset.seek);
    if (!video || !Number.isFinite(seconds)) return;
    event.preventDefault();
    seek(video, seconds);
  });

  nuxtApp.hook("page:finish", () => seekFromQuery());
  useRouter().afterEach((to, from) => {
    if (to.path === from.path && to.query.video) void nextTick(() => seekFromQuery());
  });
});
