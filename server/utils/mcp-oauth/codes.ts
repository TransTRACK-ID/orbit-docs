import { randomBytes } from "node:crypto";

export interface AuthorizationCodeRecord {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  expiresAt: number;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const codes = new Map<string, AuthorizationCodeRecord>();

function purgeExpiredCodes(): void {
  const now = Date.now();
  for (const [code, record] of codes.entries()) {
    if (record.expiresAt <= now) {
      codes.delete(code);
    }
  }
}

export function createAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}): string {
  purgeExpiredCodes();

  const code = randomBytes(32).toString("base64url");
  codes.set(code, {
    code,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scope: input.scope,
    expiresAt: Date.now() + CODE_TTL_MS,
  });

  return code;
}

export function consumeAuthorizationCode(
  code: string,
): AuthorizationCodeRecord | undefined {
  purgeExpiredCodes();
  const record = codes.get(code);
  if (!record) {
    return undefined;
  }

  codes.delete(code);
  if (record.expiresAt <= Date.now()) {
    return undefined;
  }

  return record;
}
