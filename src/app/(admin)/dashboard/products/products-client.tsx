"use client";

import { useMemo, useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";

type Product = {
  id: string;
  productType: string;
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

function emptyProduct(defaultType: string): Product {
  return {
    id: "",
    productType: defaultType,
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
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "product";
}

function validateDraft(draft: Product): string[] {
  const errors: string[] = [];
  const slug = draft.slug.trim();
  if (slug.length < 2) errors.push("El slug es obligatorio (minimo 2 caracteres).");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("El slug debe estar en formato kebab-case (ejemplo: nike-air-max).");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((draft.productType ?? "").trim())) errors.push("El tipo de producto debe estar en kebab-case.");
  if ((draft.name ?? "").trim().length < 2) errors.push("El nombre es obligatorio.");
  if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) errors.push("El precio debe ser un numero valido.");
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
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const detail = json?.error?.message ? String(json.error.message) : `HTTP_${res.status}`;
    throw new Error(`CLOUDINARY_UPLOAD_FAILED: ${detail}`);
  }

  const secureUrl = typeof json?.secure_url === "string" ? json.secure_url : "";
  if (!secureUrl) throw new Error("CLOUDINARY_NO_URL");
  return secureUrl;
}

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
      return [p.slug, p.name, p.brand, p.category, p.productType].some((x) => (x ?? "").toLowerCase().includes(token));
    });
  }, [baseProducts, query, typeFilter]);

  const typeOptions = useMemo(() => {
    const fromSettings = fallbackTypes.map((t) => ({ key: t.key, label: t.label }));
    const existingKeys = new Set(fromSettings.map((x) => x.key));
    const dynamic = Array.from(typeCounts.keys())
      .filter((k) => !existingKeys.has(k))
      .map((k) => ({ key: k, label: k }));
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
    if (errs.length) {
      setMsg(`Revisa estos campos: ${errs.join(" ")}`);
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        productType: draft.productType,
        slug: draft.slug,
        status: draft.status,
        name: draft.name,
        description: draft.description,
        brand: draft.brand,
        category: draft.category,
        price: Number(draft.price),
        onSale: Boolean(draft.onSale),
        salePrice: draft.salePrice === null ? undefined : Number(draft.salePrice),
        images: draft.images.map((x, idx) => ({ ...x, order: idx })),
        variants: draft.variants.map((v) => ({ ...v, stock: Number(v.stock) })),
      };

      await apiPost("/api/admin/products/upsert", payload, { csrfCookieName: CSRF_COOKIE_NAME });
      setMsg("Guardado.");

      setProducts((prev) => {
        const exists = prev.find((p) => p.id === draft.slug);
        const nextItem: Product = { ...draft, id: draft.slug };
        if (exists) return prev.map((p) => (p.id === draft.slug ? nextItem : p));
        return [nextItem, ...prev];
      });
      setSelectedId(draft.slug);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      if (m === "VALIDATION_ERROR") setMsg("Error de validacion. Revisa tipo, slug, nombre, precio y variantes.");
      else setMsg(`Error: ${m}`);
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage(file: File) {
    setMsg(null);
    try {
      const slug = safeSlug(draft.slug);
      const filename = `${slug}-${Date.now()}.webp`;
      setMsg("Subiendo imagen...");

      let blob: Blob = file;
      let width = 0;
      let height = 0;
      let sizeKB = Math.round(file.size / 1024);
      let converted = false;

      try {
        const conv = await fileToWebp(file);
        blob = conv.blob;
        width = conv.width;
        height = conv.height;
        sizeKB = Math.round(conv.blob.size / 1024);
        converted = true;
      } catch (convErr) {
        console.warn("WebP conversion failed, using original file", convErr);
      }

      const url = await uploadToCloudinary(blob, slug, filename);
      setDraft((d) => ({
        ...d,
        images: [...d.images, { url, isMain: d.images.length === 0, order: d.images.length, alt: d.name || d.slug }],
      }));
      setMsg(`Imagen subida a Cloudinary (${width}x${height}, ~${sizeKB}KB).${converted ? " Convertida a WebP." : ""}`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo subir la imagen.";
      setMsg(`Error de imagen: ${m}`);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (selected.status !== "archived") {
      setMsg("Para eliminar, primero cambia estado a Archivado y guarda.");
      return;
    }
    if (!window.confirm(`Mover producto ${selected.slug} a papelera?`)) return;

    setBusyDelete(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/products/delete", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setProducts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, deletedAtMs: Date.now() } : p)));
      setSelectedId("");
      setDraft(emptyProduct(typeOptions[0]?.key ?? "zapatillas"));
      setMsg(`Producto ${selected.slug} enviado a papelera.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyDelete(false);
    }
  }

  async function restoreSelected() {
    if (!selected) return;
    if (!selected.deletedAtMs) {
      setMsg("El producto no esta en papelera.");
      return;
    }
    if (!window.confirm(`Restaurar producto ${selected.slug}?`)) return;

    setBusyDelete(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/products/restore", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setProducts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, deletedAtMs: null } : p)));
      setMsg(`Producto ${selected.slug} restaurado.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyDelete(false);
    }
  }

  async function bulkTrashArchived() {
    if (!window.confirm("Mover a papelera productos archivados del filtro actual?")) return;
    setBusyBulkTrash(true);
    setMsg(null);
    try {
      const res = (await apiPost(
        "/api/admin/products/bulk-delete",
        { status: "archived", productType: typeFilter || undefined, limit: 500 },
        { csrfCookieName: CSRF_COOKIE_NAME }
      )) as { processed?: number };
      setMsg(`Productos enviados a papelera: ${res?.processed ?? 0}.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyBulkTrash(false);
    }
  }

  async function purgeSelected() {
    if (!selected) return;
    if (!selected.deletedAtMs) {
      setMsg("Solo puedes eliminar definitivo desde la papelera.");
      return;
    }
    if (!window.confirm(`Eliminar definitivamente producto ${selected.slug}?`)) return;
    setBusyDelete(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/products/purge", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setProducts((prev) => prev.filter((p) => p.id !== selected.id));
      setSelectedId("");
      setDraft(emptyProduct(typeOptions[0]?.key ?? "zapatillas"));
      setMsg(`Producto ${selected.slug} eliminado definitivamente.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyDelete(false);
    }
  }

  async function bulkPurgeTrash() {
    if (!window.confirm("Eliminar definitivamente productos en papelera?")) return;
    setBusyBulkTrash(true);
    setMsg(null);
    try {
      const res = (await apiPost(
        "/api/admin/products/bulk-purge",
        { olderThanDays: 0, limit: 500 },
        { csrfCookieName: CSRF_COOKIE_NAME }
      )) as { processed?: number };
      setMsg(`Productos eliminados definitivamente: ${res?.processed ?? 0}.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyBulkTrash(false);
    }
  }

  return (
    <div className="grid xl:grid-cols-[320px_1fr] gap-4 md:gap-6">
      <div className="panel p-3 md:p-4 h-fit rounded-2xl border-slate-200 shadow-sm">
        <div className="font-semibold text-slate-900 mb-2">Productos</div>

        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-emerald-800">Activos: {activeCount}</div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-700">Mostrando: {baseProducts.length}</div>
          {typeOptions.map((t) => (
            <div key={t.key} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-700">
              {t.label}: {typeCounts.get(t.key) ?? 0}
            </div>
          ))}
        </div>

        <div className="mb-3 grid gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por slug, nombre o marca"
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm bg-white">
            <option value="">Todos los tipos</option>
            {typeOptions.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            className={`px-3 py-2 rounded-xl border text-sm font-medium ${viewMode === "active" ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            onClick={() => setViewMode("active")}
          >
            Activos ({activeProducts.length})
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-xl border text-sm font-medium ${viewMode === "trash" ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            onClick={() => setViewMode("trash")}
          >
            Papelera ({trashedProducts.length})
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white hover:bg-slate-50 font-medium"
            onClick={() => {
              setSelectedId("");
              setDraft(emptyProduct(typeOptions[0]?.key ?? "zapatillas"));
              setMsg(null);
            }}
          >
            Nuevo
          </button>
          <button type="button" className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white hover:bg-slate-50 disabled:opacity-50 font-medium" disabled={!selected} onClick={loadSelected}>
            Cargar
          </button>
          {viewMode === "active" ? (
            <button
              type="button"
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white hover:bg-slate-50 disabled:opacity-50 font-medium"
              onClick={() => void bulkTrashArchived()}
              disabled={busyBulkTrash}
            >
              {busyBulkTrash ? "Procesando..." : "Masivo a papelera"}
            </button>
          ) : (
            <button
              type="button"
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white hover:bg-slate-50 disabled:opacity-50 font-medium"
              onClick={() => void bulkPurgeTrash()}
              disabled={busyBulkTrash}
            >
              {busyBulkTrash ? "Procesando..." : "Vaciar papelera"}
            </button>
          )}
        </div>

        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full border border-slate-300 rounded-xl px-2 py-2 text-sm bg-white">
          <option value="">(Selecciona)</option>
          {filteredProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.slug} - {p.status === "active" ? "Activo" : "Archivado"}{p.deletedAtMs ? " (papelera)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900">Editor de producto</h1>
            <p className="text-sm text-slate-600">Crea y actualiza productos con variantes e imagenes.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={save} disabled={busy} className="btn-brand disabled:opacity-50">
              {busy ? "Guardando..." : "Guardar"}
            </button>
            {viewMode === "active" ? (
              <button
                type="button"
                onClick={() => void deleteSelected()}
                disabled={busyDelete || !selected}
                className="btn-soft disabled:opacity-50"
              >
                {busyDelete ? "Procesando..." : "Enviar a papelera"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void restoreSelected()}
                  disabled={busyDelete || !selected}
                  className="btn-soft disabled:opacity-50"
                >
                  {busyDelete ? "Procesando..." : "Restaurar"}
                </button>
                <button
                  type="button"
                  onClick={() => void purgeSelected()}
                  disabled={busyDelete || !selected}
                  className="btn-soft disabled:opacity-50"
                >
                  {busyDelete ? "Procesando..." : "Eliminar definitivo"}
                </button>
              </>
            )}
          </div>
        </div>

        {msg ? <div className="text-sm text-slate-700 panel p-3 rounded-2xl border-slate-200 shadow-sm">{msg}</div> : null}

        <div className="grid gap-4">
          <div className="grid md:grid-cols-3 gap-3 panel p-3 md:p-4 shadow-sm">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Tipo de producto</label>
              <select value={draft.productType} onChange={(e) => setDraft((d) => ({ ...d, productType: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
                {typeOptions.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Slug (kebab-case)</label>
              <input value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Estado</label>
              <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Product["status"] }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>

          <div className="grid gap-1 panel p-3 md:p-4 shadow-sm">
            <label className="text-sm font-medium">Nombre</label>
            <input
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => {
                  const name = e.target.value;
                  const canAutofillSlug = !d.slug || d.slug === safeSlug(d.name || "");
                  return { ...d, name, slug: canAutofillSlug ? safeSlug(name) : d.slug };
                })
              }
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3 panel p-3 md:p-4 shadow-sm">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Marca</label>
              <input value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Categoria (uso interno)</label>
              <input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid gap-1 panel p-3 md:p-4 shadow-sm">
            <label className="text-sm font-medium">Descripcion</label>
            <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm min-h-28" />
          </div>

          <div className="grid md:grid-cols-3 gap-3 panel p-3 md:p-4 shadow-sm">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Precio</label>
              <input type="number" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">En oferta</label>
              <select value={draft.onSale ? "yes" : "no"} onChange={(e) => setDraft((d) => ({ ...d, onSale: e.target.value === "yes" }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="no">No</option>
                <option value="yes">Si</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Precio oferta</label>
              <input type="number" value={draft.salePrice ?? ""} onChange={(e) => setDraft((d) => ({ ...d, salePrice: e.target.value === "" ? null : Number(e.target.value) }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl p-3 md:p-4 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div className="font-medium">Imagenes (solo URLs https)</div>
              <label className="text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 cursor-pointer w-fit">
                + Convertir a WebP
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickImage(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="grid gap-2">
              {draft.images.map((img, idx) => (
                <div key={idx} className="grid md:grid-cols-[1fr_120px_130px_90px] gap-2 items-center">
                  <input
                    value={img.url}
                    onChange={(e) =>
                      setDraft((d) => {
                        const copy: Product["images"] = [...d.images];
                        if (!copy[idx]) return d;
                        copy[idx] = { ...copy[idx], url: e.target.value };
                        return { ...d, images: copy };
                      })
                    }
                    className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    placeholder="https://... (URL de Cloudinary)"
                  />
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={img.isMain}
                      onChange={(e) =>
                        setDraft((d) => {
                          const copy = d.images.map((x, i) => ({ ...x, isMain: i === idx ? e.target.checked : false }));
                          return { ...d, images: copy };
                        })
                      }
                    />
                    Main
                  </label>
                  <input
                    value={img.alt ?? ""}
                    onChange={(e) =>
                      setDraft((d) => {
                        const copy: Product["images"] = [...d.images];
                        if (!copy[idx]) return d;
                        copy[idx] = { ...copy[idx], alt: e.target.value };
                        return { ...d, images: copy };
                      })
                    }
                    className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    placeholder="alt"
                  />
                  <button type="button" className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white hover:bg-neutral-50" onClick={() => setDraft((d) => ({ ...d, images: d.images.filter((_, i) => i !== idx) }))}>
                    Quitar
                  </button>
                </div>
              ))}
              {!draft.images.length ? <div className="text-sm text-neutral-500">Sin imagenes.</div> : null}
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl p-3 md:p-4 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div className="font-medium">Variantes</div>
              <button type="button" className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white hover:bg-neutral-50" onClick={() => setDraft((d) => ({ ...d, variants: [...d.variants, { id: `v${d.variants.length + 1}`, stock: 0 }] }))}>
                + Variante
              </button>
            </div>

            <div className="grid gap-2">
              {draft.variants.map((v, idx) => (
                <div key={idx} className="grid md:grid-cols-[160px_120px_120px_1fr_120px_90px] gap-2 items-center">
                  <input value={v.id} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, id: e.target.value } : x)) }))} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="id" />
                  <input value={v.size ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, size: e.target.value || undefined } : x)) }))} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="talla" />
                  <input value={v.color ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, color: e.target.value || undefined } : x)) }))} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="color" />
                  <input value={v.sku ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, sku: e.target.value || undefined } : x)) }))} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="sku (opcional)" />
                  <input type="number" value={v.stock} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, stock: Number(e.target.value) } : x)) }))} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="stock" />
                  <button type="button" className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white hover:bg-neutral-50" onClick={() => setDraft((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== idx) }))}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-neutral-500">El stock se decrementa/incrementa exclusivamente en backend (transactions).</div>
          </div>
        </div>
      </div>
    </div>
  );
}

