import { vi } from "vitest";
import { ref, computed, watch, nextTick } from "vue";

// Mock vue3-toastify globally
vi.mock("vue3-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock $fetch globally
(globalThis as any).$fetch = vi.fn();

// Mock navigateTo
(globalThis as any).navigateTo = vi.fn();

// Mock useState to return a reactive ref
(globalThis as any).useState = vi.fn((_key: string, init?: () => any) => {
  const initial = init ? init() : null;
  return ref(initial);
});

// Mock useIsUnauthorized composable
(globalThis as any).useIsUnauthorized = vi.fn(() => ref(false));

// Mock useRoute
(globalThis as any).useRoute = vi.fn(() =>
  ref({ path: "/", params: {}, query: {}, name: "index" })
);

// Mock useHead / useHeadSafe
(globalThis as any).useHead = vi.fn();
(globalThis as any).useHeadSafe = vi.fn();

// Mock useCookie
(globalThis as any).useCookie = vi.fn((_key: string, _opts?: any) => {
  const cookieRef = ref<string | undefined>(undefined);
  return cookieRef;
});

// Provide Vue reactivity globals on globalThis so composables using
// global ref/computed/watch work when imported in plain node mode.
(globalThis as any).ref = ref;
(globalThis as any).computed = computed;
(globalThis as any).watch = watch;
(globalThis as any).nextTick = nextTick;
