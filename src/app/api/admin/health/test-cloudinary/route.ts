import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEST_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#0f7a3b"/><text x="16" y="20" text-anchor="middle" font-size="10" fill="white">05</text></svg>'
  );

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);

    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    await verifyAdminSessionCookie(sessionCookie);

    const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
    const uploadPreset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
    if (!cloudName || !uploadPreset) {
      return NextResponse.json({ error: "CLOUDINARY_NOT_CONFIGURED" }, { status: 400 });
    }

    const form = new FormData();
    form.append("file", TEST_IMAGE);
    form.append("upload_preset", uploadPreset);
    form.append("folder", "admin-health");

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      return NextResponse.json({ error: json?.error?.message ?? `HTTP_${res.status}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, url: json?.secure_url ?? "" }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[admin/health/test-cloudinary] error", msg);
    return NextResponse.json({ error: msg }, { status: msg === "CSRF_FAILED" ? 403 : 500 });
  }
}
