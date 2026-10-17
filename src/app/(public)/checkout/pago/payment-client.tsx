"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/apiClient";
import { checkoutErrorMessage } from "@/lib/checkoutErrors";
import { formatPEN } from "@/lib/money";
import { Input } from "@/components/ui/fields";

type Instructions = { yapeName: string; yapeNumber: string; plinName: string; plinNumber: string };
type ReservedOrder = {
  publicCode: string;
  status: string;
  reservedUntilMs: number;
  totals: { subtotal: number; discountAmount?: number; shippingCost?: number; totalToPay: number };
  payment: { method?: string; receiptImageUrl?: string };
  paymentInstructions?: Instructions;
  publicWhatsapp?: string;
  itemsSnapshots: Array<{ nameSnapshot: string; qty: number; unitPriceSnapshot: number }>;
};

export default function PaymentClient({ publicCode, trackingToken }: {
  publicCode: string; trackingToken: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<ReservedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"YAPE" | "PLIN">("YAPE");
  const [receipt, setReceipt] = useState("");
  const [operationCode, setOperationCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const trackingHref = `/track?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!publicCode || !trackingToken) throw new Error("INVALID_TRACKING_TOKEN");
      const data = await apiPost<ReservedOrder>("/api/track", { publicCode, trackingToken });
      setOrder(data);
      setMethod(data.payment?.method === "PLIN" ? "PLIN" : "YAPE");
      setNow(Date.now());
    } catch (cause) {
      setError(checkoutErrorMessage(cause instanceof Error ? cause.message : "SERVER_ERROR"));
    } finally { setLoading(false); }
  }, [publicCode, trackingToken]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.floor(((order?.reservedUntilMs ?? 0) - now) / 1000));
  const canPay = order?.status === "SCHEDULED" && remaining > 0;
  const instructions = order?.paymentInstructions;
  const accountName = method === "YAPE" ? instructions?.yapeName : instructions?.plinName;
  const accountNumber = method === "YAPE" ? instructions?.yapeNumber : instructions?.plinNumber;
  const whatsapp = String(order?.publicWhatsapp ?? "").replace(/\D/g, "");
  const hasAccount = Boolean(accountName && accountNumber);

  async function upload(file: File) {
    if (!canPay || !hasAccount) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Elige una imagen del comprobante de hasta 10 MB.");
      return;
    }
    const cloud = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
    const preset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
    if (!cloud || !preset) { setError("La carga de comprobantes no está disponible. Contacta a la tienda con tu número de pedido."); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("upload_preset", preset);
      body.append("folder", "receipts");
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok || !result.secure_url) throw new Error("UPLOAD_FAILED");
      setReceipt(String(result.secure_url));
    } catch { setError("No se pudo subir la imagen. Tu reserva sigue disponible hasta la hora indicada; vuelve a intentarlo."); }
    finally { setUploading(false); }
  }

  async function submitReceipt() {
    if (!canPay || !receipt || sending || uploading) return;
    setSending(true);
    setError("");
    try {
      await apiPost("/api/submit-payment", {
        publicCode, trackingToken, method, receiptImageUrl: receipt,
        ...(operationCode.trim() ? { operationCode: operationCode.trim() } : {}),
      });
      try { sessionStorage.removeItem("odera_checkout_request"); } catch { /* optional storage */ }
      router.replace(`/confirm?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`);
    } catch (cause) { setError(checkoutErrorMessage(cause instanceof Error ? cause.message : "SERVER_ERROR")); }
    finally { setSending(false); }
  }

  return (
    <div className="shopping-flow mx-auto max-w-2xl px-5 py-8 sm:py-12 flex flex-col gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--vermeil)]">Reserva {publicCode}</p>
        <h1 className="mt-2 text-3xl font-display font-bold">Pagar mi reserva</h1>
        <p className="mt-2 text-sm text-slate-500">El stock y el importe se confirmaron al crear tu reserva.</p>
      </div>
      {loading ? <p role="status">Consultando reserva…</p> : null}
      {error ? <div role="alert" className="border border-rose-200 bg-rose-50 p-4 text-sm text-destructive">{error}</div> : null}
      {!loading && !order ? <button type="button" className="btn-soft w-fit" onClick={() => void load()}>Volver a consultar</button> : null}
      {order?.totals ? (
        <section className="border border-slate-200 bg-white p-5 grid gap-3" aria-labelledby="reserved-total-title">
          <h2 id="reserved-total-title" className="font-bold text-slate-900">Tu pedido reservado</h2>
          {order.itemsSnapshots.map((item, index) => <div key={index} className="flex justify-between gap-4 text-sm"><span>{item.nameSnapshot} × {item.qty}</span><span className="shrink-0 tabular-nums">{formatPEN(item.unitPriceSnapshot * item.qty)}</span></div>)}
          <div className="border-t border-slate-200 pt-3 grid gap-2 text-sm">
            <div className="flex justify-between"><span>Descuento</span><span>{formatPEN(order.totals.discountAmount ?? 0)}</span></div>
            <div className="flex justify-between"><span>Envío</span><span>{order.totals.shippingCost ? formatPEN(order.totals.shippingCost) : "Gratis"}</span></div>
            <div className="flex justify-between text-xl font-bold"><span>Total a pagar</span><span>{formatPEN(order.totals.totalToPay)}</span></div>
          </div>
        </section>
      ) : null}
      {!loading && order && !canPay ? <div className="border border-slate-200 p-4 text-sm">
        {order.status === "SCHEDULED" || order.status === "CANCELLED_EXPIRED" ? "La reserva venció. No realices el pago. Si ya pagaste, contacta a la tienda con tu número de pedido." : order.status === "PAYMENT_SENT" || order.status === "PENDING_VALIDATION" ? "Ya recibimos tu comprobante. Puedes consultar su validación en Seguimiento." : "Este pedido ya no admite pagos. Consulta su estado en Seguimiento."}
      </div> : null}
      {canPay ? (
        <section className="border border-slate-200 bg-white p-5 grid gap-4" aria-labelledby="reserved-payment-title">
          <h2 id="reserved-payment-title" className="font-bold text-slate-900">Realiza el pago y envía tu comprobante</h2>
          <p role="status" className="text-sm text-[var(--vermeil)]">Tiempo restante: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} · Vence a las {new Date(order!.reservedUntilMs).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" })}</p>
          <fieldset className="flex gap-6" disabled={sending || uploading}>
            <legend className="sr-only">Medio de pago</legend>
            {(["YAPE", "PLIN"] as const).map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name="reserved-method" checked={method === value} onChange={() => setMethod(value)} />{value === "YAPE" ? "Yape" : "Plin"}</label>)}
          </fieldset>
          {hasAccount ? <div className="border border-slate-200 p-4 text-sm grid gap-1"><p>Titular: <strong>{accountName}</strong></p><p>Número: <strong className="text-lg tracking-wide">{accountNumber}</strong></p><p className="mt-2 text-slate-500">Verifica el titular y paga el importe exacto antes de que venza la reserva.</p></div> : <p className="text-sm text-destructive">Los datos de {method === "YAPE" ? "Yape" : "Plin"} no están disponibles. Elige otro medio o contacta a la tienda antes de pagar.</p>}
          <label className="grid gap-2 text-sm font-medium">Imagen del comprobante
            <input aria-label="Imagen del comprobante" type="file" accept="image/*" disabled={!hasAccount || uploading || sending} className="block w-full text-sm file:mr-3 file:border-0 file:bg-[var(--ink-3)] file:p-3 file:text-[var(--paper)]" onChange={event => {const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = "";}} />
          </label>
          {uploading ? <p role="status" className="text-sm">Subiendo imagen…</p> : null}
          {receipt ? <div className="grid gap-2"><p className="text-sm text-emerald-600">Imagen cargada. Envíala para registrar el pago.</p><Image src={receipt} alt="Comprobante cargado" width={640} height={320} unoptimized className="max-h-48 w-full object-contain" /></div> : null}
          <label className="grid gap-2 text-sm">Código de operación (opcional)<Input minLength={4} maxLength={64} value={operationCode} onChange={event => setOperationCode(event.target.value)} /></label>
          <button type="button" className="btn-brand justify-center disabled:opacity-50" disabled={!hasAccount || !receipt || uploading || sending || (operationCode.trim().length > 0 && operationCode.trim().length < 4)} onClick={() => void submitReceipt()}>{sending ? "Registrando comprobante…" : "Enviar comprobante"}</button>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <Link href={trackingHref} className="font-bold underline">Ver seguimiento del pedido</Link>
        {whatsapp ? <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Consulta sobre mi pedido ${publicCode}`)}`} target="_blank" rel="noreferrer" className="font-bold underline">Contactar a la tienda</a> : null}
        <Link href="/catalog" className="text-slate-500 underline">Volver al catálogo</Link>
      </div>
    </div>
  );
}
