import "server-only";

import { adminAppCheck } from "@/lib/server/firebaseAdmin";
import { getServerEnv } from "@/lib/env";

export async function verifyAppCheckIfEnabled(req: Request): Promise<void> {
  const env = getServerEnv();
  const enabled = env.ENABLE_APP_CHECK_VERIFY === "true";
  if (!enabled) return;

  const token = req.headers.get("x-firebase-appcheck");
  if (!token) {
    throw new Error("APP_CHECK_MISSING");
  }
  try {
    await adminAppCheck.verifyToken(token);
  } catch (e) {
    console.warn("[AppCheck] verify failed", e);
    throw new Error("APP_CHECK_INVALID");
  }
}
