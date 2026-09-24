import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "build", "--no-lint"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, ODERA_BUILD_DIR: ".next-quality" },
});

process.exit(result.status ?? 1);
