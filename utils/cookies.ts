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
  setCookie("is_show_select_order_tooltip_cookie", "true");
}
