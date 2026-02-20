import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/server/firebaseAdmin";
import { sessionLoginSchema } from "@/schemas/sessionLogin";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/server/adminSession";
import { generateCsrfToken } from "@/lib/server/csrf";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as unknown;
    const parsed = sessionLoginSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
    }

    // CSRF check (double submit)
    const csrfCookie = req.headers.get("cookie")?.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`))?.[1];
    const csrfHeader = req.headers.get("x-csrf");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json({ error: "CSRF_FAILED" }, { status: 403 });
    }

    const decoded = await adminAuth.verifyIdToken(parsed.data.idToken, true);
    if (!isAdminAllowed(decoded as unknown as Record<string, unknown>)) {
      return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });
    }

    const expiresIn = 8 * 60 * 60 * 1000; // 8h
    const sessionCookie = await adminAuth.createSessionCookie(parsed.data.idToken, { expiresIn });

    const res = NextResponse.json({ ok: true }, { status: 200 });

    const isProd = process.env.NODE_ENV === "production";

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });

    // Refresh CSRF token as well (optional). Keep non-httpOnly so client can read and send header.
    const newCsrf = generateCsrfToken();
    res.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: newCsrf,
      httpOnly: false,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });

    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[session-login] error", msg);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
