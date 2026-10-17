import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const declarations = new URL("../next-env.d.ts", import.meta.url);
const previousDeclarations = existsSync(declarations) ? readFileSync(declarations, "utf8") : null;
let result;
try {
  result = spawnSync("npx", ["next", "build", "--no-lint"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ODERA_BUILD_DIR: ".next-quality" },
  });
} finally {
  // An isolated build must not leave the developer's route types pointing at
  // its disposable output directory.
  if (previousDeclarations !== null) writeFileSync(declarations, previousDeclarations);
}

process.exit(result.status ?? 1);
