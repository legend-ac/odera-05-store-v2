import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/server/firebaseAdmin";
import { getServerEnv } from "@/lib/env";

export const SESSION_COOKIE_NAME = "odera_session";
export const CSRF_COOKIE_NAME = "odera_csrf";

export type AdminSession = {
  uid: string;
  email: string;
  authTime: number;
  exp: number;
};

function parseAllowlistEmails(raw: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!raw) return set;
  raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .forEach((x) => set.add(x));
  return set;
}

function isAdminAllowed(decoded: Record<string, unknown>): boolean {
  if (decoded.admin === true) return true;
  const email = typeof decoded.email === "string" ? decoded.email.toLowerCase() : "";
  const env = getServerEnv();
  const allow = parseAllowlistEmails(env.ADMIN_ALLOWLIST_EMAILS);
  if (email && allow.has(email)) return true;
  return false;
}

export async function verifyAdminSessionCookie(sessionCookie: string): Promise<AdminSession> {
  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  if (!isAdminAllowed(decoded as Record<string, unknown>)) {
    throw new Error("NOT_ADMIN");
  }
  const email = typeof decoded.email === "string" ? decoded.email : "";
  const uid = decoded.uid;

  const authTime = typeof (decoded as any).auth_time === "number" ? (decoded as any).auth_time : 0;
  const exp = typeof (decoded as any).exp === "number" ? (decoded as any).exp : 0;

  // Enforce "auth_time < 8h" guardrail (reauth if too old)
  const nowSec = Math.floor(Date.now() / 1000);
  const eightHours = 8 * 60 * 60;
  if (!authTime || nowSec - authTime > eightHours) {
    throw new Error("AUTH_TOO_OLD");
  }

  return { uid, email, authTime, exp };
}

export async function requireAdminSessionOrRedirect(): Promise<AdminSession> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) redirect("/login");
  try {
    const session = await verifyAdminSessionCookie(cookie);
    return session;
  } catch (e) {
    console.warn("[admin] invalid session", e);
    redirect("/login");
  }
}
