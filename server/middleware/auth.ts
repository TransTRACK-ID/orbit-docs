import jwt from "jsonwebtoken";

export default defineEventHandler((event) => {
    const path = event.path;

    const isApiRoute = path.startsWith('/api/admin') ||
                       path.startsWith('/api/shared-workspace') ||
                       (path.startsWith('/api/feedback') && !path.includes('/status'));
    const isProtectedPage = path.startsWith('/admin/sso');

    if (isApiRoute || isProtectedPage) {
        const token = getCookie(event, 'session_token');
        const config = useRuntimeConfig();

        if (!token) {
            if (isProtectedPage) return sendRedirect(event, '/login');
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized'
            });
        }

        let decoded;
        try {
            // Try JWT verification first
            if (token.split('.').length === 3 && config.jwtSecret) {
                decoded = jwt.verify(token, config.jwtSecret as string);
            } else {
                // Fallback: treat as plain user ID (legacy local auth)
                decoded = { id: token, email: token };
            }
        } catch (e) {
            if (isProtectedPage) return sendRedirect(event, '/login');
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid or expired token'
            });
        }

        event.context.user = {
            id: decoded.email || decoded.sub || decoded.id || 'unknown',
            email: decoded.email || 'unknown',
            workspaceId: decoded.workspaceId || 'personal',
            authMethod: decoded.authMethod || 'credentials',
            providerId: decoded.providerId || null
        };

        if (path.startsWith('/admin/sso') || path.startsWith('/api/admin/sso')) {
            const config = useRuntimeConfig();
            const adminEmail = config.adminEmail as string;
            if (adminEmail && decoded.email?.toLowerCase() !== adminEmail.toLowerCase()) {
                if (isProtectedPage) return sendRedirect(event, '/');
                throw createError({
                    statusCode: 403,
                    statusMessage: 'Forbidden: Admin access required'
                });
            }
        }
    }
});
