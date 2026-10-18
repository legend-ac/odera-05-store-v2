import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function parseKey(key: string): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error("BACKUP_ENCRYPTION_KEY must contain 64 hexadecimal characters");
  }
  return Buffer.from(key, "hex");
}

export function encryptBackup(plaintext: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", parseKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return JSON.stringify({
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64"),
  });
}

export function decryptBackup(encrypted: string, key: string): string {
  const envelope = JSON.parse(encrypted);
  if (envelope?.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported encrypted backup format");
  }
  for (const field of ["iv", "tag", "ciphertext"] as const) {
    if (typeof envelope[field] !== "string") throw new Error("Invalid encrypted backup");
  }
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted backup");
  const decipher = createDecipheriv("aes-256-gcm", parseKey(key), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
