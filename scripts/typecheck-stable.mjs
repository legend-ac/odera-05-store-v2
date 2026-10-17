import { spawnSync } from "node:child_process";

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  return result.status ?? 1;
};

// Route types are small and reproducible. Regenerate them without creating an
// entire production build when caches have just been cleaned.
let status = run("npx", ["next", "typegen"]);
if (status !== 0) {
  process.exit(status);
}

status = run("npx", ["tsc", "-p", "tsconfig.json", "--noEmit"]);
process.exit(status);

