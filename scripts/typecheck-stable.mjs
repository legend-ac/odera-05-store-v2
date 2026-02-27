import { spawnSync } from "node:child_process";

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  return result.status ?? 1;
};

const runTsc = () => run("npx", ["tsc", "-p", "tsconfig.json", "--noEmit"]);

let status = runTsc();
if (status === 0) {
  process.exit(0);
}

// If Next generated types are stale/missing, regenerate and retry once.
status = run("npx", ["next", "build", "--no-lint"]);
if (status !== 0) {
  process.exit(status);
}

status = runTsc();
process.exit(status);

