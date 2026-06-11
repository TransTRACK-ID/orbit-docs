import type { ComputedRef, Ref } from "vue";

type MermaidModule = typeof import("mermaid").default;

let mermaidModule: MermaidModule | null = null;
let initPromise: Promise<MermaidModule> | null = null;

async function getMermaid(): Promise<MermaidModule> {
  if (mermaidModule) return mermaidModule;
  if (!initPromise) {
    initPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "strict",
        fontFamily: "Inter, system-ui, sans-serif",
      });
      mermaidModule = mermaid;
      return mermaid;
    });
  }
  return initPromise;
}

export async function renderMermaidInContainer(
  container: HTMLElement | null | undefined,
): Promise<void> {
  if (!container || !import.meta.client) return;

  const nodes = container.querySelectorAll("pre.mermaid");
  if (nodes.length === 0) return;

  const mermaid = await getMermaid();
  try {
    await mermaid.run({ nodes });
  } catch {
    // Invalid diagram syntax — leave source visible
  }
}

export function useMermaidRenderer(
  containerRef: Ref<HTMLElement | null | undefined>,
  contentSource: Ref<string> | ComputedRef<string>,
): void {
  const render = async () => {
    await nextTick();
    await renderMermaidInContainer(containerRef.value);
  };

  watch(contentSource, render, { flush: "post" });

  onMounted(() => {
    void render();
  });
}
