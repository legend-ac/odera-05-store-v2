"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { apiPost } from "@/lib/apiClient";
import { db } from "@/lib/firebase/client";
import { buildWhatsAppMessage } from "@/lib/whatsappMessage";
import { Button } from "@/components/ui/button";

type TrackResponse = {
  publicCode: string;
  status: string;
  customer?: { name?: string; phone?: string; email?: string };
  itemsSnapshots: { nameSnapshot: string; qty: number; unitPriceSnapshot: number }[];
  totals: { totalToPay: number } | null;
  payment: { method?: string; receiptImageUrl?: string };
  shipping?: any;
};

function onlyDigits(v: string): string {
  return v.replace(/\D+/g, "");
}

function normalizeWhatsappTarget(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const digits = onlyDigits(value);
  return digits ? `https://wa.me/${digits}` : "";
}

function shippingSummary(shipping: any): string {
  if (!shipping) return "Sin datos de envio";
  if (shipping.method === "LIMA_DELIVERY") {
    return `Delivery Lima - ${shipping.district ?? "-"} - ${shipping.addressLine1 ?? "-"}`;
  }
  return `Agencia provincia - ${shipping.department ?? "-"} / ${shipping.province ?? "-"} - ${shipping.agencyName ?? "-"}`;
}

function ConfirmPageInner() {
  const sp = useSearchParams();
  const publicCode = sp.get("publicCode") ?? "";
  const trackingToken = sp.get("trackingToken") ?? "";

  const [settings, setSettings] = useState<any | null>(null);
  const [data, setData] = useState<TrackResponse | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "store"));
        if (snap.exists() && mounted) setSettings(snap.data());

        if (publicCode && trackingToken) {
          const t = await apiPost<TrackResponse>("/api/track", { publicCode, trackingToken });
          if (mounted) setData(t);
        }
      } catch (e) {
        console.warn(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [publicCode, trackingToken]);

  useEffect(() => {
    if (!publicCode || !trackingToken) return;
    const key = "odera_recent_tracking";
    try {
      const current = localStorage.getItem(key);
      const list = current ? (JSON.parse(current) as Array<{ publicCode: string; trackingToken: string; ts: number }>) : [];
      const filtered = list.filter((x) => !(x.publicCode === publicCode && x.trackingToken === trackingToken));
      filtered.unshift({ publicCode, trackingToken, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(filtered.slice(0, 10)));
    } catch {
      // ignore local storage errors
    }
  }, [publicCode, trackingToken]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMsg(`${label} copiado.`);
      setTimeout(() => setCopyMsg(null), 1800);
    } catch {
      setCopyMsg("No se pudo copiar. Intenta de nuevo.");
      setTimeout(() => setCopyMsg(null), 1800);
    }
  }

  const businessWhatsapp = useMemo(() => normalizeWhatsappTarget(String(settings?.publicWhatsapp ?? "")), [settings?.publicWhatsapp]);

  const trackingUrl = useMemo(() => {
    if (!publicCode || !trackingToken) return "";
    if (typeof window === "undefined") return `/track?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`;
    return `${window.location.origin}/track?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`;
  }, [publicCode, trackingToken]);

  const trackingShortUrl = useMemo(() => {
    if (!publicCode || !trackingToken) return "";
    if (typeof window === "undefined") return `/t/${encodeURIComponent(publicCode)}/${encodeURIComponent(trackingToken)}`;
    return `${window.location.origin}/t/${encodeURIComponent(publicCode)}/${encodeURIComponent(trackingToken)}`;
  }, [publicCode, trackingToken]);

  const waText = useMemo(() => {
    if (!data) return "";
    const name = data.customer?.name ?? "-";
    const phone = data.customer?.phone ?? "-";
    const method = data.payment?.method ?? "-";
    const total = Number(data.totals?.totalToPay ?? 0);
    const storeName = String(settings?.storeName ?? "ODERA 05 STORE");

    return buildWhatsAppMessage({
      storeName,
      publicCode: data.publicCode,
      customerName: name,
      customerPhone: phone,
      paymentMethod: method,
      total,
      trackingShortUrl: trackingShortUrl || trackingUrl || "-",
      trackingToken,
      shippingSummary: shippingSummary(data.shipping),
      items: (data.itemsSnapshots ?? []).map((it) => ({
        name: it.nameSnapshot,
        qty: Number(it.qty ?? 0),
        lineTotal: Number(it.unitPriceSnapshot ?? 0) * Number(it.qty ?? 0),
      })),
    });
  }, [data, settings?.storeName, trackingShortUrl, trackingToken, trackingUrl]);

  const waHref = useMemo(() => {
    if (!businessWhatsapp || !waText) return "";
    return `${businessWhatsapp}?text=${encodeURIComponent(waText)}`;
  }, [businessWhatsapp, waText]);

  const trackingPack = useMemo(() => {
    return [
      `Numero de pedido: ${publicCode || "-"}`,
      `Codigo de seguimiento: ${trackingToken || "-"}`,
      `Link de seguimiento: ${trackingShortUrl || trackingUrl || "-"}`,
    ].join("\n");
  }, [publicCode, trackingToken, trackingShortUrl, trackingUrl]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Pedido confirmado</h1>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-1">Guarda estos datos para revisar el estado de tu pedido cuando quieras.</p>
      </div>

      {/* Tracking Data */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] overflow-hidden">
        <div className="bg-gradient-to-r from-[var(--brand-50)] to-white px-5 py-4 border-b border-slate-100">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-600)]">Datos de seguimiento</p>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Número de pedido</p>
            <p className="text-2xl font-black text-slate-900 font-mono break-all">{publicCode || "-"}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => copyText(publicCode, "Número de pedido")} className="mt-2">
              Copiar número
            </Button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Código de seguimiento</p>
            <div className="font-mono text-sm break-all bg-[var(--surface-muted)] border border-slate-200 rounded-xl px-3 py-2.5">{trackingToken || "-"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => copyText(trackingToken, "Código de seguimiento")}>
                Copiar código
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => copyText(trackingPack, "Paquete completo")}>
                Copiar todo
              </Button>
              {trackingUrl ? (
                <Link href={trackingUrl}>
                  <Button type="button" variant="secondary" size="sm">
                    Abrir seguimiento
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          {copyMsg ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              {copyMsg}
            </div>
          ) : null}
        </div>
      </div>

      {/* Next Steps */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center h-8 w-8 rounded-lg bg-amber-50 text-amber-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-semibold text-slate-900">Siguiente paso</p>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Tu pedido quedó en estado <span className="font-semibold text-slate-900">Pendiente de validación de pago</span>. El botón de WhatsApp incluye toda la información importante para que no pierdas nada.
        </p>
        {waHref ? (
          <a href={waHref} target="_blank" rel="noreferrer" className="btn-brand inline-flex items-center gap-2 self-start">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm5.2 12.7c-.2.6-1.2 1.1-1.7 1.2-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.3-.3.6-.4.8-.4h.6c.2 0 .5 0 .7.5.2.5.8 1.9.9 2 .1.2.1.4 0 .6-.1.2-.2.4-.3.5-.1.2-.3.4-.4.5-.1.1-.2.3-.1.5.1.2.4.8 1 1.3.7.7 1.3 1 1.5 1.1.2.1.4.1.6-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.6-.2.2.1 1.5.7 1.8.9.3.2.4.2.5.4.1.2.1.9-.1 1.5Z" />
            </svg>
            Enviar mensaje por WhatsApp
          </a>
        ) : (
          <p className="text-sm text-slate-500">WhatsApp del negocio no disponible por el momento.</p>
        )}
      </div>

      {/* Continue shopping */}
      <div className="flex justify-center">
        <Link href="/catalog" className="text-sm font-semibold text-[var(--brand-600)] hover:text-[var(--brand-700)] hover:underline transition-colors">
          ← Volver al catálogo
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-[var(--shadow-card)]">
            Preparando confirmación del pedido...
          </div>
        </div>
      }
    >
      <ConfirmPageInner />
    </Suspense>
  );
}
