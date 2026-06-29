import crypto from "crypto";
import { getAppKey } from "~/server/utils/runtime-env";

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(plainText: string): string {
  const key = deriveKey(getAppKey());
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([nonce, encrypted, authTag]).toString("base64");
}

export function decryptSecret(cipherText: string): string {
  const key = deriveKey(getAppKey());
  const buf = Buffer.from(cipherText, "base64");
  const nonce = buf.subarray(0, 12);
  const authTag = buf.subarray(buf.length - 16);
  const encrypted = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}
