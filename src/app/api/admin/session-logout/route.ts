import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/server/adminSession";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const csrfCookie = req.headers.get("cookie")?.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`))?.[1];
    const csrfHeader = req.headers.get("x-csrf");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json({ error: "CSRF_FAILED" }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    const isProd = process.env.NODE_ENV === "production";

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    // Clear CSRF too
    res.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: "",
      httpOnly: false,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[session-logout] error", msg);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
