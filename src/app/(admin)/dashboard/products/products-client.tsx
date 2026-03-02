"use client";

import { useMemo, useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { Input, Select } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  productType: string;
  audience: "hombre" | "mujer" | "ninos" | "todos";
  slug: string;
  status: "active" | "archived";
  name: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  onSale: boolean;
  salePrice: number | null;
  images: { url: string; alt?: string; isMain: boolean; order: number }[];
  variants: { id: string; size?: string; color?: string; sku?: string; stock: number }[];
  deletedAtMs?: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: Array<{ key: Product["audience"]; label: string }> = [
  { key: "hombre", label: "Hombre" },
  { key: "mujer", label: "Mujer" },
  { key: "ninos", label: "Niños" },
  { key: "todos", label: "Todos" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function needsAudienceByType(productType: string): boolean {
  const t = String(productType ?? "").toLowerCase();
  return t.includes("zapat") || t.includes("ropa");
}

function audienceDefaultForType(productType: string): Product["audience"] {
  return needsAudienceByType(productType) ? "hombre" : "todos";
}

function emptyProduct(defaultType: string): Product {
  return {
    id: "",
    productType: defaultType,
    audience: audienceDefaultForType(defaultType),
    slug: "",
    status: "active",
    name: "",
    description: "",
    brand: "",
    category: "",
    price: 0,
    onSale: false,
    salePrice: null,
    images: [],
    variants: [{ id: "default", stock: 0 }],
  };
}

async function fileToWebp(file: File, maxSize = 1000, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
  });
  const { naturalWidth: w0, naturalHeight: h0 } = img;
  const scale = Math.min(1, maxSize / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/webp", quality);
  });
  URL.revokeObjectURL(url);
  return { blob, width: w, height: h };
}

function safeSlug(input: string): string {
  const s = input.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s || "product";
}

function validateDraft(draft: Product): string[] {
  const errors: string[] = [];
  const slug = draft.slug.trim();
  if (slug.length < 2) errors.push("El slug es obligatorio (mínimo 2 caracteres).");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("El slug debe estar en formato kebab-case (ejemplo: nike-air-max).");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((draft.productType ?? "").trim())) errors.push("El tipo de producto debe estar en kebab-case.");
  if (needsAudienceByType(draft.productType) && !draft.audience) errors.push("Debes elegir público objetivo para ropa/zapatillas.");
  if ((draft.name ?? "").trim().length < 2) errors.push("El nombre es obligatorio.");
  if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) errors.push("El precio debe ser un número válido.");
  if (!Array.isArray(draft.variants) || draft.variants.length === 0) errors.push("Agrega al menos una variante.");
  return errors;
}

async function uploadToCloudinary(blob: Blob, slug: string, filename: string): Promise<string> {
  const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
  const uploadPreset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
  if (!cloudName || !uploadPreset) throw new Error("CLOUDINARY_NOT_CONFIGURED");
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("upload_preset", uploadPreset);
  form.append("folder", `products/${slug}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { }
  if (!res.ok) throw new Error(`CLOUDINARY_UPLOAD_FAILED: ${json?.error?.message ?? `HTTP_${res.status}`}`);
  const secureUrl = typeof json?.secure_url === "string" ? json.secure_url : "";
  if (!secureUrl) throw new Error("CLOUDINARY_NO_URL");
  return secureUrl;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  const isError = msg.toLowerCase().startsWith("error") || msg.toLowerCase().includes("revisa");
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[var(--shadow-elevated)] fade-in ${isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      <span className="mt-0.5 shrink-0">
        {isError ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        )}
      </span>
      <span className="flex-1">{msg}</span>
      <button type="button" onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-100 mb-4">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-600)]">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductsClient({
  initialProducts,
  initialProductTypes,
}: {
  initialProducts: Product[];
  initialProductTypes: { key: string; label: string }[];
}) {
  const fallbackTypes = useMemo(
    () =>
      initialProductTypes.length
        ? initialProductTypes
        : [
          { key: "zapatillas", label: "Zapatillas" },
          { key: "ropa", label: "Ropa" },
          { key: "accesorios", label: "Accesorios" },
        ],
    [initialProductTypes]
  );

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [draft, setDraft] = useState<Product>(() => emptyProduct(fallbackTypes[0]?.key ?? "zapatillas"));
  const [busy, setBusy] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyBulkTrash, setBusyBulkTrash] = useState(false);
  const [viewMode, setViewMode] = useState<"active" | "trash">("active");
  const [msg, setMsg] = useState<string | null>(null);

  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);
  const activeProducts = useMemo(() => products.filter((p) => !p.deletedAtMs), [products]);
  const trashedProducts = useMemo(() => products.filter((p) => !!p.deletedAtMs), [products]);
  const baseProducts = viewMode === "active" ? activeProducts : trashedProducts;
  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of baseProducts) map.set(p.productType, (map.get(p.productType) ?? 0) + 1);
    return map;
  }, [baseProducts]);
  const activeCount = useMemo(() => activeProducts.filter((p) => p.status === "active").length, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const token = query.trim().toLowerCase();
    return baseProducts.filter((p) => {
      if (typeFilter && p.productType !== typeFilter) return false;
      if (!token) return true;
      return [p.slug, p.name, p.brand, p.category, p.productType, p.audience].some((x) => (x ?? "").toLowerCase().includes(token));
    });
  }, [baseProducts, query, typeFilter]);

  const typeOptions = useMemo(() => {
    const fromSettings = fallbackTypes.map((t) => ({ key: t.key, label: t.label }));
    const existingKeys = new Set(fromSettings.map((x) => x.key));
    const dynamic = Array.from(typeCounts.keys()).filter((k) => !existingKeys.has(k)).map((k) => ({ key: k, label: k }));
    return [...fromSettings, ...dynamic];
  }, [fallbackTypes, typeCounts]);

  function loadSelected() {
    if (!selected) return;
    setDraft({
      ...selected,
      salePrice: selected.salePrice ?? null,
      images: Array.isArray(selected.images) ? selected.images : [],
      variants: Array.isArray(selected.variants) ? selected.variants : [{ id: "default", stock: 0 }],
    });
    setMsg(null);
  }

  async function save() {
    const errs = validateDraft(draft);
    if (errs.length) { setMsg(`Revisa estos campos:\n${errs.join("\n")}`); return; }
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        productType: draft.productType, audience: draft.audience, slug: draft.slug, status: draft.status,
        name: draft.name, description: draft.description, brand: draft.brand, category: draft.category,
        price: Number(draft.price), onSale: Boolean(draft.onSale),
        salePrice: draft.salePrice === null ? undefined : Number(draft.salePrice),
        images: draft.images.map((x, idx) => ({ ...x, order: idx })),
        variants: draft.variants.map((v) => ({ ...v, stock: Number(v.stock) })),
      };
      await apiPost("/api/admin/products/upsert", payload, { csrfCookieName: CSRF_COOKIE_NAME });
      setMsg("Producto guardado correctamente.");
      setProducts((prev) => {
        const exists = prev.find((p) => p.id === draft.slug);
        const nextItem: Product = { ...draft, id: draft.slug };
        if (exists) return prev.map((p) => (p.id === draft.slug ? nextItem : p));
        return [nextItem, ...prev];
      });
      setSelectedId(draft.slug);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(m === "VALIDATION_ERROR" ? "Error de validación. Revisa tipo, slug, nombre, precio y variantes." : `Error: ${m}`);
    } finally { setBusy(false); }
  }

  async function onPickImage(file: File) {
    setMsg(null);
    try {
      const slug = safeSlug(draft.slug);
      const filename = `${slug}-${Date.now()}.webp`;
      setMsg("Subiendo imagen...");
      let blob: Blob = file;
      let width = 0, height = 0;
      let sizeKB = Math.round(file.size / 1024);
      let converted = false;
      try {
        const conv = await fileToWebp(file);
        blob = conv.blob; width = conv.width; height = conv.height;
        sizeKB = Math.round(conv.blob.size / 1024); converted = true;
      } catch (convErr) { console.warn("WebP conversion failed", convErr); }
      const url = await uploadToCloudinary(blob, slug, filename);
      setDraft((d) => ({ ...d, images: [...d.images, { url, isMain: d.images.length === 0, order: d.images.length, alt: d.name || d.slug }] }));
      setMsg(`Imagen subida a Cloudinary (${width}x${height}, ~${sizeKB}KB).${converted ? " Convertida a WebP." : ""}`);
    } catch (e) {
      setMsg(`Error de imagen: ${e instanceof Error ? e.message : "No se pudo subir"}`);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (selected.status !== "archived") { setMsg("Para eliminar, primero cambia estado a Archivado y guarda."); return; }
    if (!window.confirm(`Mover producto ${selected.slug} a papelera?`)) return;
    setBusyDelete(true); setMsg(null);
    try {
      await apiPost("/api/admin/products/delete", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setProducts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, deletedAtMs: Date.now() } : p)));
      setSelectedId(""); setDraft(emptyProduct(typeOptions[0]?.key ?? "zapatillas"));
      setMsg(`Producto ${selected.slug} enviado a papelera.`);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`); } finally { setBusyDelete(false); }
  }

  async function restoreSelected() {
    if (!selected || !selected.deletedAtMs) { setMsg("El producto no está en papelera."); return; }
    if (!window.confirm(`Restaurar producto ${selected.slug}?`)) return;
    setBusyDelete(true); setMsg(null);
    try {
      await apiPost("/api/admin/products/restore", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setProducts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, deletedAtMs: null } : p)));
      setMsg(`Producto ${selected.slug} restaurado.`);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`); } finally { setBusyDelete(false); }
  }

  async function bulkTrashArchived() {
    if (!window.confirm("Mover a papelera productos archivados del filtro actual?")) return;
    setBusyBulkTrash(true); setMsg(null);
    try {
      const res = await apiPost("/api/admin/products/bulk-delete", { status: "archived", productType: typeFilter || undefined, limit: 500 }, { csrfCookieName: CSRF_COOKIE_NAME }) as { processed?: number };
      setMsg(`Productos enviados a papelera: ${res?.processed ?? 0}.`);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`); } finally { setBusyBulkTrash(false); }
  }

  async function purgeSelected() {
    if (!selected || !selected.deletedAtMs) { setMsg("Solo puedes eliminar definitivo desde la papelera."); return; }
    if (!window.confirm(`Eliminar definitivamente producto ${selected.slug}?`)) return;
    setBusyDelete(true); setMsg(null);
    try {
      await apiPost("/api/admin/products/purge", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setProducts((prev) => prev.filter((p) => p.id !== selected.id));
      setSelectedId(""); setDraft(emptyProduct(typeOptions[0]?.key ?? "zapatillas"));
      setMsg(`Producto ${selected.slug} eliminado definitivamente.`);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`); } finally { setBusyDelete(false); }
  }

  async function bulkPurgeTrash() {
    if (!window.confirm("Eliminar definitivamente productos en papelera?")) return;
    setBusyBulkTrash(true); setMsg(null);
    try {
      const res = await apiPost("/api/admin/products/bulk-purge", { olderThanDays: 0, limit: 500 }, { csrfCookieName: CSRF_COOKIE_NAME }) as { processed?: number };
      setMsg(`Productos eliminados definitivamente: ${res?.processed ?? 0}.`);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`); } finally { setBusyBulkTrash(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="grid xl:grid-cols-[300px_1fr] gap-5">

      {/* ── Sidebar: lista de productos ── */}
      <aside className="flex flex-col gap-3 h-fit">
        {/* KPIs compactos */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-xs font-semibold text-emerald-600 mb-1">Activos</p>
            <p className="text-2xl font-black text-emerald-700">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-xs font-semibold text-slate-500 mb-1">Visibles</p>
            <p className="text-2xl font-black text-slate-700">{baseProducts.length}</p>
          </div>
        </div>

        {/* Controles */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)]">
          <div className="grid gap-2 mb-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o slug" className="pl-9" uiSize="sm" />
            </div>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} uiSize="sm">
              <option value="">Todos los tipos</option>
              {typeOptions.map((t) => (
                <option key={t.key} value={t.key}>{t.label} ({typeCounts.get(t.key) ?? 0})</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" onClick={() => setViewMode("active")} className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all duration-150 ${viewMode === "active" ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)]" : "border-slate-200 bg-white text-slate-600 hover:bg-[var(--surface-hover)]"}`}>
              Activos ({activeProducts.length})
            </button>
            <button type="button" onClick={() => setViewMode("trash")} className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all duration-150 ${viewMode === "trash" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600 hover:bg-[var(--surface-hover)]"}`}>
              Papelera ({trashedProducts.length})
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => { setSelectedId(""); setDraft(emptyProduct(typeOptions[0]?.key ?? "zapatillas")); setMsg(null); }}>
              + Nuevo
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={!selected} onClick={loadSelected}>
              Cargar
            </Button>
            {viewMode === "active" ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void bulkTrashArchived()} disabled={busyBulkTrash}>
                {busyBulkTrash ? "..." : "Masivo papelera"}
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => void bulkPurgeTrash()} disabled={busyBulkTrash}>
                {busyBulkTrash ? "..." : "Vaciar papelera"}
              </Button>
            )}
          </div>
        </div>

        {/* Lista visual de productos */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lista ({filteredProducts.length})</p>
          </div>
          <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-50">
            {filteredProducts.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">Sin productos con esos filtros</div>
            )}
            {filteredProducts.map((p) => {
              const isSelected = p.id === selectedId;
              const mainImg = p.images?.find((i) => i.isMain)?.url ?? p.images?.[0]?.url ?? "";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-all duration-100 ${isSelected ? "bg-[var(--brand-50)] border-l-2 border-[var(--brand-500)]" : "hover:bg-[var(--surface-muted)]"}`}
                >
                  {/* Miniatura */}
                  <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                    {mainImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mainImg} alt={p.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-slate-300">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.name || p.slug}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold border ${p.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {p.status === "active" ? "Activo" : "Archivado"}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">{p.productType}</span>
                      {p.deletedAtMs && <span className="text-[10px] text-rose-500 font-bold">Papelera</span>}
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-700 tabular-nums shrink-0">S/{p.price}</p>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Editor de producto ── */}
      <div className="flex flex-col gap-4">
        {/* Header del editor */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900">
              {selectedId ? "Editar producto" : "Nuevo producto"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {selectedId ? `Editando: ${selected?.name || selected?.slug || "—"}` : "Crea un nuevo producto con variantes e imágenes."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={save} disabled={busy} variant="primary" size="md">
              {busy ? "Guardando..." : "Guardar producto"}
            </Button>
            {viewMode === "active" ? (
              <Button type="button" onClick={() => void deleteSelected()} disabled={busyDelete || !selected} variant="secondary" size="md">
                {busyDelete ? "..." : "Mover a papelera"}
              </Button>
            ) : (
              <>
                <Button type="button" onClick={() => void restoreSelected()} disabled={busyDelete || !selected} variant="secondary" size="md">
                  {busyDelete ? "..." : "Restaurar"}
                </Button>
                <Button type="button" onClick={() => void purgeSelected()} disabled={busyDelete || !selected} variant="ghost" size="md">
                  {busyDelete ? "..." : "Eliminar definitivo"}
                </Button>
              </>
            )}
          </div>
        </div>

        {msg && <Toast msg={msg} onClose={() => setMsg(null)} />}

        {/* Sección: Clasificación */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <SectionHeader
            title="Clasificación del producto"
            subtitle="Tipo, público, slug y estado de visibilidad"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
          />
          <div className="grid md:grid-cols-4 gap-3">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Tipo de producto
              <Select value={draft.productType} onChange={(e) => setDraft((d) => { const nextType = e.target.value; return { ...d, productType: nextType, audience: needsAudienceByType(nextType) ? d.audience : "todos" }; })}>
                {typeOptions.map((t) => (<option key={t.key} value={t.key}>{t.label}</option>))}
              </Select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Público objetivo
              <Select value={draft.audience} onChange={(e) => setDraft((d) => ({ ...d, audience: e.target.value as Product["audience"] }))} disabled={!needsAudienceByType(draft.productType)}>
                {AUDIENCE_OPTIONS.map((x) => (<option key={x.key} value={x.key}>{x.label}</option>))}
              </Select>
              {!needsAudienceByType(draft.productType) && <span className="text-[11px] text-slate-400">Accesorios → Todos</span>}
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Slug (kebab-case)
              <Input value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} placeholder="nike-air-max-270" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Estado
              <Select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Product["status"] }))}>
                <option value="active">Activo (visible)</option>
                <option value="archived">Archivado (oculto)</option>
              </Select>
            </label>
          </div>
        </div>

        {/* Sección: Información */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <SectionHeader
            title="Información del producto"
            subtitle="Nombre, marca, categoría y descripción"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Nombre del producto
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => {
                  const name = e.target.value;
                  const canAutofillSlug = !d.slug || d.slug === safeSlug(d.name || "");
                  return { ...d, name, slug: canAutofillSlug ? safeSlug(name) : d.slug };
                })}
                placeholder="Ej: Nike Air Max 270 Blancas"
              />
            </label>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Marca
                <Input value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))} placeholder="Nike, Adidas, Puma..." />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Categoría (interno)
                <Input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="Running, Casual, Lifestyle..." />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Descripción
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-slate-900 transition-all duration-150 focus:border-[var(--brand-400)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/25 resize-none"
                placeholder="Describe las características del producto..."
              />
            </label>
          </div>
        </div>

        {/* Sección: Precios */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <SectionHeader
            title="Precios"
            subtitle="Precio base y configuración de oferta"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <div className="grid md:grid-cols-3 gap-3">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Precio base (S/)
              <Input type="number" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))} placeholder="0.00" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              ¿En oferta?
              <Select value={draft.onSale ? "yes" : "no"} onChange={(e) => setDraft((d) => ({ ...d, onSale: e.target.value === "yes" }))}>
                <option value="no">No está en oferta</option>
                <option value="yes">Sí, en oferta</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Precio de oferta (S/)
              <Input
                type="number"
                value={draft.salePrice ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, salePrice: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="Solo si está en oferta"
                disabled={!draft.onSale}
              />
            </label>
          </div>
          {draft.onSale && draft.salePrice !== null && draft.price > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Descuento aplicado: {Math.round(((draft.price - draft.salePrice) / draft.price) * 100)}% de ahorro
            </div>
          )}
        </div>

        {/* Sección: Imágenes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <SectionHeader
            title="Imágenes del producto"
            subtitle="Sube imágenes directamente a Cloudinary como WebP"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">{draft.images.length} imagen(es) cargada(s)</p>
            <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--brand-200,#a7d7ac)] bg-[var(--brand-50)] px-3 py-2 text-xs font-semibold text-[var(--brand-700)] cursor-pointer hover:bg-[var(--brand-100,#d8eedc)] transition-colors duration-150">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Subir y convertir a WebP
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickImage(f); e.currentTarget.value = ""; }} />
            </label>
          </div>

          {!draft.images.length ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              Sin imágenes. Sube una imagen con el botón de arriba.
            </div>
          ) : (
            <div className="grid gap-3">
              {draft.images.map((img, idx) => (
                <div key={idx} className="grid md:grid-cols-[80px_1fr_120px_130px_90px] gap-2 items-center rounded-xl border border-slate-200 bg-[var(--surface-muted)] p-2">
                  {/* Preview miniatura */}
                  <div className="h-14 w-14 mx-auto rounded-lg overflow-hidden bg-slate-200 border border-slate-200 shrink-0">
                    {img.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-slate-300">?</div>
                    )}
                  </div>
                  <Input value={img.url} onChange={(e) => setDraft((d) => { const copy = [...d.images]; if (!copy[idx]) return d; copy[idx] = { ...copy[idx], url: e.target.value }; return { ...d, images: copy }; })} placeholder="https://... (URL de Cloudinary)" uiSize="sm" />
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer justify-center">
                    <input type="checkbox" checked={img.isMain} onChange={(e) => setDraft((d) => { const copy = d.images.map((x, i) => ({ ...x, isMain: i === idx ? e.target.checked : false })); return { ...d, images: copy }; })} className="h-4 w-4 rounded border-slate-300 text-[var(--brand-600)]" />
                    Principal
                  </label>
                  <Input value={img.alt ?? ""} onChange={(e) => setDraft((d) => { const copy = [...d.images]; if (!copy[idx]) return d; copy[idx] = { ...copy[idx], alt: e.target.value }; return { ...d, images: copy }; })} placeholder="Alt (SEO)" uiSize="sm" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, images: d.images.filter((_, i) => i !== idx) }))}>
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sección: Variantes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <SectionHeader
            title="Variantes e inventario"
            subtitle="El stock se controla exclusivamente en backend (transacciones)"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
          />
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">{draft.variants.length} variante(s)</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => setDraft((d) => ({ ...d, variants: [...d.variants, { id: `v${d.variants.length + 1}`, stock: 0 }] }))}>
              + Agregar variante
            </Button>
          </div>

          {draft.variants.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              Sin variantes. Agrega al menos una.
            </div>
          ) : (
            <div className="grid gap-2">
              {draft.variants.map((v, idx) => (
                <div key={idx} className={`grid md:grid-cols-[1fr_100px_100px_1fr_110px_90px] gap-2 items-center rounded-xl border p-2.5 ${v.stock === 0 ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-[var(--surface-muted)]"}`}>
                  <Input value={v.id} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, id: e.target.value } : x)) }))} placeholder="ID variante" uiSize="sm" />
                  <Input value={v.size ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, size: e.target.value || undefined } : x)) }))} placeholder="Talla" uiSize="sm" />
                  <Input value={v.color ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, color: e.target.value || undefined } : x)) }))} placeholder="Color" uiSize="sm" />
                  <Input value={v.sku ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, sku: e.target.value || undefined } : x)) }))} placeholder="SKU (opcional)" uiSize="sm" />
                  <div className="relative">
                    <Input type="number" value={v.stock} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, stock: Number(e.target.value) } : x)) }))} placeholder="Stock" uiSize="sm" className={v.stock === 0 ? "border-rose-300 bg-rose-50 text-rose-700" : ""} />
                    {v.stock === 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-500">AGOTADO</span>}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== idx) }))}>
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
