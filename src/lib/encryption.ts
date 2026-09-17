import crypto from "crypto";

const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY; 
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM
 */
export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("SMTP_ENCRYPTION_KEY is not defined in environment variables");
  }

  let key: Buffer;
  try {
    key = Buffer.from(ENCRYPTION_KEY, "hex");
    if (key.length !== 32) throw new Error();
  } catch {
    throw new Error("SMTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  // Combine IV, Tag, and Encrypted Text (hex format)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a string using AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("SMTP_ENCRYPTION_KEY is not defined in environment variables");
  }

  let key: Buffer;
  try {
    key = Buffer.from(ENCRYPTION_KEY, "hex");
    if (key.length !== 32) throw new Error();
  } catch {
    throw new Error("SMTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }

  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) return encryptedData; // Fallback if not encrypted (e.g. legacy plain text)

    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const encryptedText = Buffer.from(parts[2], "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error("Failed to decrypt data");
  }
}
