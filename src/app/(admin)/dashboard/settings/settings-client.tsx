"use client";

import { useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Settings = {
  storeName: string;
  homePromoEnabled?: boolean;
  homePromo?: {
    title?: string;
    message?: string;
    rightNote?: string;
    couponCode?: string;
    discountPercent?: number;
    freeShippingFrom?: number;
  };
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
  productTypes?: {
    key: string;
    label: string;
    subtitle?: string;
    cta?: string;
    enabled?: boolean;
    imageUrl?: string;
  }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function toWebp(file: File, maxSize = 1280, quality = 0.88): Promise<Blob> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load failed")); });
  const { naturalWidth: w0, naturalHeight: h0 } = img;
  // Cuadrado centrado: recortar al lado mínimo
  const side = Math.min(w0, h0, maxSize);
  const scale = side / Math.min(w0, h0);
  const dw = Math.round(w0 * scale);
  const dh = Math.round(h0 * scale);
  const ox = Math.round((dw - side) / 2);
  const oy = Math.round((dh - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = side; canvas.height = side;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, -ox, -oy, dw, dh);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error("toBlob")), "image/webp", quality));
  URL.revokeObjectURL(url);
  return blob;
}

async function uploadCategoryImage(file: File, key: string): Promise<string> {
  const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
  const uploadPreset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary no configurado");
  const blob = await toWebp(file);
  const form = new FormData();
  form.append("file", blob, `category-${key}-${Date.now()}.webp`);
  form.append("upload_preset", uploadPreset);
  form.append("folder", `categories`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const json = await res.json() as any;
  if (!res.ok) throw new Error(`CLOUDINARY: ${json?.error?.message ?? res.status}`);
  return String(json.secure_url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  const isError = msg.toLowerCase().startsWith("error") || msg.toLowerCase().includes("corrige");
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[var(--shadow-elevated)] fade-in ${isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      <span className="mt-0.5 shrink-0">
        {isError
          ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      </span>
      <span className="flex-1">{msg}</span>
      <button type="button" onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

function SectionCard({ icon, title, subtitle, badge, children }: { icon: React.ReactNode; title: string; subtitle?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-600)]">
            {icon}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{title}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ ok, labelOn, labelOff }: { ok: boolean; labelOn: string; labelOff: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      {ok ? labelOn : labelOff}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsClient({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const enabledSocials = [s.socialLinks?.instagram, s.socialLinks?.tiktok, s.socialLinks?.facebook, s.socialLinks?.whatsapp].filter(Boolean).length;
  const paymentConfigured = Boolean((s.paymentInstructions?.yapeNumber ?? "").trim() || (s.paymentInstructions?.plinNumber ?? "").trim());
  const promoEnabled = Boolean(s.homePromoEnabled);
  const couponCode = String(s.homePromo?.couponCode ?? "").trim();
  const freeShippingFrom = Number(s.homePromo?.freeShippingFrom ?? 0);
  const discountPercent = Number(s.homePromo?.discountPercent ?? 0);
  const productTypes = Array.isArray(s.productTypes) ? s.productTypes : [];
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  function validateInput(data: Settings): string[] {
    const errs: string[] = [];
    if (!(data.storeName ?? "").trim()) errs.push("El nombre de tienda es obligatorio.");
    if (!(data.publicContactEmail ?? "").includes("@")) errs.push("Correo público inválido.");
    if (promoEnabled && couponCode && couponCode.length < 4) errs.push("El código de cupón debe tener al menos 4 caracteres.");
    if (promoEnabled && (discountPercent < 0 || discountPercent > 100)) errs.push("El porcentaje de descuento debe estar entre 0 y 100.");
    if (promoEnabled && freeShippingFrom < 0) errs.push("Envío gratis desde no puede ser negativo.");
    if (!Array.isArray(data.productTypes) || data.productTypes.length === 0) errs.push("Debes tener al menos un tipo de producto activo.");
    const keys = new Set<string>();
    for (const t of data.productTypes ?? []) {
      if (!t.key.trim() || !t.label.trim()) errs.push("Cada tipo de producto necesita clave y nombre.");
      if (keys.has(t.key)) errs.push(`Clave repetida en tipos: ${t.key}`);
      keys.add(t.key);
    }
    return errs;
  }

  async function save() {
    const errs = validateInput(s);
    setIssues(errs);
    if (errs.length) { setMsg("Corrige los campos marcados antes de guardar."); return; }
    setBusy(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/settings/update", s, { csrfCookieName: CSRF_COOKIE_NAME });
      setMsg("Configuración guardada correctamente.");
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error desconocido"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900">Configuración de tienda</h1>
          <p className="text-sm text-slate-500 mt-0.5">Controla datos públicos, redes sociales y medios de pago.</p>
        </div>
        <Button type="button" onClick={save} disabled={busy} variant="primary" size="md">
          {busy ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>

      {/* Estado visual de la configuración */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)] flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Identidad</p>
          <StatusBadge ok={!!s.storeName?.trim()} labelOn="Nombre configurado" labelOff="Sin nombre" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)] flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Promo Home</p>
          <StatusBadge ok={promoEnabled} labelOn="Activa" labelOff="Oculta" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)] flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Redes ({enabledSocials}/4)</p>
          <StatusBadge ok={enabledSocials >= 2} labelOn="Configuradas" labelOff="Sin configurar" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)] flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pagos</p>
          <StatusBadge ok={paymentConfigured} labelOn="Listos" labelOff="Pendiente" />
        </div>
      </div>

      {/* Toast de notificación */}
      {msg && <Toast msg={msg} onClose={() => setMsg(null)} />}

      {/* Errores de validación */}
      {issues.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-bold text-rose-700 mb-2">Corrige los siguientes campos:</p>
          <ul className="list-disc pl-5 space-y-1">
            {issues.map((it) => <li key={it} className="text-sm text-rose-600">{it}</li>)}
          </ul>
        </div>
      )}

      {/* Sección: Identidad base */}
      <SectionCard
        title="Identidad de la tienda"
        subtitle="Nombre visible y configuración del bloque promocional"
        badge={<StatusBadge ok={!!s.storeName?.trim()} labelOn="Configurado" labelOff="Incompleto" />}
        icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Nombre de la tienda
            <Input value={s.storeName} onChange={(e) => setS((p) => ({ ...p, storeName: e.target.value }))} placeholder="ODERA 05 STORE" />
          </label>
          <label className="inline-flex items-center gap-3 cursor-pointer rounded-xl border border-slate-200 bg-[var(--surface-muted)] px-4 py-3">
            <div className={`relative h-5 w-10 rounded-full transition-colors duration-200 ${s.homePromoEnabled ? "bg-[var(--brand-500)]" : "bg-slate-200"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${s.homePromoEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
              <input type="checkbox" checked={Boolean(s.homePromoEnabled)} onChange={(e) => setS((p) => ({ ...p, homePromoEnabled: e.target.checked }))} className="sr-only" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Mostrar bloque de promoción en el inicio</p>
              <p className="text-xs text-slate-400">Activa el banner de cupón y envío gratis en la página principal</p>
            </div>
          </label>
        </div>
      </SectionCard>

      {/* Sección: Promo */}
      <SectionCard
        title="Bloque promocional del inicio"
        subtitle="Configura el cupón, descuento y mensaje del banner"
        badge={<StatusBadge ok={promoEnabled} labelOn="Activo" labelOff="Oculto" />}
        icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" /></svg>}
      >
        <div className="grid gap-3">
          <div className="grid md:grid-cols-3 gap-3">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Título del banner
              <Input value={s.homePromo?.title ?? ""} onChange={(e) => setS((p) => ({ ...p, homePromo: { ...p.homePromo, title: e.target.value } }))} placeholder="¡Ofertas de temporada!" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Código de cupón
              <Input value={s.homePromo?.couponCode ?? ""} onChange={(e) => setS((p) => ({ ...p, homePromo: { ...p.homePromo, couponCode: e.target.value } }))} placeholder="ODERA10" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Descuento (%)
              <Input type="number" min={0} max={100} value={Number(s.homePromo?.discountPercent ?? 0)} onChange={(e) => { const n = Number(e.target.value); setS((p) => ({ ...p, homePromo: { ...p.homePromo, discountPercent: Number.isFinite(n) ? n : 0 } })); }} placeholder="10" />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Mensaje del banner
            <Input value={s.homePromo?.message ?? ""} onChange={(e) => setS((p) => ({ ...p, homePromo: { ...p.homePromo, message: e.target.value } }))} placeholder="Compra hoy y ahorra con tu primer pedido" />
          </label>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Texto lateral derecho
              <Input value={s.homePromo?.rightNote ?? ""} onChange={(e) => setS((p) => ({ ...p, homePromo: { ...p.homePromo, rightNote: e.target.value } }))} placeholder="Envío gratis a Lima" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Envío gratis desde (S/)
              <Input type="number" min={0} value={Number(s.homePromo?.freeShippingFrom ?? 0)} onChange={(e) => { const n = Number(e.target.value); setS((p) => ({ ...p, homePromo: { ...p.homePromo, freeShippingFrom: Number.isFinite(n) ? n : 0 } })); }} placeholder="150" />
            </label>
          </div>
          {/* Mini preview */}
          {promoEnabled && (
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 text-xs">
              <p className="font-bold text-blue-700 mb-1">Vista previa del banner:</p>
              <p className="text-blue-600">{s.homePromo?.title || "(sin título)"}</p>
              {couponCode && <p className="text-blue-500">Cupón: <span className="font-mono font-bold">{couponCode}</span> · {discountPercent}% OFF</p>}
              {freeShippingFrom > 0 && <p className="text-blue-500">Envío gratis desde S/{freeShippingFrom}</p>}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Sección: Contacto */}
      <SectionCard
        title="Canales de contacto"
        subtitle="Correo y WhatsApp públicos visibles para los clientes"
        badge={<StatusBadge ok={!!s.publicContactEmail?.includes("@") && !!s.publicWhatsapp?.trim()} labelOn="Listos" labelOff="Incompletos" />}
        icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
      >
        <div className="grid md:grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Correo público
            <Input type="email" value={s.publicContactEmail} onChange={(e) => setS((p) => ({ ...p, publicContactEmail: e.target.value }))} placeholder="contacto@mititienda.com" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            WhatsApp público (número)
            <Input value={s.publicWhatsapp} onChange={(e) => setS((p) => ({ ...p, publicWhatsapp: e.target.value }))} placeholder="+51 999 999 999" />
          </label>
        </div>
      </SectionCard>

      {/* Sección: Redes sociales */}
      <SectionCard
        title="Redes sociales"
        subtitle="URLs completas de tus perfiles —se muestran en el footer"
        badge={<StatusBadge ok={enabledSocials >= 2} labelOn={`${enabledSocials}/4 configuradas`} labelOff={`${enabledSocials}/4 configuradas`} />}
        icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>}
      >
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { key: "instagram" as const, label: "Instagram", placeholder: "https://instagram.com/tuusuario", color: "text-pink-500" },
            { key: "tiktok" as const, label: "TikTok", placeholder: "https://www.tiktok.com/@tuusuario", color: "text-slate-800" },
            { key: "facebook" as const, label: "Facebook", placeholder: "https://facebook.com/tu-pagina", color: "text-blue-600" },
            { key: "whatsapp" as const, label: "WhatsApp link", placeholder: "https://wa.me/51999999999", color: "text-emerald-600" },
          ].map(({ key, label, placeholder, color }) => (
            <label key={key} className="grid gap-1 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className={color}>●</span> {label}
                {s.socialLinks?.[key] ? <span className="text-emerald-500 text-[10px] font-bold">✓</span> : null}
              </span>
              <Input value={s.socialLinks?.[key] ?? ""} onChange={(e) => setS((p) => ({ ...p, socialLinks: { ...p.socialLinks, [key]: e.target.value } }))} placeholder={placeholder} />
            </label>
          ))}
        </div>
      </SectionCard>

      {/* Sección: Pagos */}
      <SectionCard
        title="Instrucciones de pago"
        subtitle="Datos de Yape y Plin que verán los clientes al hacer checkout"
        badge={<StatusBadge ok={paymentConfigured} labelOn="Listo" labelOff="Sin configurar" />}
        icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-[var(--surface-muted)] p-3 grid gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Yape</p>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Nombre en Yape
              <Input value={s.paymentInstructions.yapeName ?? ""} onChange={(e) => setS((p) => ({ ...p, paymentInstructions: { ...p.paymentInstructions, yapeName: e.target.value } }))} placeholder="Juan Pérez" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Número de Yape
              <Input value={s.paymentInstructions.yapeNumber ?? ""} onChange={(e) => setS((p) => ({ ...p, paymentInstructions: { ...p.paymentInstructions, yapeNumber: e.target.value } }))} placeholder="9XX XXX XXX" />
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-[var(--surface-muted)] p-3 grid gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Plin</p>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Nombre en Plin
              <Input value={s.paymentInstructions.plinName ?? ""} onChange={(e) => setS((p) => ({ ...p, paymentInstructions: { ...p.paymentInstructions, plinName: e.target.value } }))} placeholder="Juan Pérez" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Número de Plin
              <Input value={s.paymentInstructions.plinNumber ?? ""} onChange={(e) => setS((p) => ({ ...p, paymentInstructions: { ...p.paymentInstructions, plinNumber: e.target.value } }))} placeholder="9XX XXX XXX" />
            </label>
          </div>
        </div>
        {paymentConfigured && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
            <p className="font-bold mb-1">Así verá el cliente en el checkout:</p>
            {s.paymentInstructions.yapeNumber && <p>Yape a <span className="font-semibold">{s.paymentInstructions.yapeName}</span> · {s.paymentInstructions.yapeNumber}</p>}
            {s.paymentInstructions.plinNumber && <p>Plin a <span className="font-semibold">{s.paymentInstructions.plinName}</span> · {s.paymentInstructions.plinNumber}</p>}
          </div>
        )}
      </SectionCard>

      {/* Sección: Tipos de producto */}
      <SectionCard
        title="Tipos de producto"
        subtitle="Categorías que aparecen en el home y el panel admin"
        badge={<span className="text-xs font-bold text-slate-500">{productTypes.length} tipos</span>}
        icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
      >
        <div className="grid gap-3 mb-4">
          {productTypes.map((t, idx) => (
            <div key={`${t.key}-${idx}`} className="rounded-xl border border-slate-200 bg-[var(--surface-muted)] p-3 flex flex-col gap-3">
              {/* Fila principal: campos */}
              <div className="grid md:grid-cols-[180px_1fr_1fr_150px_auto_auto] gap-2 items-center">
                <Input
                  value={t.key}
                  onChange={(e) => setS((p) => { const copy = [...(p.productTypes ?? [])]; if (!copy[idx]) return p; copy[idx] = { ...copy[idx], key: e.target.value.trim().toLowerCase().replace(/\s+/g, "-") }; return { ...p, productTypes: copy }; })}
                  placeholder="clave (kebab-case)"
                  uiSize="sm"
                />
                <Input
                  value={t.label}
                  onChange={(e) => setS((p) => { const copy = [...(p.productTypes ?? [])]; if (!copy[idx]) return p; copy[idx] = { ...copy[idx], label: e.target.value }; return { ...p, productTypes: copy }; })}
                  placeholder="Nombre visible"
                  uiSize="sm"
                />
                <Input
                  value={t.subtitle ?? ""}
                  onChange={(e) => setS((p) => { const copy = [...(p.productTypes ?? [])]; if (!copy[idx]) return p; copy[idx] = { ...copy[idx], subtitle: e.target.value }; return { ...p, productTypes: copy }; })}
                  placeholder="Subtítulo (opcional)"
                  uiSize="sm"
                />
                <Input
                  value={t.cta ?? ""}
                  onChange={(e) => setS((p) => { const copy = [...(p.productTypes ?? [])]; if (!copy[idx]) return p; copy[idx] = { ...copy[idx], cta: e.target.value }; return { ...p, productTypes: copy }; })}
                  placeholder="Texto botón"
                  uiSize="sm"
                />
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
                  <div className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${Boolean(t.enabled ?? true) ? "bg-[var(--brand-500)]" : "bg-slate-200"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${Boolean(t.enabled ?? true) ? "translate-x-4" : "translate-x-0.5"}`} />
                    <input type="checkbox" checked={Boolean(t.enabled ?? true)} onChange={(e) => setS((p) => { const copy = [...(p.productTypes ?? [])]; if (!copy[idx]) return p; copy[idx] = { ...copy[idx], enabled: e.target.checked }; return { ...p, productTypes: copy }; })} className="sr-only" />
                  </div>
                  {Boolean(t.enabled ?? true) ? "Activo" : "Oculto"}
                </label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setS((p) => ({ ...p, productTypes: (p.productTypes ?? []).filter((_, i) => i !== idx) }))}>
                  Quitar
                </Button>
              </div>

              {/* Fila imagen de categoría */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60">
                {/* Preview */}
                {t.imageUrl ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.imageUrl} alt={t.label} className="h-full w-full object-cover" />
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white font-bold">1:1</span>
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-300">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}

                <div className="flex flex-col gap-1.5 min-w-0">
                  <p className="text-[11px] font-bold text-slate-700">Imagen de categoría (home)</p>
                  <p className="text-[10px] text-slate-400">Recomendado: <span className="font-semibold text-slate-500">1280 × 1280 px</span> · formato cuadrado · JPG/PNG/WebP</p>
                  <div className="flex items-center gap-2">
                    <label className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all ${uploadingIdx === idx
                        ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)] hover:bg-[var(--brand-100)]"
                      }`}>
                      {uploadingIdx === idx ? (
                        <><svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Subiendo…</>
                      ) : (
                        <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          {t.imageUrl ? "Cambiar imagen" : "📷 Subir imagen"}</>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingIdx !== null}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          e.target.value = "";
                          setUploadingIdx(idx);
                          try {
                            const url = await uploadCategoryImage(file, t.key || `tipo-${idx}`);
                            setS((p) => {
                              const copy = [...(p.productTypes ?? [])];
                              if (!copy[idx]) return p;
                              copy[idx] = { ...copy[idx], imageUrl: url };
                              return { ...p, productTypes: copy };
                            });
                          } catch (err) {
                            setMsg(`Error al subir imagen: ${err instanceof Error ? err.message : "Error desconocido"}`);
                          } finally {
                            setUploadingIdx(null);
                          }
                        }}
                      />
                    </label>
                    {t.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setS((p) => { const copy = [...(p.productTypes ?? [])]; if (!copy[idx]) return p; copy[idx] = { ...copy[idx], imageUrl: undefined }; return { ...p, productTypes: copy }; })}
                        className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold transition-colors"
                      >
                        Quitar imagen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setS((p) => ({ ...p, productTypes: [...(p.productTypes ?? []), { key: `tipo-${(p.productTypes ?? []).length + 1}`, label: "Nuevo tipo", subtitle: "", cta: "Ver", enabled: true }] }))}
        >
          + Agregar tipo de producto
        </Button>
      </SectionCard>

      {/* Resumen comercial */}
      <div className="rounded-2xl border border-slate-200 bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Resumen de la configuración actual</p>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${promoEnabled ? "bg-emerald-500" : "bg-slate-300"}`} />
            Bloque promocional: <b>{promoEnabled ? "Activo" : "Oculto"}</b>
          </li>
          {promoEnabled && couponCode && <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Cupón: <b>{couponCode}</b> ({discountPercent}% off)</li>}
          {promoEnabled && freeShippingFrom > 0 && <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Envío gratis desde S/{freeShippingFrom}</li>}
          <li className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${paymentConfigured ? "bg-emerald-500" : "bg-amber-400"}`} />Pagos (Yape/Plin): <b>{paymentConfigured ? "Configurados" : "Pendiente"}</b></li>
          <li className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${enabledSocials >= 2 ? "bg-emerald-500" : "bg-amber-400"}`} />Redes sociales: <b>{enabledSocials}/4</b></li>
        </ul>
        <p className="text-[11px] text-slate-400 mt-3">La configuración se lee públicamente desde Firestore (rules: settings/store read público, write solo admin).</p>
      </div>
    </div>
  );
}
