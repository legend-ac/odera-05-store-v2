import { existsSync, lstatSync, readdirSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
const dryRun = process.argv.includes("--dry-run");
const targets = [
  ...(process.argv.includes("--all") ? [".next"] : []),
  ".next-quality",
  ".next-corrupt-local-cache",
  "coverage",
  "playwright-report",
  "test-results",
  "integration-results",
  "node_modules/.cache",
  "node_modules/.vite",
  "node_modules/.vite-temp",
  "tsconfig.tsbuildinfo",
  "firebase-debug.log",
];

function assertInsideRoot(absolute) {
  const child = relative(root, absolute);
  if (!child || child === ".." || child.startsWith(`..\\`) || child.startsWith("../") || isAbsolute(child)) {
    throw new Error(`Unsafe cleanup target: ${absolute}`);
  }
  if (existsSync(absolute)) {
    const actual = realpathSync(absolute);
    const actualChild = relative(root, actual);
    if (!actualChild || actualChild === ".." || actualChild.startsWith(`..\\`) || actualChild.startsWith("../") || isAbsolute(actualChild)) {
      throw new Error(`Cleanup target resolves outside the project: ${absolute}`);
    }
  }
}

function bytesIn(absolute) {
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) return 0;
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(absolute).reduce((sum, name) => sum + bytesIn(join(absolute, name)), 0);
}

let removedBytes = 0;
for (const target of targets) {
  const absolute = resolve(root, target);
  assertInsideRoot(absolute);
  if (!existsSync(absolute)) continue;
  if (lstatSync(absolute).isSymbolicLink()) continue;
  const bytes = bytesIn(absolute);
  if (!dryRun) rmSync(absolute, { recursive: lstatSync(absolute).isDirectory(), force: true });
  removedBytes += bytes;
  console.log(`${dryRun ? "Would remove" : "Removed"} ${target} (${(bytes / 1024 / 1024).toFixed(2)} MiB)`);
}

// Backup exports are data. Only remove empty directories, never backup files.
function removeEmptyBackupFolders(absolute) {
  assertInsideRoot(absolute);
  if (!existsSync(absolute) || lstatSync(absolute).isSymbolicLink()) return false;
  let empty = true;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (!removeEmptyBackupFolders(join(absolute, entry.name))) empty = false;
    } else empty = false;
  }
  if (empty) {
    if (!dryRun) rmdirSync(absolute);
    console.log(`${dryRun ? "Would remove" : "Removed"} empty ${relative(root, absolute)}`);
  }
  return empty;
}

removeEmptyBackupFolders(resolve(root, "backup"));
console.log(`${dryRun ? "Recoverable" : "Recovered"}: ${(removedBytes / 1024 / 1024).toFixed(2)} MiB`);
