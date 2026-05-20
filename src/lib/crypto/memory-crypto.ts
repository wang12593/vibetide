import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

function getEncryptionKey(masterKey?: string): string {
  const key = masterKey || process.env.MEMORY_ENCRYPTION_KEY;
  if (!key) throw new Error("MEMORY_ENCRYPTION_KEY is required. Set it in .env.local");
  return key;
}

export function encryptMemory(plaintext: string, masterKey?: string): {
  encrypted: string;
  iv: string;
  salt: string;
} {
  const secret = getEncryptionKey(masterKey);
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    salt: salt.toString("base64"),
  };
}

export function decryptMemory(
  encryptedData: string,
  ivData: string,
  saltData: string,
  masterKey?: string,
): string {
  const secret = getEncryptionKey(masterKey);
  const salt = Buffer.from(saltData, "base64");
  const key = deriveKey(secret, salt);
  const iv = Buffer.from(ivData, "base64");

  const encrypted = Buffer.from(encryptedData, "base64");
  const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function isEncrypted(content: string): boolean {
  try {
    const buf = Buffer.from(content, "base64");
    return buf.length > AUTH_TAG_LENGTH + IV_LENGTH;
  } catch {
    return false;
  }
}
