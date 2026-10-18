import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decryptBackup } from "./lib/backup-encryption";

const [input, output] = process.argv.slice(2);
if (!input || !output || !process.env.BACKUP_ENCRYPTION_KEY) {
  throw new Error("Use: node --env-file=.env.local --import tsx scripts/decrypt-backup.ts input.json.enc output.json");
}
const plaintext = decryptBackup(readFileSync(resolve(input), "utf8"), process.env.BACKUP_ENCRYPTION_KEY);
// Authenticate the complete file before writing, and never overwrite an export.
writeFileSync(resolve(output), plaintext, { flag: "wx", mode: 0o600 });
console.log("Backup decrypted. No data was written to Firestore.");
