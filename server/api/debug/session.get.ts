import { defineEventHandler, getCookie, getHeader } from "h3";

export default defineEventHandler((event) => {
    const sessionToken = getCookie(event, "session_token");
    const authToken = getCookie(event, "auth.token");
    const userInfo = getCookie(event, "user_info");
    const authHeader = getHeader(event, "authorization");
    const allCookies = getHeader(event, "cookie");

    return {
        debug: true,
        cookies: {
            session_token: sessionToken ? `${sessionToken.substring(0, 20)}...` : null,
            auth_token: authToken ? `${authToken.substring(0, 20)}...` : null,
            user_info: userInfo ? `${userInfo.substring(0, 20)}...` : null,
        },
        headers: {
            authorization: authHeader || null,
            cookie_present: !!allCookies,
        },
        userAgent: getHeader(event, "user-agent") || null,
    };
});
