import { vi } from "vitest";
import { ref } from "vue";

export const mockSignIn = vi.fn();
export const mockSignOut = vi.fn();
export const mockAuthData = ref(null);

export const useAuth = vi.fn(() => ({
  signIn: mockSignIn,
  signOut: mockSignOut,
  data: mockAuthData,
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
