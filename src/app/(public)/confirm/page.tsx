"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { apiPost } from "@/lib/apiClient";
import { db } from "@/lib/firebase/client";
import { buildWhatsAppMessage } from "@/lib/whatsappMessage";

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
  if (!shipping) return "Sin datos de envío";
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
      `Número de pedido: ${publicCode || "-"}`,
      `Código de seguimiento: ${trackingToken || "-"}`,
      `Link de seguimiento: ${trackingShortUrl || trackingUrl || "-"}`,
    ].join("\n");
  }, [publicCode, trackingToken, trackingShortUrl, trackingUrl]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Pedido confirmado</h1>
        <p className="text-sm text-slate-600 mt-1">Guarda estos datos para revisar el estado de tu pedido cuando quieras.</p>
      </div>

      <div className="panel p-5 rounded-2xl border-slate-200 bg-brand-mesh">
        <div className="text-sm text-slate-600">Número de pedido</div>
        <div className="text-2xl font-bold text-slate-900 break-all">{publicCode || "-"}</div>
        <button type="button" onClick={() => copyText(publicCode, "Número de pedido")} className="mt-2 px-3 py-2 text-sm rounded-xl border border-slate-300 hover:bg-slate-50">
          Copiar número
        </button>

        <div className="mt-4 text-sm text-slate-600">Código de seguimiento</div>
        <div className="font-mono text-sm break-all bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1">{trackingToken || "-"}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => copyText(trackingToken, "Código de seguimiento")} className="px-3 py-2 text-sm rounded-xl border border-slate-300 hover:bg-slate-50">
            Copiar código
          </button>
          <button type="button" onClick={() => copyText(trackingPack, "Paquete completo de seguimiento")} className="px-3 py-2 text-sm rounded-xl border border-slate-300 hover:bg-slate-50">
            Copiar todo
          </button>
          {trackingUrl ? (
            <a href={trackingUrl} className="inline-flex px-3 py-2 text-sm rounded-xl border border-slate-300 hover:bg-slate-50">
              Abrir seguimiento
            </a>
          ) : null}
        </div>

        {copyMsg ? <div className="mt-2 text-xs text-emerald-700">{copyMsg}</div> : null}
      </div>

      <div className="panel p-5 rounded-2xl border-slate-200">
        <div className="font-semibold text-slate-900 mb-2">Siguiente paso</div>
        <p className="text-sm text-slate-700">
          Tu pedido quedó en estado <b>Pendiente de validación de pago</b>. El botón de WhatsApp incluye todo lo importante para que no pierdas la información.
        </p>
        {waHref ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={waHref} target="_blank" rel="noreferrer" className="btn-brand inline-flex">
              Enviar mensaje por WhatsApp
            </a>
            <button type="button" onClick={() => copyText(waText, "Mensaje de WhatsApp")} className="btn-soft">
              Copiar mensaje
            </button>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-600">WhatsApp del negocio no disponible por el momento.</div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-8 text-sm text-neutral-600">Cargando...</div>}>
      <ConfirmPageInner />
    </Suspense>
  );
}
