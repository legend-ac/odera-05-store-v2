"use client";

import { useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";

type Settings = {
  storeName: string;
  publicContactEmail: string;
  publicWhatsapp: string;
  socialLinks: {
    instagram?: string;
    tiktok?: string;
    facebook?: string;
    whatsapp?: string;
  };
  paymentInstructions: {
    yapeName?: string;
    yapeNumber?: string;
    plinName?: string;
    plinNumber?: string;
  };
};

export default function SettingsClient({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/settings/update", s, { csrfCookieName: CSRF_COOKIE_NAME });
      setMsg("Guardado.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Configuración de tienda</h1>
          <p className="text-sm text-slate-600">Controla datos públicos, redes y medios de pago.</p>
        </div>
        <button type="button" onClick={save} disabled={busy} className="btn-brand disabled:opacity-50">
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {msg ? <div className="panel p-3 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid gap-4">
        <div className="grid gap-1 panel p-3 md:p-4">
          <label className="text-sm font-medium">Nombre tienda</label>
          <input value={s.storeName} onChange={(e) => setS((p) => ({ ...p, storeName: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>

        <div className="grid md:grid-cols-2 gap-3 panel p-3 md:p-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Correo público</label>
            <input value={s.publicContactEmail} onChange={(e) => setS((p) => ({ ...p, publicContactEmail: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">WhatsApp público</label>
            <input value={s.publicWhatsapp} onChange={(e) => setS((p) => ({ ...p, publicWhatsapp: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="border border-neutral-200 rounded-xl p-3 md:p-4">
          <div className="font-medium mb-2">Redes sociales (URLs)</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Instagram</label>
              <input value={s.socialLinks?.instagram ?? ""} onChange={(e) => setS((p) => ({ ...p, socialLinks: { ...p.socialLinks, instagram: e.target.value } }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="https://instagram.com/tuusuario" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">TikTok</label>
              <input value={s.socialLinks?.tiktok ?? ""} onChange={(e) => setS((p) => ({ ...p, socialLinks: { ...p.socialLinks, tiktok: e.target.value } }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="https://www.tiktok.com/@tuusuario" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Facebook</label>
              <input value={s.socialLinks?.facebook ?? ""} onChange={(e) => setS((p) => ({ ...p, socialLinks: { ...p.socialLinks, facebook: e.target.value } }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="https://facebook.com/tu-pagina" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">WhatsApp link</label>
              <input value={s.socialLinks?.whatsapp ?? ""} onChange={(e) => setS((p) => ({ ...p, socialLinks: { ...p.socialLinks, whatsapp: e.target.value } }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="https://wa.me/51999..." />
            </div>
          </div>
        </div>

        <div className="border border-neutral-200 rounded-xl p-3 md:p-4">
          <div className="font-medium mb-2">Instrucciones de pago</div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Yape nombre</label>
              <input value={s.paymentInstructions.yapeName ?? ""} onChange={(e) => setS((p) => ({ ...p, paymentInstructions: { ...p.paymentInstructions, yapeName: e.target.value } }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Yape número</label>
              <input value={s.paymentInstructions.yapeNumber ?? ""} onChange={(e) => setS((p) => ({ ...p, paymentInstructions: { ...p.paymentInstructions, yapeNumber: e.target.value } }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Plin nombre</label>
              <input value={s.paymentInstructions.plinName ?? ""} onChange={(e) => setS((p) => ({ ...p, paymentInstructions: { ...p.paymentInstructions, plinName: e.target.value } }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Plin número</label>
              <input value={s.paymentInstructions.plinNumber ?? ""} onChange={(e) => setS((p) => ({ ...p, paymentInstructions: { ...p.paymentInstructions, plinNumber: e.target.value } }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-3 md:p-4 bg-slate-50">
          <div className="font-medium mb-2">Políticas actuales de compra y envío</div>
          <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
            <li>Cupon vigente: <b>ODERA10</b> (10% de descuento).</li>
            <li>Envio gratis desde <b>S/ 200</b> en productos.</li>
            <li>Si la compra es menor, costo de envio: <b>S/ 10</b>.</li>
            <li>Tipos de envio: Delivery Lima Metropolitana o Agencia a provincia.</li>
          </ul>
          <div className="text-xs text-slate-500 mt-2">
            Esta guia es referencial para el equipo que administra pedidos.
          </div>
        </div>

        <div className="text-xs text-slate-500">
          La configuración se lee públicamente desde Firestore (rules: settings/store read público, write solo admin).
        </div>
      </div>
    </div>
  );
}
