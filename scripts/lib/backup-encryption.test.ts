import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "./backup-encryption";

const key = "ab".repeat(32);
const content = JSON.stringify([{ id: "order-1", customer: { name: "Cliente de prueba" } }]);

describe("cifrado de respaldos", () => {
  it("permite recuperar los datos originales sin dejarlos legibles en el respaldo", () => {
    const encrypted = encryptBackup(content, key);
    expect(encrypted).not.toContain("Cliente de prueba");
    expect(decryptBackup(encrypted, key)).toBe(content);
    expect(encryptBackup(content, key)).not.toBe(encrypted);
  });

  it("rechaza una clave diferente y un contenido modificado", () => {
    const encrypted = encryptBackup(content, key);
    expect(() => decryptBackup(encrypted, "cd".repeat(32))).toThrow();
    const envelope = JSON.parse(encrypted);
    const altered = Buffer.from(envelope.ciphertext, "base64");
    altered[0] = altered[0]! ^ 1;
    envelope.ciphertext = altered.toString("base64");
    expect(() => decryptBackup(JSON.stringify(envelope), key)).toThrow();
  });

  it.each(["", "short", "zz".repeat(32)])("no acepta una clave inválida", invalidKey => {
    expect(() => encryptBackup(content, invalidKey)).toThrow("BACKUP_ENCRYPTION_KEY");
  });
});
