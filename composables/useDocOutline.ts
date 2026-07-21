import { extractHeadings, headingSlug } from "~/composables/useMarkdown";

export interface DocOutlineItem {
  type: "section" | "indent";
  text: string;
  slug: string;
}

export function buildOutlineFromMarkdown(md: string): DocOutlineItem[] {
  if (!md) return [];
  return extractHeadings(md)
    .filter((h) => h.level === 2 || h.level === 3)
    .map((h) => ({
      type: h.level === 2 ? ("section" as const) : ("indent" as const),
      text: h.text,
      slug: headingSlug(h.text),
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
  const activeSlug = ref("");
  const spyRootId = ref("docContent");
  let scrollCleanup: (() => void) | null = null;
  let syncActive: (() => void) | null = null;

  function scrollToSection(targetId: string) {
    const container = contentRef.value;
    const el = document.getElementById(targetId);
    if (!el || !container) return;
    const top = el.offsetTop - container.offsetTop - 16;
    container.scrollTo({ top, behavior: "smooth" });
    activeSlug.value = targetId;
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
