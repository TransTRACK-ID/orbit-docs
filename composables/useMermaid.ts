import type { ComputedRef, Ref } from "vue";
import { isMermaidErrorSvg, normalizeMermaidSource } from "~/utils/mermaid-source";

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
        suppressErrorRendering: true,
      });
      mermaidModule = mermaid;
      return mermaid;
    });
  }
  return initPromise;
}

let _mermaidIdCounter = 0;

function showMermaidFallback(node: HTMLPreElement, source: string): void {
  const doc = node.ownerDocument;
  const wrap = doc.createElement("div");
  wrap.className = "mermaid-fallback";
  wrap.setAttribute("data-mermaid-rendered", "true");

  const label = doc.createElement("p");
  label.className = "mermaid-fallback-label";
  label.textContent = "Diagram could not be rendered. Source shown below.";

  const pre = doc.createElement("pre");
  const code = doc.createElement("code");
  code.textContent = source;
  pre.appendChild(code);

  wrap.appendChild(label);
  wrap.appendChild(pre);
  node.replaceWith(wrap);
}

export async function renderMermaidInContainer(
  container: HTMLElement | null | undefined,
): Promise<void> {
  if (!container || !import.meta.client) return;

  const nodes = container.querySelectorAll<HTMLPreElement>("pre.mermaid");
  if (nodes.length === 0) return;

  const mermaid = await getMermaid();

  for (const node of nodes) {
    if (node.getAttribute("data-mermaid-rendered") === "true") continue;

    const raw = node.textContent || "";
    const source = normalizeMermaidSource(raw);
    if (!source) {
      node.setAttribute("data-mermaid-rendered", "true");
      continue;
    }

    const id = `mermaid-${++_mermaidIdCounter}`;

    try {
      const parsed = await mermaid.parse(source, { suppressErrors: true });
      if (!parsed) {
        showMermaidFallback(node, source);
        continue;
      }

      const { svg } = await mermaid.render(id, source);
      if (isMermaidErrorSvg(svg)) {
        showMermaidFallback(node, source);
        continue;
      }

      node.innerHTML = svg;
      node.setAttribute("data-mermaid-rendered", "true");
    } catch {
      showMermaidFallback(node, source);
    }
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
