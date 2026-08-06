import { assignUniqueHeadingSlugs } from "~/composables/useMarkdown";

export interface MarkdownOutlineItem {
  key: string;
  label: string;
  level: number;
  targetId?: string;
}

export function buildMarkdownOutline(
  headings: Array<{ level: number; text: string }>,
  extra: Array<{ id: string; label: string; level?: number }> = []
): MarkdownOutlineItem[] {
  const slugs = assignUniqueHeadingSlugs(headings.map((h) => h.text));
  const fromMarkdown = headings.map((h, i) => ({
    key: `h:${slugs[i]}`,
    label: h.text,
    level: h.level,
    targetId: slugs[i],
  }));
  const fromExtra = extra.map((item) => ({
    key: `id:${item.id}`,
    label: item.label,
    level: item.level ?? 2,
    targetId: item.id,
  }));
  return [...fromMarkdown, ...fromExtra];
}

export function useMarkdownOutline(containerRef: Ref<HTMLElement | null | undefined>) {
  const activeKey = ref("");

  function resolveElement(item: MarkdownOutlineItem): HTMLElement | null {
    if (!item.targetId) return null;
    return document.getElementById(item.targetId);
  }

  function scrollToItem(item: MarkdownOutlineItem) {
    activeKey.value = item.key;
    const el = resolveElement(item);
    if (!el) return;

    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  let scrollSpyCleanup: (() => void) | null = null;

  function setupScrollSpy(items: MarkdownOutlineItem[]) {
    if (scrollSpyCleanup) {
      scrollSpyCleanup();
      scrollSpyCleanup = null;
    }
    if (!items.length) return;

    const sections = items
      .map((item) => resolveElement(item))
      .filter(Boolean) as HTMLElement[];

    if (!sections.length) return;

    function onScroll() {
      const scrollPos = window.scrollY + 120;
      let nextKey = items[0]?.key ?? "";
      sections.forEach((sec, i) => {
        if (sec.offsetTop <= scrollPos) {
          nextKey = items[i]?.key ?? nextKey;
        }
      });
      activeKey.value = nextKey;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    scrollSpyCleanup = () => window.removeEventListener("scroll", onScroll);
  }

  onBeforeUnmount(() => {
    if (scrollSpyCleanup) scrollSpyCleanup();
  });

  return {
    activeKey,
    scrollToItem,
    setupScrollSpy,
  };
}
