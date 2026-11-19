import { assignUniqueHeadingSlugs, extractHeadings } from "~/composables/useMarkdown";

export interface DocOutlineItem {
  type: "section" | "indent";
  text: string;
  slug: string;
}

export function buildOutlineFromMarkdown(md: string): DocOutlineItem[] {
  if (!md) return [];
  const filtered = extractHeadings(md).filter((h) => h.level === 2 || h.level === 3);
  const slugs = assignUniqueHeadingSlugs(filtered.map((h) => h.text));
  return filtered.map((h, i) => ({
    type: h.level === 2 ? ("section" as const) : ("indent" as const),
    text: h.text,
    slug: slugs[i],
  }));
}

/** Pick the last heading whose top edge is at or above the probe line. */
export function pickActiveHeadingId(
  headings: Array<{ id: string; top: number }>,
  probeY: number,
): string {
  if (!headings.length) return "";
  let current = headings[0].id;
  for (const heading of headings) {
    if (heading.top <= probeY) current = heading.id;
    else break;
  }
  return current;
}

const SCROLL_SPY_OFFSET = 96;

export function useDocOutline(contentRef: Ref<HTMLElement | null>) {
  const route = useRoute();
  const router = useRouter();
  const activeSlug = ref("");
  const spyRootId = ref("docContent");
  let scrollCleanup: (() => void) | null = null;
  let syncActive: (() => void) | null = null;
  let pinnedSlug: string | null = null;
  let pinClearTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollPinCleanup: (() => void) | null = null;

  function syncRouteHash(targetId: string) {
    if (!import.meta.client || !targetId) return;
    const hash = `#${targetId}`;
    if (route.hash === hash) return;
    router.replace({ hash });
  }

  function clearPinnedSlug(runSpy = true) {
    pinnedSlug = null;
    if (pinClearTimer) {
      clearTimeout(pinClearTimer);
      pinClearTimer = null;
    }
    scrollPinCleanup?.();
    scrollPinCleanup = null;
    if (!runSpy) return;

    const hashId = route.hash?.replace(/^#/, "");
    if (hashId && document.getElementById(hashId)) {
      activeSlug.value = hashId;
      return;
    }
    syncActive?.();
  }

  function pinActiveSlug(targetId: string, container: HTMLElement) {
    pinnedSlug = targetId;
    activeSlug.value = targetId;
    scrollPinCleanup?.();

    if (pinClearTimer) {
      clearTimeout(pinClearTimer);
      pinClearTimer = null;
    }

    let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
      scrollIdleTimer = setTimeout(() => clearPinnedSlug(true), 120);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    scrollPinCleanup = () => {
      container.removeEventListener("scroll", onScroll);
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
    };

    // Safety net when smooth scroll never fires scroll events (short pages).
    pinClearTimer = setTimeout(() => clearPinnedSlug(true), 2500);
  }

  function scrollToSection(targetId: string) {
    const container = contentRef.value;
    if (!container) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    // Use getBoundingClientRect for reliable cross-browser positioning inside
    // a nested scroll container (offsetTop is relative to offsetParent, which
    // may not be the scroll container itself if it lacks position:relative).
    const top =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      16;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    pinActiveSlug(targetId, container);
    syncRouteHash(targetId);
  }

  function scrollToTop(rootId = "docContent") {
    const container = contentRef.value;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: "smooth" });
    const first = document
      .getElementById(rootId)
      ?.querySelector<HTMLElement>("h2[id], h3[id]");
    activeSlug.value = first?.id ?? "";
  }

  function setupScrollSpy(rootId = spyRootId.value) {
    teardownScrollSpy();

    const container = contentRef.value;
    const docContent = document.getElementById(rootId);
    if (!docContent || !container) return;

    spyRootId.value = rootId;

    syncActive = () => {
      if (pinnedSlug) {
        activeSlug.value = pinnedSlug;
        return;
      }

      const headings = [
        ...docContent.querySelectorAll<HTMLElement>("h2[id], h3[id]"),
      ];
      if (!headings.length) {
        activeSlug.value = "";
        return;
      }

      const probeY = container.getBoundingClientRect().top + SCROLL_SPY_OFFSET;
      const positioned = headings.map((heading) => ({
        id: heading.id,
        top: heading.getBoundingClientRect().top,
      }));

      activeSlug.value = pickActiveHeadingId(positioned, probeY);
    };

    container.addEventListener("scroll", syncActive, { passive: true });
    scrollCleanup = () => {
      container.removeEventListener("scroll", syncActive!);
    };

    syncActive();
  }

  function refreshScrollSpy() {
    setupScrollSpy(spyRootId.value);
  }

  function teardownScrollSpy() {
    scrollCleanup?.();
    scrollCleanup = null;
    syncActive = null;
    clearPinnedSlug(false);
  }

  watch(
    contentRef,
    (el) => {
      if (!el) {
        teardownScrollSpy();
        return;
      }
      nextTick(() => setupScrollSpy(spyRootId.value));
    },
    { flush: "post" },
  );

  onBeforeUnmount(teardownScrollSpy);

  return {
    activeSlug,
    scrollToSection,
    scrollToTop,
    setupScrollSpy,
    refreshScrollSpy,
    teardownScrollSpy,
  };
}

export function useMarkdownCopyHandler(onCopied?: (msg: string) => void) {
  function copyCode(btn: HTMLButtonElement) {
    const pre = btn.previousElementSibling as HTMLPreElement | null;
    if (!pre) return;
    const code = pre.querySelector("code") || pre;
    navigator.clipboard
      .writeText(code.textContent || "")
      .then(() => {
        btn.textContent = "Copied";
        btn.classList.add("copied");
        onCopied?.("Code copied");
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 2000);
      })
      .catch(() => onCopied?.("Copy failed"));
  }

  function handleContentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const copyBtn = target.closest(".copy-btn") as HTMLButtonElement | null;
    if (copyBtn) {
      e.preventDefault();
      copyCode(copyBtn);
    }
  }

  return { handleContentClick };
}
