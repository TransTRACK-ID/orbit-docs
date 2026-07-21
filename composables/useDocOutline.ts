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

export function useDocOutline(contentRef: Ref<HTMLElement | null>) {
  const activeSlug = ref("");
  let sectionObserver: IntersectionObserver | null = null;

  function scrollToSection(targetId: string) {
    const container = contentRef.value;
    const el = document.getElementById(targetId);
    if (!el || !container) return;
    const top = el.offsetTop - container.offsetTop - 16;
    container.scrollTo({ top, behavior: "smooth" });
    activeSlug.value = targetId;
  }

  function scrollToTop() {
    const container = contentRef.value;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: "smooth" });
    activeSlug.value = "";
  }

  function setupScrollSpy(rootId = "docContent") {
    const container = contentRef.value;
    const docContent = document.getElementById(rootId);
    if (!docContent || !container) return;

    const targets = docContent.querySelectorAll<HTMLElement>("h2[id], h3[id]");
    if (!targets.length) return;

    sectionObserver?.disconnect();
    sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0 && visible[0]) {
          activeSlug.value = visible[0].target.id;
        }
      },
      {
        root: container,
        rootMargin: "-10% 0px -60% 0px",
        threshold: 0,
      },
    );

    targets.forEach((t) => sectionObserver!.observe(t));
  }

  function teardownScrollSpy() {
    sectionObserver?.disconnect();
    sectionObserver = null;
  }

  onBeforeUnmount(teardownScrollSpy);

  return {
    activeSlug,
    scrollToSection,
    scrollToTop,
    setupScrollSpy,
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
