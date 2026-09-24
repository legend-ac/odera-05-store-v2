import { existsSync, lstatSync, rmSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = process.cwd();
const targets = [
  ".next-quality",
  "coverage",
  "playwright-report",
  "test-results",
  "tsconfig.tsbuildinfo",
  "firebase-debug.log",
];

for (const target of targets) {
  const absolute = resolve(root, target);
  if (relative(root, absolute).startsWith("..")) throw new Error(`Unsafe cleanup target: ${target}`);
  if (!existsSync(absolute)) continue;
  rmSync(absolute, { recursive: lstatSync(absolute).isDirectory(), force: true });
  console.log(`Removed ${target}`);
}
