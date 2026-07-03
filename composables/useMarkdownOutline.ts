import { headingSlug } from "~/composables/useMarkdown";

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
  const fromMarkdown = headings.map((h) => ({
    key: `h:${h.text}`,
    label: h.text,
    level: h.level,
    targetId: headingSlug(h.text),
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

  function resolveHeadingElement(text: string): HTMLElement | null {
    const root = containerRef.value;
    if (!root) return null;
    const slug = headingSlug(text);
    let el = root.querySelector<HTMLElement>(`#${CSS.escape(slug)}`);
    if (!el) {
      for (const heading of root.querySelectorAll<HTMLElement>("h1, h2, h3")) {
        if (heading.textContent?.trim() === text) {
          el = heading;
          break;
        }
      }
    }
    return el;
  }

  function scrollToItem(item: MarkdownOutlineItem) {
    activeKey.value = item.key;
    const root = containerRef.value;
    if (!root) return;

    let el: HTMLElement | null = null;
    if (item.key.startsWith("h:")) {
      el = resolveHeadingElement(item.label);
    } else if (item.targetId) {
      el = document.getElementById(item.targetId);
    }

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
      .map((item) => {
        if (item.key.startsWith("h:")) {
          return resolveHeadingElement(item.label);
        }
        return item.targetId ? document.getElementById(item.targetId) : null;
      })
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
