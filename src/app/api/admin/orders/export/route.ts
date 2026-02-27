import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { filterExportRows, parseExportFilters } from "@/lib/orderExport";

export const runtime = "nodejs";
export const maxDuration = 60;

function esc(v: unknown): string {
  const s = String(v ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toIso(ts: any): string {
  if (!ts) return "";
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return "";
}

function toMs(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return null;
}

export async function GET(req: Request) {
  try {
    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    await verifyAdminSessionCookie(sessionCookie);

    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const filters = parseExportFilters(searchParams);

    const snap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(2500).get();

    const rowsRaw = snap.docs.map((d) => {
      const o = d.data() as any;
      const createdAtIso = toIso(o?.createdAt);
      const createdAtMs = toMs(o?.createdAt);
      const deletedAtMs = toMs(o?.deletedAt);
      const shipping = o?.shipping ?? {};
      const shippingType = shipping?.method ?? "";
      const destination =
        shippingType === "LIMA_DELIVERY"
          ? `${shipping?.district ?? ""} ${shipping?.addressLine1 ?? ""}`.trim()
          : `${shipping?.department ?? ""} ${shipping?.province ?? ""} ${shipping?.agencyName ?? ""}`.trim();

      return {
        publicCode: o?.publicCode ?? "",
        status: o?.status ?? "",
        createdAtIso,
        createdAtMs,
        deletedAtMs,
        customerName: o?.customer?.name ?? "",
        customerEmail: o?.customer?.email ?? "",
        customerPhone: o?.customer?.phone ?? "",
        paymentMethod: o?.payment?.method ?? "",
        subtotal: Number(o?.totals?.subtotal ?? 0),
        discount: Number(o?.totals?.discountAmount ?? 0),
        shippingCost: Number(o?.totals?.shippingCost ?? 0),
        total: Number(o?.totals?.totalToPay ?? 0),
        couponCode: o?.couponCode ?? "",
        shippingType,
        destination,
      };
    });

    const rows = filterExportRows(rowsRaw, filters);

    const detailHeaders = [
      "NroPedido",
      "Estado",
      "FechaISO",
      "Cliente",
      "Correo",
      "Telefono",
      "MetodoPago",
      "Subtotal_S",
      "Descuento_S",
      "Envio_S",
      "Total_S",
      "Cupon",
      "TipoEnvio",
      "Destino",
    ];

    let csv = "";
    if (filters.template === "resumen") {
      const totalPedidos = rows.length;
      const ventaTotal = rows.reduce((acc, r) => acc + r.total, 0);
      const subtotalTotal = rows.reduce((acc, r) => acc + r.subtotal, 0);
      const descuentoTotal = rows.reduce((acc, r) => acc + r.discount, 0);
      const envioTotal = rows.reduce((acc, r) => acc + r.shippingCost, 0);
      const ticketPromedio = totalPedidos > 0 ? ventaTotal / totalPedidos : 0;

      const byStatus = new Map<string, { qty: number; total: number }>();
      const byPayment = new Map<string, { qty: number; total: number }>();
      for (const r of rows) {
        const statusKey = r.status || "SIN_ESTADO";
        const pmKey = r.paymentMethod || "SIN_METODO";
        const s = byStatus.get(statusKey) ?? { qty: 0, total: 0 };
        s.qty += 1;
        s.total += r.total;
        byStatus.set(statusKey, s);
        const p = byPayment.get(pmKey) ?? { qty: 0, total: 0 };
        p.qty += 1;
        p.total += r.total;
        byPayment.set(pmKey, p);
      }

      const generatedAt = new Date().toISOString();
      const resumenRows: string[][] = [
        ["Reporte", "Resumen ejecutivo de ventas ODERA 05"],
        ["Generado", generatedAt],
        ["Filtro fecha desde", filters.from || "-"],
        ["Filtro fecha hasta", filters.to || "-"],
        ["Filtro estado", filters.status || "TODOS"],
        ["Incluye papelera", filters.includeTrash ? "SI" : "NO"],
        [""],
        ["Indicador", "Valor"],
        ["Pedidos", String(totalPedidos)],
        ["Subtotal acumulado", subtotalTotal.toFixed(2)],
        ["Descuento acumulado", descuentoTotal.toFixed(2)],
        ["Envio acumulado", envioTotal.toFixed(2)],
        ["Venta total", ventaTotal.toFixed(2)],
        ["Ticket promedio", ticketPromedio.toFixed(2)],
        [""],
        ["Estado", "Cantidad", "Total S/"],
      ];
      for (const [k, v] of Array.from(byStatus.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        resumenRows.push([k, String(v.qty), v.total.toFixed(2)]);
      }
      resumenRows.push([""]);
      resumenRows.push(["Metodo de pago", "Cantidad", "Total S/"]);
      for (const [k, v] of Array.from(byPayment.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        resumenRows.push([k, String(v.qty), v.total.toFixed(2)]);
      }
      csv = resumenRows.map((r) => r.map(esc).join(";")).join("\n");
    } else {
      const detailRows = rows.map((r) => [
        r.publicCode,
        r.status,
        r.createdAtIso,
        r.customerName,
        r.customerEmail,
        r.customerPhone,
        r.paymentMethod,
        r.subtotal.toFixed(2),
        r.discount.toFixed(2),
        r.shippingCost.toFixed(2),
        r.total.toFixed(2),
        r.couponCode,
        r.shippingType,
        r.destination,
      ]);
      csv = [detailHeaders, ...detailRows].map((r) => r.map(esc).join(";")).join("\n");
    }

    const bomCsv = `\uFEFFsep=;\n${csv}`;

    return new NextResponse(bomCsv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filters.template === "resumen" ? "ventas-odera05-resumen.csv" : "ventas-odera05-detalle.csv"}"`,
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
