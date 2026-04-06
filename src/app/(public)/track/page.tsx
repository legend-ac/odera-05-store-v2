"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { apiPost } from "@/lib/apiClient";
import { formatPEN } from "@/lib/money";
import { db } from "@/lib/firebase/client";
import { Input, Select } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

type TrackResponse = {
  orderId: string;
  publicCode: string;
  status: string;
  customer?: { name?: string; email?: string; phone?: string };
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

const STATUS_STYLE: Record<string, { dot: string; badge: string; label: string }> = {
  PENDING_VALIDATION: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Pendiente de validación" },
  SCHEDULED: { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-700 border-slate-200", label: "Pedido registrado" },
  PAYMENT_SENT: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200", label: "Pago reportado" },
  PAID: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Pago confirmado" },
  PREPARING: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "Preparando pedido" },
  SHIPPED: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "En camino" },
  DELIVERED: { dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "Entregado" },
  CANCELLED: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200", label: "Cancelado" },
  EXPIRED: { dot: "bg-rose-400", badge: "bg-rose-50 text-rose-600 border-rose-200", label: "Vencido" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-700 border-slate-200", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function shippingLabel(shipping: TrackResponse["shipping"]): string {
  if (!shipping) return "";
  if (shipping.method === "LIMA_DELIVERY") {
    return `Delivery Lima — ${shipping.district} (Recibe: ${shipping.receiverName})`;
  }
  return `Agencia provincia — ${shipping.department}, ${shipping.province} (${shipping.agencyName}) — Recoge: ${shipping.receiverName}`;
}

function onlyDigits(v: string): string {
  return v.replace(/\D+/g, "");
}

function shippingAddressText(shipping: TrackResponse["shipping"]): string {
  if (!shipping) return "-";
  if (shipping.method === "LIMA_DELIVERY") {
    return `${shipping.district} - ${shipping.addressLine1}${shipping.reference ? ` (Ref: ${shipping.reference})` : ""}`;
  }
  return `${shipping.department}, ${shipping.province} - Agencia ${shipping.agencyName} (${shipping.agencyAddress})${shipping.reference ? ` (Ref: ${shipping.reference})` : ""}`;
}

function TrackPageInner() {
  const [trackingUrl, setTrackingUrl] = useState("");
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
  const [recent, setRecent] = useState<Array<{ publicCode: string; trackingToken: string; ts: number }>>([]);
  const [businessWhatsapp, setBusinessWhatsapp] = useState("");

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
      setCopyMsg("No se pudo copiar. Inténtalo de nuevo.");
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
    } catch {
      setError("No pudimos encontrar tu pedido. Revisa el número y el código de seguimiento.");
    } finally {
      setBusy(false);
    }
  }

  function applyTrackingUrl() {
    try {
      if (!trackingUrl.trim()) return;
      const u = new URL(trackingUrl.trim());
      const code = (u.searchParams.get("publicCode") ?? "").trim();
      const token = (u.searchParams.get("trackingToken") ?? "").trim();
      if (!code || !token) {
        setError("El enlace no contiene los datos de seguimiento necesarios.");
        return;
      }
      setError(null);
      setPublicCode(code);
      setTrackingToken(token);
      void load(code, token);
    } catch {
      setError("El enlace de seguimiento no es válido.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qCode = params.get("publicCode") ?? "";
    const qToken = params.get("trackingToken") ?? "";
    if (!qCode || !qToken) return;

    setPublicCode(qCode);
    setTrackingToken(qToken);
    void load(qCode, qToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("odera_recent_tracking");
      const list = raw ? (JSON.parse(raw) as Array<{ publicCode: string; trackingToken: string; ts: number }>) : [];
      setRecent(Array.isArray(list) ? list.slice(0, 5) : []);
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "store"));
        if (!mounted || !snap.exists()) return;
        const raw = String(snap.data()?.publicWhatsapp ?? "");
        if (!raw) return;
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
          setBusinessWhatsapp(raw);
          return;
        }
        const digits = onlyDigits(raw);
        if (digits) setBusinessWhatsapp(`https://wa.me/${digits}`);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const waText = useMemo(() => {
    if (!data) return "";
    const name = data.customer?.name ?? data.shipping?.receiverName ?? "-";
    const phone = data.customer?.phone ?? data.shipping?.receiverPhone ?? "-";
    const address = shippingAddressText(data.shipping);
    const paymentMethod = data.payment?.method ?? "-";
    const items = (data.itemsSnapshots ?? [])
      .map((it) => `- ${it.nameSnapshot} x${it.qty} (S/ ${(Number(it.unitPriceSnapshot) * Number(it.qty)).toFixed(2)})`)
      .join("\n");
    const total = data.totals?.totalToPay ?? 0;
    return [
      `Pedido: ${data.publicCode}`,
      `Código de seguimiento: ${trackingToken || "-"}`,
      `Nombre: ${name}`,
      `Teléfono: ${phone}`,
      `Dirección: ${address}`,
      `Método de pago: ${paymentMethod}`,
      "",
      "Productos:",
      items || "-",
      "",
      `Total: S/ ${Number(total).toFixed(2)}`,
      "",
      "Adjunto mi comprobante",
    ].join("\n");
  }, [data, trackingToken]);

  const waHref = useMemo(() => {
    if (!businessWhatsapp || !waText) return "";
    if (businessWhatsapp.includes("wa.me/")) return `${businessWhatsapp}?text=${encodeURIComponent(waText)}`;
    return businessWhatsapp;
  }, [businessWhatsapp, waText]);

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
      setPayMsg(res.idempotent ? "Ese código ya estaba registrado para este pedido." : "Comprobante enviado correctamente.");
      await load();
    } catch {
      setPayMsg("No se pudo registrar el comprobante. Intenta nuevamente.");
    } finally {
      setBusyPay(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Seguimiento de pedido</h1>
        <p className="text-sm text-slate-500 mt-1">Consulta el estado de tu compra con tu número de pedido y código de seguimiento.</p>
      </div>

      {/* Search Form */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] p-5 flex flex-col gap-4">
        {recent.length ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pedidos recientes</label>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={`${r.publicCode}:${r.trackingToken}`}
                  type="button"
                  onClick={() => {
                    setPublicCode(r.publicCode);
                    setTrackingToken(r.trackingToken);
                    void load(r.publicCode, r.trackingToken);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-[var(--surface-muted)] text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-[var(--surface-hover)] transition-all duration-150"
                >
                  {r.publicCode}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Pegar enlace de seguimiento (opcional)</label>
          <div className="flex gap-2">
            <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://.../track?publicCode=OD-0001&trackingToken=..." uiSize="sm" />
            <Button type="button" variant="secondary" size="sm" onClick={applyTrackingUrl}>Cargar</Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Número de pedido (ejemplo: OD-1234)</label>
          <div className="flex gap-2">
            <Input value={publicCode} onChange={(e) => setPublicCode(e.target.value)} uiSize="sm" />
            <Button type="button" variant="secondary" size="sm" onClick={() => copyText(publicCode, "Número")}>Copiar</Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Código de seguimiento</label>
          <div className="flex gap-2">
            <Input value={trackingToken} onChange={(e) => setTrackingToken(e.target.value)} uiSize="sm" className="font-mono" />
            <Button type="button" variant="secondary" size="sm" onClick={() => copyText(trackingToken, "Código")}>Copiar</Button>
          </div>
        </div>

        <Button type="button" onClick={() => load()} disabled={busy} size="md">
          {busy ? "Buscando..." : "Consultar pedido"}
        </Button>

        {copyMsg ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            {copyMsg}
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 text-sm text-destructive bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {error}
          </div>
        ) : null}
      </div>

      {/* Order Result */}
      {data ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] overflow-hidden fade-in-up">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">{data.publicCode}</span>
            </div>
            <StatusPill status={data.status} />
          </div>

          <div className="p-5 flex flex-col gap-3">
            {data.shipping ? <p className="text-sm text-slate-600">Envío: {shippingLabel(data.shipping)}</p> : null}

            {data.reservedUntilMs ? (
              <p className="text-sm text-slate-500">
                Reserva vigente hasta: {new Date(data.reservedUntilMs).toLocaleString("es-PE")}{expired ? " (vencida)" : ""}
              </p>
            ) : null}

            <div className="border-t border-slate-100 pt-3 flex flex-col gap-1.5 text-sm">
              {data.itemsSnapshots?.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-slate-700">{it.nameSnapshot} x {it.qty}</span>
                  <span className="font-medium text-slate-900 tabular-nums">{formatPEN(it.unitPriceSnapshot * it.qty)}</span>
                </div>
              ))}
            </div>

            {data.totals ? (
              <div className="border-t border-slate-100 pt-3 flex flex-col gap-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{formatPEN(data.totals.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Descuento</span><span className="tabular-nums">{data.totals.discountAmount ? `-${formatPEN(data.totals.discountAmount)}` : formatPEN(0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Envío</span><span className="tabular-nums">{data.totals.shippingCost ? formatPEN(data.totals.shippingCost) : "Gratis"}</span></div>
                <div className="flex justify-between font-semibold text-slate-900"><span>Total</span><span className="tabular-nums">{formatPEN(data.totals.totalToPay)}</span></div>
                {data.couponCode ? (
                  <div className="text-xs font-semibold text-emerald-700 mt-1">Cupón aplicado: {data.couponCode}</div>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Notificar por WhatsApp</p>
              {waHref ? (
                <a href={waHref} target="_blank" rel="noreferrer" className="btn-brand inline-flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm5.2 12.7c-.2.6-1.2 1.1-1.7 1.2-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.3-.3.6-.4.8-.4h.6c.2 0 .5 0 .7.5.2.5.8 1.9.9 2 .1.2.1.4 0 .6-.1.2-.2.4-.3.5-.1.2-.3.4-.4.5-.1.1-.2.3-.1.5.1.2.4.8 1 1.3.7.7 1.3 1 1.5 1.1.2.1.4.1.6-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.6-.2.2.1 1.5.7 1.8.9.3.2.4.2.5.4.1.2.1.9-.1 1.5Z" />
                  </svg>
                  Enviar mensaje por WhatsApp
                </a>
              ) : (
                <p className="text-xs text-slate-500">WhatsApp no disponible por el momento.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Payment form */}
      {data && (data.status === "SCHEDULED" || data.status === "PAYMENT_SENT") ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] p-5 flex flex-col gap-4 fade-in-up">
          <p className="font-semibold text-slate-900">Enviar comprobante</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Código de operación</label>
            <Input value={operationCode} onChange={(e) => setOperationCode(e.target.value)} uiSize="sm" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Medio de pago</label>
            <Select value={method} onChange={(e) => setMethod(e.target.value as any)} uiSize="sm" className="w-48">
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
              <option value="OTHER">Otro</option>
            </Select>
          </div>

          <Button type="button" onClick={submitPayment} disabled={busyPay || !operationCode} size="md">
            {busyPay ? "Enviando..." : "Enviar comprobante"}
          </Button>

          {payMsg ? (
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">{payMsg}</div>
          ) : null}
          <p className="text-xs text-slate-500">Usa el mismo código que aparece en tu comprobante.</p>
        </div>
      ) : null}
    </div>
  );
}

export default function TrackPage() {
  return <TrackPageInner />;
}
