import { createError, defineEventHandler, readBody, setCookie } from "h3";

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<RegisterPayload>(event);
    const { name, email, password, passwordConfirmation } = body;

    if (!name || !email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Missing required fields",
      });
    }

    if (password !== passwordConfirmation) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Passwords do not match",
      });
    }

    if (password.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Password must be at least 8 characters",
      });
    }

    // TODO: Integrate with third-party registration API
    // This is a stub that simulates successful registration

    const mockToken = "mock-register-token-" + Date.now();
    setCookie(event, "session_token", mockToken, {
      httpOnly: true,
      path: "/",
    });

    return {
      status: "success",
      data: {
        access_token: mockToken,
      },
    };
  } catch (error: unknown) {
    const err = error as any;
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || "Internal Server Error",
      message: err.message || "An error occurred during registration",
    });
  }
});
