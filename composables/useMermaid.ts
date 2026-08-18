import type { ComputedRef, Ref } from "vue";
import {
  attachMermaidPanZoom,
  wrapRenderedMermaidNode,
} from "~/utils/mermaid-pan-zoom";
import {
  isMermaidErrorSvg,
  readMermaidSourceFromNode,
} from "~/utils/mermaid-source";

type MermaidModule = typeof import("mermaid").default;

let mermaidModule: MermaidModule | null = null;
let initPromise: Promise<MermaidModule> | null = null;
let renderQueue = Promise.resolve();

const MERMAID_RENDER_DEBOUNCE_MS = 200;

async function getMermaid(): Promise<MermaidModule> {
  if (mermaidModule) return mermaidModule;
  if (!initPromise) {
    initPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
      });
      mermaidModule = mermaid;
      return mermaid;
    });
  }
  return initPromise;
}

function enqueueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(task, task);
  renderQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function isLiveNode(node: HTMLElement, container: HTMLElement): boolean {
  return node.isConnected && container.contains(node);
}

function cleanupMermaidRenderArtifacts(id: string): void {
  document.getElementById(`d${id}`)?.remove();
  document.getElementById(id)?.remove();
}

function createMermaidRenderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `mermaid-${crypto.randomUUID()}`;
  }
  return `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

async function renderMermaidNode(
  mermaid: MermaidModule,
  node: HTMLPreElement,
  container: HTMLElement
): Promise<void> {
  if (node.getAttribute("data-mermaid-rendered") === "true") return;
  if (!isLiveNode(node, container)) return;

  const source = readMermaidSourceFromNode(node);
  if (!source) {
    node.setAttribute("data-mermaid-rendered", "true");
    return;
  }

  const id = createMermaidRenderId();

  await enqueueMermaidRender(async () => {
    if (!isLiveNode(node, container)) return;

    try {
      const { svg } = await mermaid.render(id, source);
      cleanupMermaidRenderArtifacts(id);

      if (!isLiveNode(node, container)) return;

      if (!svg.trim() || isMermaidErrorSvg(svg)) {
        showMermaidFallback(node, source);
        return;
      }

      node.innerHTML = svg;
      const stage = wrapRenderedMermaidNode(node);
      attachMermaidPanZoom(stage);
    } catch {
      cleanupMermaidRenderArtifacts(id);
      if (isLiveNode(node, container)) {
        showMermaidFallback(node, source);
      }
    }
  });
}

export async function renderMermaidInContainer(
  container: HTMLElement | null | undefined,
): Promise<void> {
  if (!container || typeof window === "undefined") return;

  const nodes = Array.from(container.querySelectorAll<HTMLPreElement>("pre.mermaid"));
  if (nodes.length === 0) return;

  const mermaid = await getMermaid();

  for (const node of nodes) {
    await renderMermaidNode(mermaid, node, container);
  }
}

export function useMermaidRenderer(
  containerRef: Ref<HTMLElement | null | undefined>,
  contentSource: Ref<string> | ComputedRef<string>,
): void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let renderGeneration = 0;

  const render = async (generation: number) => {
    await nextTick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    if (generation !== renderGeneration) return;
    await renderMermaidInContainer(containerRef.value);
  };

  const scheduleRender = () => {
    renderGeneration += 1;
    const generation = renderGeneration;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void render(generation);
    }, MERMAID_RENDER_DEBOUNCE_MS);
  };

  watch(contentSource, scheduleRender, { flush: "post" });

  onMounted(() => {
    renderGeneration += 1;
    void render(renderGeneration);
  });

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    renderGeneration += 1;
  });
}
