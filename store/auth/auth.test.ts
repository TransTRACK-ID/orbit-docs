import { describe, expect, it, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "./index";
import { mockSignIn, mockSignOut, mockAuthData } from "../../vitest-imports-mock";
import { setupCookies } from "~/utils/cookies";

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("vue3-toastify", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

vi.mock("~/utils/cookies", () => ({
  setupCookies: vi.fn(),
}));

const mockFetch = vi.fn();
(globalThis as any).$fetch = mockFetch;

describe("useAuthStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockSignIn.mockReset();
    mockSignOut.mockReset();
    mockAuthData.value = null;
    mockFetch.mockReset();
    vi.mocked(setupCookies).mockReset();
  });

  describe("login", () => {
    it("should call signIn with credentials and setup cookies on success", async () => {
      mockSignIn.mockResolvedValueOnce(undefined);

      const store = useAuthStore();
      store.email = "test@example.com";
      store.password = "password123";

      const result = await store.login();

      expect(mockSignIn).toHaveBeenCalledWith(
        { email: "test@example.com", password: "password123" },
        { callbackUrl: "/" }
      );
      expect(setupCookies).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it("should set isLoading while logging in", async () => {
      let resolveSignIn: () => void;
      const signInPromise = new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      });
      mockSignIn.mockReturnValueOnce(signInPromise);

      const store = useAuthStore();
      store.email = "test@example.com";
      store.password = "password123";

      const loginPromise = store.login();
      expect(store.isLoading).toBe(true);

      resolveSignIn!();
      await loginPromise;
      expect(store.isLoading).toBe(false);
    });

    it("should show rate-limit toast on 429 error", async () => {
      const error = { data: { code: 429, message: "Too many requests" } };
      mockSignIn.mockRejectedValueOnce(error);

      const store = useAuthStore();
      store.email = "test@example.com";
      store.password = "password123";

      await expect(store.login()).rejects.toEqual(error);
      expect(mockToastError).toHaveBeenCalledWith("Too many requests", {
        toastClassName: "toastify-error",
      });
      expect(store.isLoading).toBe(false);
    });

    it("should show generic error toast on other errors", async () => {
      const error = new Error("Network error");
      mockSignIn.mockRejectedValueOnce(error);

      const store = useAuthStore();
      store.email = "test@example.com";
      store.password = "password123";

      await expect(store.login()).rejects.toEqual(error);
      expect(mockToastError).toHaveBeenCalledWith("Login failed. Please try again.", {
        toastClassName: "toastify-error",
      });
      expect(store.isLoading).toBe(false);
    });
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const response = { data: { id: "1", email: "new@example.com" } };
      mockFetch.mockResolvedValueOnce(response);

      const store = useAuthStore();
      const payload = {
        name: "New User",
        email: "new@example.com",
        password: "password123",
        passwordConfirmation: "password123",
      };

      const result = await store.register(payload);

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/register", {
        method: "POST",
        body: payload,
      });
      expect(result).toEqual(response);
      expect(store.isLoading).toBe(false);
    });

    it("should show error toast on registration failure", async () => {
      const error = { data: { message: "Email already exists" } };
      mockFetch.mockRejectedValueOnce(error);

      const store = useAuthStore();
      const payload = {
        name: "New User",
        email: "exists@example.com",
        password: "password123",
        passwordConfirmation: "password123",
      };

      await expect(store.register(payload)).rejects.toEqual(error);
      expect(mockToastError).toHaveBeenCalledWith("Email already exists", {
        toastClassName: "toastify-error",
      });
      expect(store.isLoading).toBe(false);
    });

    it("should show generic error when no message provided", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const store = useAuthStore();
      const payload = {
        name: "New User",
        email: "test@example.com",
        password: "password123",
        passwordConfirmation: "password123",
      };

      await expect(store.register(payload)).rejects.toBeDefined();
      expect(mockToastError).toHaveBeenCalledWith("Registration failed. Please try again.", {
        toastClassName: "toastify-error",
      });
    });
  });

  describe("logout", () => {
    it("should call signOut with callbackUrl and clear cookies", async () => {
      mockSignOut.mockResolvedValueOnce(undefined);

      const store = useAuthStore();
      const result = await store.logout();

      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
      expect(result).toBe(true);
    });

    it("should show error toast on logout failure", async () => {
      const error = new Error("Logout failed");
      mockSignOut.mockRejectedValueOnce(error);

      const store = useAuthStore();
      await expect(store.logout()).rejects.toEqual(error);
      expect(mockToastError).toHaveBeenCalledWith("Logout failed");
    });
  });

  describe("clearCookies", () => {
    it("should clear auth cookies when they exist", () => {
      const store = useAuthStore();
      const authCookie = { value: "token" };
      const sessionCookie = { value: "session" };
      const initializedCookie = { value: "true" };

      (globalThis as any).useCookie = vi.fn((key: string) => {
        if (key === "auth.token") return authCookie;
        if (key === "session_token") return sessionCookie;
        if (key === "auth.initialized") return initializedCookie;
        return { value: undefined };
      });

      store.clearCookies();

      expect(authCookie.value).toBeNull();
      expect(sessionCookie.value).toBeNull();
      expect(initializedCookie.value).toBeNull();
    });

    it("should not error when cookies do not exist", () => {
      const store = useAuthStore();
      (globalThis as any).useCookie = vi.fn(() => ({ value: undefined }));

      expect(() => store.clearCookies()).not.toThrow();
    });
  });
});
