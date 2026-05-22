import { useCookie } from "#app";

export function getCookie(key: string) {
  return useCookie(key, {
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function setCookie(key: string, value: any) {
  getCookie(key).value = value;
}

export function clearCookies() {
  // Clear auth cookies
  setCookie("auth.token", undefined);
  setCookie("session_token", undefined);
}

export function setupCookies() {
  // Mark that the auth handshake completed successfully.
  // This is a lightweight client-side flag that components can use
  // to skip initial loading states when the session is already warm.
  setCookie("auth.initialized", "true");
}
