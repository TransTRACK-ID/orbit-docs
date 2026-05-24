import { vi, ref } from "vitest";

export const useAuth = vi.fn(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  data: ref(null),
}));

export const useCookie = vi.fn((_key: string, _opts?: any) => {
  const cookieRef = ref<string | undefined>(undefined);
  return cookieRef;
});

export const useState = vi.fn((_key: string, init?: () => any) => {
  const initial = init ? init() : null;
  return ref(initial);
});

export const useRoute = vi.fn(() =>
  ref({ path: "/", params: {}, query: {}, name: "index" })
);

export const useHead = vi.fn();
export const useHeadSafe = vi.fn();
export const navigateTo = vi.fn();
export const useNuxtApp = vi.fn(() => ({}));
