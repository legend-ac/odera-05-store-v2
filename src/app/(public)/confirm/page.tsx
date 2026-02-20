"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { apiPost } from "@/lib/apiClient";
import { db } from "@/lib/firebase/client";

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

function shippingAddressText(shipping: any): string {
  if (!shipping) return "-";
  if (shipping.method === "LIMA_DELIVERY") {
    return `${shipping.district} - ${shipping.addressLine1}${shipping.reference ? ` (Ref: ${shipping.reference})` : ""}`;
  }
  return `${shipping.department}, ${shipping.province} - Agencia ${shipping.agencyName} (${shipping.agencyAddress})${shipping.reference ? ` (Ref: ${shipping.reference})` : ""}`;
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
      setCopyMsg("No se pudo copiar. Copia manual.");
      setTimeout(() => setCopyMsg(null), 1800);
    }
  }

  const businessWhatsapp = useMemo(() => normalizeWhatsappTarget(String(settings?.publicWhatsapp ?? "")), [settings?.publicWhatsapp]);

  const trackingUrl = useMemo(() => {
    if (!publicCode || !trackingToken) return "";
    if (typeof window === "undefined") return `/track?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`;
    return `${window.location.origin}/track?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`;
  }, [publicCode, trackingToken]);

  const waText = useMemo(() => {
    if (!data) return "";
    const name = data.customer?.name ?? data.shipping?.receiverName ?? "-";
    const phone = data.customer?.phone ?? data.shipping?.receiverPhone ?? "-";
    const address = shippingAddressText(data.shipping);
    const method = data.payment?.method ?? "-";
    const items = (data.itemsSnapshots ?? [])
      .map((it) => `- ${it.nameSnapshot} x${it.qty} (S/ ${(Number(it.unitPriceSnapshot) * Number(it.qty)).toFixed(2)})`)
      .join("\n");
    const total = data.totals?.totalToPay ?? 0;
    return [
      `Pedido: ${data.publicCode}`,
      `Enlace de seguimiento: ${trackingUrl || "-"}`,
      `Clave de seguimiento: ${trackingToken || "-"}`,
      `Nombre: ${name}`,
      `Telefono: ${phone}`,
      `Direccion: ${address}`,
      `Metodo de pago: ${method}`,
      "",
      "Productos:",
      items || "-",
      "",
      `Total: S/ ${Number(total).toFixed(2)}`,
      "",
      "Adjunto mi comprobante",
    ].join("\n");
  }, [data, trackingToken, trackingUrl]);

  const waHref = useMemo(() => {
    if (!businessWhatsapp || !waText) return "";
    return `${businessWhatsapp}?text=${encodeURIComponent(waText)}`;
  }, [businessWhatsapp, waText]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Pedido confirmado</h1>
      <div className="panel p-4">
        <div className="text-sm text-slate-600">Numero de pedido</div>
        <div className="text-xl font-semibold break-all">{publicCode || "-"}</div>
        <button type="button" onClick={() => copyText(publicCode, "Numero de pedido")} className="mt-2 px-3 py-2 text-sm rounded-md border border-slate-300">
          Copiar numero
        </button>

        <div className="mt-4 text-sm text-slate-600">Clave de seguimiento</div>
        <div className="font-mono text-sm break-all">{trackingToken || "-"}</div>
        <button type="button" onClick={() => copyText(trackingToken, "Clave de seguimiento")} className="mt-2 px-3 py-2 text-sm rounded-md border border-slate-300">
          Copiar clave
        </button>
        {trackingUrl ? (
          <a href={trackingUrl} className="mt-2 ml-2 inline-flex px-3 py-2 text-sm rounded-md border border-slate-300">
            Abrir mi seguimiento
          </a>
        ) : null}

        {copyMsg ? <div className="mt-2 text-xs text-emerald-700">{copyMsg}</div> : null}
      </div>

      <div className="panel p-4">
        <div className="font-medium mb-2">Siguiente paso</div>
        <p className="text-sm text-slate-700">
          Tu pedido quedo en estado <b>Pendiente de validacion de pago</b>. El boton de WhatsApp incluye todos los datos de seguimiento para no perder informacion.
        </p>
        {waHref ? (
          <a href={waHref} target="_blank" rel="noreferrer" className="btn-brand mt-3 inline-flex">
            Enviar mensaje por WhatsApp
          </a>
        ) : (
          <div className="mt-3 text-sm text-slate-600">Configura el WhatsApp del negocio en Admin &gt; Configuracion.</div>
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
