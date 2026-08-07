import { requireSuperAdmin } from "~/server/utils/rbac";
import {
  getSsoConfig,
  hasEnabledSsoProviders,
  saveSsoConfig,
} from "~/server/utils/sso-config";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  const body = await readBody(event);
  const { disablePasswordAuth } = body as { disablePasswordAuth?: boolean };

  if (typeof disablePasswordAuth !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "disablePasswordAuth must be a boolean",
    });
  }

  const ssoConfig = await getSsoConfig();

  if (disablePasswordAuth && !hasEnabledSsoProviders(ssoConfig)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Enable at least one SSO provider before disabling email and password sign-in.",
    });
  }

  ssoConfig.disablePasswordAuth = disablePasswordAuth;
  await saveSsoConfig(ssoConfig);

  return {
    success: true,
    config: ssoConfig,
  };
});
