import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { sendTransactionalEmail } from "@/lib/server/email";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);

    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const admin = await verifyAdminSessionCookie(sessionCookie);
    const result = await sendTransactionalEmail({
      to: admin.email,
      subject: "Prueba SMTP - ODERA 05",
      text: "Correo de prueba enviado desde el panel administrador de ODERA 05.",
      html: "<p>Correo de prueba enviado desde el panel administrador de <strong>ODERA 05</strong>.</p>",
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, to: admin.email }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[admin/health/test-email] error", msg);
    return NextResponse.json({ error: msg }, { status: msg === "CSRF_FAILED" ? 403 : 500 });
  }
}
