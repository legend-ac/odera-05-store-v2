import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";

export const runtime = "nodejs";
export const maxDuration = 60;

function esc(v: unknown): string {
  const s = String(v ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET() {
  try {
    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    await verifyAdminSessionCookie(sessionCookie);

    const snap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(1000).get();

    const headers = [
      "Pedido",
      "Estado",
      "Fecha",
      "Cliente",
      "Correo",
      "Telefono",
      "MetodoPago",
      "Subtotal",
      "Descuento",
      "Envio",
      "Total",
      "Cupon",
      "TipoEnvio",
      "Destino",
    ];

    const rows = snap.docs.map((d) => {
      const o = d.data() as any;
      const createdAt =
        typeof o?.createdAt?.toDate === "function"
          ? o.createdAt.toDate().toISOString()
          : "";
      const shipping = o?.shipping ?? {};
      const shippingType = shipping?.method ?? "";
      const destination =
        shippingType === "LIMA_DELIVERY"
          ? `${shipping?.district ?? ""} ${shipping?.addressLine1 ?? ""}`.trim()
          : `${shipping?.department ?? ""} ${shipping?.province ?? ""} ${shipping?.agencyName ?? ""}`.trim();

      return [
        o?.publicCode ?? "",
        o?.status ?? "",
        createdAt,
        o?.customer?.name ?? "",
        o?.customer?.email ?? "",
        o?.customer?.phone ?? "",
        o?.payment?.method ?? "",
        Number(o?.totals?.subtotal ?? 0).toFixed(2),
        Number(o?.totals?.discountAmount ?? 0).toFixed(2),
        Number(o?.totals?.shippingCost ?? 0).toFixed(2),
        Number(o?.totals?.totalToPay ?? 0).toFixed(2),
        o?.couponCode ?? "",
        shippingType,
        destination,
      ];
    });

    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const bomCsv = `\uFEFF${csv}`;

    return new NextResponse(bomCsv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="ventas-odera05.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const codeToStatus: Record<string, number> = {
      NOT_ADMIN: 403,
      AUTH_TOO_OLD: 401,
    };
    return NextResponse.json({ error: msg }, { status: codeToStatus[msg] ?? 500 });
  }
}

