"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/apiClient";
import { formatPEN } from "@/lib/money";

type TrackResponse = {
  orderId: string;
  publicCode: string;
  status: string;
  reservedUntilMs: number | null;
  itemsSnapshots: { nameSnapshot: string; qty: number; unitPriceSnapshot: number }[];
  totals: { subtotal: number; discountAmount?: number; shippingCost?: number; totalToPay: number } | null;
  couponCode?: string;
  shipping?:
    | {
        method: "LIMA_DELIVERY";
        receiverName: string;
        receiverDni: string;
        receiverPhone: string;
        district: string;
        addressLine1: string;
        reference?: string;
      }
    | {
        method: "AGENCIA_PROVINCIA";
        receiverName: string;
        receiverDni: string;
        receiverPhone: string;
        department: string;
        province: string;
        agencyName: string;
        agencyAddress: string;
        reference?: string;
      };
  payment: { operationCode?: string; method?: string; paymentSentAt?: any };
};

function statusLabel(status: string) {
  const map: Record<string, string> = {
    SCHEDULED: "Pedido registrado",
    PAYMENT_SENT: "Pago enviado",
    PAID: "Pago confirmado",
    PREPARING: "Preparando pedido",
    SHIPPED: "En camino",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
    EXPIRED: "Vencido",
  };
  return map[status] ?? status;
}

function shippingLabel(shipping: TrackResponse["shipping"]): string {
  if (!shipping) return "";
  if (shipping.method === "LIMA_DELIVERY") {
    return `Delivery Lima Metropolitana - ${shipping.district} (Recibe: ${shipping.receiverName})`;
  }
  return `Agencia provincia - ${shipping.department}, ${shipping.province} (${shipping.agencyName}) - Recoge: ${shipping.receiverName}`;
}

function TrackPageInner() {
  const searchParams = useSearchParams();

  const [publicCode, setPublicCode] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [operationCode, setOperationCode] = useState("");
  const [method, setMethod] = useState<"YAPE" | "PLIN" | "OTHER">("YAPE");
  const [busyPay, setBusyPay] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const expired = useMemo(() => {
    if (!data?.reservedUntilMs) return false;
    return Date.now() > data.reservedUntilMs;
  }, [data?.reservedUntilMs]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMsg(`${label} copiado.`);
      setTimeout(() => setCopyMsg(null), 1800);
    } catch {
      setCopyMsg("No se pudo copiar. Copialo manualmente.");
      setTimeout(() => setCopyMsg(null), 1800);
    }
  }

  async function load(nextPublicCode?: string, nextTrackingToken?: string) {
    const code = (nextPublicCode ?? publicCode).trim();
    const token = (nextTrackingToken ?? trackingToken).trim();

    setBusy(true);
    setError(null);
    setData(null);
    try {
      const res = await apiPost<TrackResponse>("/api/track", { publicCode: code, trackingToken: token });
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo consultar el pedido.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const qCode = searchParams.get("publicCode") ?? "";
    const qToken = searchParams.get("trackingToken") ?? "";
    if (!qCode || !qToken) return;

    setPublicCode(qCode);
    setTrackingToken(qToken);
    void load(qCode, qToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function submitPayment() {
    setBusyPay(true);
    setPayMsg(null);
    try {
      const res = await apiPost<{ ok: boolean; idempotent: boolean }>("/api/submit-payment", {
        publicCode,
        trackingToken,
        operationCode,
        method,
      });
      setPayMsg(res.idempotent ? "Ese codigo ya estaba registrado para este pedido." : "Pago reportado correctamente.");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo registrar el pago.";
      setPayMsg(`Error: ${msg}`);
    } finally {
      setBusyPay(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mis pedidos</h1>

      <div className="grid gap-3 border border-neutral-200 rounded-xl p-4">
        <label className="text-sm font-medium">Codigo de pedido (ejemplo: OD-1234)</label>
        <div className="flex gap-2">
          <input
            value={publicCode}
            onChange={(e) => setPublicCode(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm w-full"
          />
          <button type="button" onClick={() => copyText(publicCode, "Codigo")} className="px-3 py-2 rounded-md border border-neutral-300 text-sm">
            Copiar
          </button>
        </div>

        <label className="text-sm font-medium">Clave de seguimiento</label>
        <div className="flex gap-2">
          <input
            value={trackingToken}
            onChange={(e) => setTrackingToken(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm font-mono w-full"
          />
          <button type="button" onClick={() => copyText(trackingToken, "Clave")} className="px-3 py-2 rounded-md border border-neutral-300 text-sm">
            Copiar
          </button>
        </div>

        <button type="button" onClick={() => load()} disabled={busy} className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50">
          {busy ? "Buscando..." : "Consultar pedido"}
        </button>

        {copyMsg ? <div className="text-xs text-emerald-700">{copyMsg}</div> : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>

      {data ? (
        <div className="border border-neutral-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Pedido {data.publicCode}</div>
            <div className="text-sm px-2 py-1 rounded-md bg-neutral-100">{statusLabel(data.status)}</div>
          </div>

          {data.shipping ? <div className="text-sm text-neutral-700">Envio: {shippingLabel(data.shipping)}</div> : null}

          {data.reservedUntilMs ? (
            <div className="text-sm text-neutral-600">
              Reserva vigente hasta: {new Date(data.reservedUntilMs).toLocaleString("es-PE")} {expired ? "(vencida)" : ""}
            </div>
          ) : null}

          <div className="text-sm">
            {data.itemsSnapshots?.map((it, idx) => (
              <div key={idx} className="flex justify-between">
                <span>
                  {it.nameSnapshot} x {it.qty}
                </span>
                <span>{formatPEN(it.unitPriceSnapshot * it.qty)}</span>
              </div>
            ))}
          </div>

          {data.totals ? (
            <>
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatPEN(data.totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Descuento</span>
                <span>{data.totals.discountAmount ? `-${formatPEN(data.totals.discountAmount)}` : formatPEN(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Envio</span>
                <span>{data.totals.shippingCost ? formatPEN(data.totals.shippingCost) : "Gratis"}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPEN(data.totals.totalToPay)}</span>
              </div>
              {data.couponCode ? (
                <div className="text-xs text-emerald-700">Cupon aplicado: {data.couponCode}</div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {data && (data.status === "SCHEDULED" || data.status === "PAYMENT_SENT") ? (
        <div className="border border-neutral-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="font-medium">Enviar comprobante</div>

          <label className="text-sm font-medium">Codigo de operacion</label>
          <input value={operationCode} onChange={(e) => setOperationCode(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

          <label className="text-sm font-medium">Medio de pago</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as any)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm w-48">
            <option value="YAPE">Yape</option>
            <option value="PLIN">Plin</option>
            <option value="OTHER">Otro</option>
          </select>

          <button
            type="button"
            onClick={submitPayment}
            disabled={busyPay || !operationCode}
            className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
          >
            {busyPay ? "Enviando..." : "Enviar comprobante"}
          </button>

          {payMsg ? <div className="text-sm text-neutral-700">{payMsg}</div> : null}
          <div className="text-xs text-neutral-500">Usa el mismo codigo que aparece en tu comprobante.</div>
        </div>
      ) : null}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-8 text-sm text-neutral-600">Cargando...</div>}>
      <TrackPageInner />
    </Suspense>
  );
}
