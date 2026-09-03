import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { settings } from "~/server/database/schema";
import { encryptSecret, decryptSecret } from "~/server/utils/secret-crypto";

const CURSOR_API_KEY_SETTING = "cursor_api_key";

interface CursorApiKeyValue {
  encrypted: string;
}

/**
 * Read the encrypted Cursor API key from the database and decrypt it.
 * Falls back to process.env.CURSOR_API_KEY when no DB row exists.
 * Returns null when no key is configured anywhere.
 */
export async function getCursorApiKey(): Promise<string | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.key, CURSOR_API_KEY_SETTING))
      .limit(1)
  )[0];

  if (row?.value) {
    const parsed =
      typeof row.value === "string"
        ? (JSON.parse(row.value) as CursorApiKeyValue)
        : (row.value as CursorApiKeyValue);

    if (parsed?.encrypted) {
      try {
        return decryptSecret(parsed.encrypted);
      } catch {
        // Corrupted ciphertext — fall through to env fallback.
      }
    }
  }

  return process.env.CURSOR_API_KEY || null;
}

/**
 * Whether a Cursor API key is available (DB or env).
 */
export async function hasCursorApiKey(): Promise<boolean> {
  const key = await getCursorApiKey();
  return Boolean(key);
}

/**
 * Encrypt and persist the Cursor API key to the database.
 * Passing an empty string clears the stored key.
 */
export async function saveCursorApiKey(plainText: string): Promise<void> {
  const db = getDb();
  const trimmed = plainText.trim();

  const existing = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.key, CURSOR_API_KEY_SETTING))
      .limit(1)
  )[0];

  if (!trimmed) {
    if (existing) {
      await db.delete(settings).where(eq(settings.id, existing.id));
    }
    return;
  }

  const value: CursorApiKeyValue = { encrypted: encryptSecret(trimmed) };
  const json = JSON.stringify(value);

  if (existing) {
    await db
      .update(settings)
      .set({ value: json, updatedAt: new Date() })
      .where(eq(settings.id, existing.id));
    return;
  }

  await db.insert(settings).values({
    id: crypto.randomUUID(),
    key: CURSOR_API_KEY_SETTING,
    value: json,
  });
}
