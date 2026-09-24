"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
import { optimizedProductImage } from "@/lib/image";

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

type SortMode = "name" | "price-desc" | "price-asc" | "stock-asc" | "status";
type EditorTab = "basic" | "media" | "inventory";
type IssueFilter = "all" | "needs-work" | "no-image" | "no-stock" | "low-stock" | "on-sale" | "archived";

const PAGE_SIZE = 12;

const AUDIENCE_OPTIONS: Array<{ key: Product["audience"]; label: string }> = [
  { key: "hombre", label: "Hombre" },
  { key: "mujer", label: "Mujer" },
  { key: "ninos", label: "Ninos" },
  { key: "todos", label: "Todos" },
];

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

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    salePrice: product.salePrice ?? null,
    images: Array.isArray(product.images) ? product.images : [],
    variants: Array.isArray(product.variants) && product.variants.length ? product.variants : [{ id: "default", stock: 0 }],
  };
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

function totalStock(product: Product): number {
  return (product.variants ?? []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
}

function mainImage(product: Product): string {
  return product.images?.find((image) => image.isMain)?.url ?? product.images?.[0]?.url ?? "";
}

function money(value: number | null | undefined): string {
  return `S/ ${Number(value ?? 0).toFixed(2)}`;
}

function productIssues(product: Product): string[] {
  const issues: string[] = [];
  const stock = totalStock(product);
  if (!product.name.trim()) issues.push("Sin nombre");
  if (!product.brand.trim()) issues.push("Sin marca");
  if (!product.images.length) issues.push("Sin imagen");
  if (!product.variants.length) issues.push("Sin variantes");
  if (stock <= 0) issues.push("Sin stock");
  else if (stock <= 3) issues.push("Bajo stock");
  if (Number(product.price || 0) <= 0) issues.push("Sin precio");
  if (product.onSale && (!product.salePrice || Number(product.salePrice) <= 0)) issues.push("Oferta incompleta");
  return issues;
}

function isIncomplete(product: Product): boolean {
  return productIssues(product).some((issue) => !["Bajo stock"].includes(issue));
}

function issueTone(issue: string): string {
  if (issue.includes("Sin stock") || issue.includes("Sin precio") || issue.includes("Sin imagen")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (issue.includes("Bajo") || issue.includes("Oferta")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function validateDraft(draft: Product): string[] {
  const errors: string[] = [];
  const slug = draft.slug.trim();
  if (slug.length < 2) errors.push("El slug es obligatorio.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("El slug debe estar en kebab-case.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((draft.productType ?? "").trim())) errors.push("El tipo debe estar en kebab-case.");
  if (needsAudienceByType(draft.productType) && !draft.audience) errors.push("Elige publico objetivo.");
  if ((draft.name ?? "").trim().length < 2) errors.push("El nombre es obligatorio.");
  if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) errors.push("El precio debe ser valido.");
  if (draft.onSale && (draft.salePrice === null || Number(draft.salePrice) <= 0)) errors.push("Agrega un precio de oferta valido.");
  if (!Array.isArray(draft.variants) || draft.variants.length === 0) errors.push("Agrega al menos una variante.");
  return errors;
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
  if (!res.ok) throw new Error(`CLOUDINARY_UPLOAD_FAILED: ${json?.error?.message ?? `HTTP_${res.status}`}`);
  const secureUrl = typeof json?.secure_url === "string" ? json.secure_url : "";
  if (!secureUrl) throw new Error("CLOUDINARY_NO_URL");
  return secureUrl;
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  const isError = msg.toLowerCase().startsWith("error") || msg.toLowerCase().includes("revisa");
  return (
    <div className={`whitespace-pre-line rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm ${isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      <div className="flex gap-3">
        <span className="flex-1">{msg}</span>
        <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Cerrar aviso">
          x
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: "slate" | "green" | "rose" | "blue" }) {
  const accent = {
    slate: "before:bg-slate-400",
    green: "before:bg-emerald-500",
    rose: "before:bg-rose-500",
    blue: "before:bg-blue-500",
  }[tone];

  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${accent}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        {subtitle && <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function ProductsClient({
  initialProducts,
  initialProductTypes,
  initialSelectedId,
}: {
  initialProducts: Product[];
  initialProductTypes: { key: string; label: string }[];
  initialSelectedId?: string;
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

  const [products, setProducts] = useState<Product[]>(initialProducts.map(normalizeProduct));
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? "");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Product["status"]>("");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [viewMode, setViewMode] = useState<"active" | "trash">("active");
  const [editorTab, setEditorTab] = useState<EditorTab>("basic");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [draft, setDraft] = useState<Product>(() => {
    const selected = initialProducts.find((product) => product.id === initialSelectedId);
    return selected ? normalizeProduct(selected) : emptyProduct(fallbackTypes[0]?.key ?? "zapatillas");
  });
  const [busy, setBusy] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyBulkTrash, setBusyBulkTrash] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);
  const activeProducts = useMemo(() => products.filter((p) => !p.deletedAtMs), [products]);
  const trashedProducts = useMemo(() => products.filter((p) => !!p.deletedAtMs), [products]);
  const baseProducts = viewMode === "active" ? activeProducts : trashedProducts;
  const activeVisibleCount = useMemo(() => activeProducts.filter((p) => p.status === "active").length, [activeProducts]);
  const archivedCount = useMemo(() => activeProducts.filter((p) => p.status === "archived").length, [activeProducts]);
  const noImageCount = useMemo(() => activeProducts.filter((p) => p.images.length === 0).length, [activeProducts]);
  const noStockCount = useMemo(() => activeProducts.filter((p) => totalStock(p) <= 0).length, [activeProducts]);
  const lowStockCount = useMemo(() => activeProducts.filter((p) => totalStock(p) > 0 && totalStock(p) <= 3).length, [activeProducts]);
  const incompleteCount = useMemo(() => activeProducts.filter(isIncomplete).length, [activeProducts]);
  const onSaleCount = useMemo(() => activeProducts.filter((p) => p.onSale).length, [activeProducts]);
  const draftStock = totalStock(draft);
  const draftIssues = productIssues(draft);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of baseProducts) map.set(p.productType, (map.get(p.productType) ?? 0) + 1);
    return map;
  }, [baseProducts]);

  const typeOptions = useMemo(() => {
    const fromSettings = fallbackTypes.map((t) => ({ key: t.key, label: t.label }));
    const existingKeys = new Set(fromSettings.map((x) => x.key));
    const dynamic = Array.from(typeCounts.keys())
      .filter((key) => !existingKeys.has(key))
      .map((key) => ({ key, label: key }));
    return [...fromSettings, ...dynamic];
  }, [fallbackTypes, typeCounts]);

  const filteredProducts = useMemo(() => {
    const token = query.trim().toLowerCase();
    const filtered = baseProducts.filter((p) => {
      if (typeFilter && p.productType !== typeFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (issueFilter === "needs-work" && !isIncomplete(p)) return false;
      if (issueFilter === "no-image" && p.images.length > 0) return false;
      if (issueFilter === "no-stock" && totalStock(p) > 0) return false;
      if (issueFilter === "low-stock") {
        const stock = totalStock(p);
        if (stock <= 0 || stock > 3) return false;
      }
      if (issueFilter === "on-sale" && !p.onSale) return false;
      if (issueFilter === "archived" && p.status !== "archived") return false;
      if (!token) return true;
      return [p.slug, p.name, p.brand, p.category, p.productType, p.audience, String(p.price)].some((x) =>
        (x ?? "").toLowerCase().includes(token)
      );
    });

    return filtered.sort((a, b) => {
      if (sortMode === "price-desc") return Number(b.price || 0) - Number(a.price || 0);
      if (sortMode === "price-asc") return Number(a.price || 0) - Number(b.price || 0);
      if (sortMode === "stock-asc") return totalStock(a) - totalStock(b);
      if (sortMode === "status") return a.status.localeCompare(b.status) || (a.name || a.slug).localeCompare(b.name || b.slug);
      return (a.name || a.slug).localeCompare(b.name || b.slug);
    });
  }, [baseProducts, issueFilter, query, sortMode, statusFilter, typeFilter]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const criticalProducts = useMemo(() => activeProducts.filter(isIncomplete).slice(0, 5), [activeProducts]);

  function resetFilters() {
    setQuery("");
    setTypeFilter("");
    setStatusFilter("");
    setIssueFilter("all");
    setVisibleCount(PAGE_SIZE);
  }

  function applyIssueFilter(next: IssueFilter) {
    setIssueFilter(next);
    setVisibleCount(PAGE_SIZE);
  }

  function selectProduct(product: Product) {
    setSelectedId(product.id);
    setDraft(normalizeProduct(product));
    setEditorTab("basic");
    setMsg(null);
  }

  function startNew() {
    setSelectedId("");
    setDraft(emptyProduct(typeOptions[0]?.key ?? "zapatillas"));
    setEditorTab("basic");
    setMsg(null);
  }

  async function save() {
    const errs = validateDraft(draft);
    if (errs.length) {
      setMsg(`Revisa estos campos:\n${errs.join("\n")}`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        productType: draft.productType,
        audience: draft.audience,
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
      const nextItem = normalizeProduct({ ...draft, id: draft.slug });
      setProducts((prev) => {
        const previousId = selectedId || draft.slug;
        const exists = prev.some((p) => p.id === previousId || p.id === draft.slug);
        if (exists) return prev.map((p) => (p.id === previousId || p.id === draft.slug ? nextItem : p));
        return [nextItem, ...prev];
      });
      setSelectedId(draft.slug);
      setDraft(nextItem);
      setMsg("Producto guardado correctamente.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(m === "VALIDATION_ERROR" ? "Error de validacion. Revisa tipo, slug, nombre, precio y variantes." : `Error: ${m}`);
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage(file: File) {
    setMsg(null);
    try {
      const slug = safeSlug(draft.slug || draft.name);
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
        console.warn("WebP conversion failed", convErr);
      }
      const url = await uploadToCloudinary(blob, slug, filename);
      setDraft((d) => ({
        ...d,
        images: [...d.images, { url, isMain: d.images.length === 0, order: d.images.length, alt: d.name || d.slug }],
      }));
      setMsg(`Imagen subida (${width}x${height}, ${sizeKB}KB).${converted ? " Convertida a WebP." : ""}`);
    } catch (e) {
      setMsg(`Error de imagen: ${e instanceof Error ? e.message : "No se pudo subir"}`);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (selected.status !== "archived") {
      setMsg("Para mover a papelera, primero cambia el estado a Archivado y guarda.");
      return;
    }
    if (!window.confirm(`Mover producto ${selected.slug} a papelera?`)) return;
    setBusyDelete(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/products/delete", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setProducts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, deletedAtMs: Date.now() } : p)));
      startNew();
      setMsg(`Producto ${selected.slug} enviado a papelera.`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyDelete(false);
    }
  }

  async function restoreSelected() {
    if (!selected || !selected.deletedAtMs) {
      setMsg("El producto no esta en papelera.");
      return;
    }
    if (!window.confirm(`Restaurar producto ${selected.slug}?`)) return;
    setBusyDelete(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/products/restore", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      const restored = { ...selected, deletedAtMs: null };
      setProducts((prev) => prev.map((p) => (p.id === selected.id ? restored : p)));
      setDraft(restored);
      setMsg(`Producto ${selected.slug} restaurado.`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyDelete(false);
    }
  }

  async function purgeSelected() {
    if (!selected || !selected.deletedAtMs) {
      setMsg("Solo puedes eliminar definitivamente desde la papelera.");
      return;
    }
    if (!window.confirm(`Eliminar definitivamente producto ${selected.slug}?`)) return;
    setBusyDelete(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/products/purge", { productId: selected.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setProducts((prev) => prev.filter((p) => p.id !== selected.id));
      startNew();
      setMsg(`Producto ${selected.slug} eliminado definitivamente.`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyDelete(false);
    }
  }

  async function bulkTrashArchived() {
    if (!window.confirm("Mover a papelera los productos archivados del filtro actual?")) return;
    setBusyBulkTrash(true);
    setMsg(null);
    try {
      const targetIds = filteredProducts.filter((p) => p.status === "archived").map((p) => p.id);
      const res = (await apiPost(
        "/api/admin/products/bulk-delete",
        { status: "archived", productType: typeFilter || undefined, limit: 500 },
        { csrfCookieName: CSRF_COOKIE_NAME }
      )) as { processed?: number };
      setProducts((prev) => prev.map((p) => (targetIds.includes(p.id) ? { ...p, deletedAtMs: Date.now() } : p)));
      if (selectedId && targetIds.includes(selectedId)) startNew();
      setMsg(`Productos enviados a papelera: ${res?.processed ?? targetIds.length}.`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyBulkTrash(false);
    }
  }

  async function bulkPurgeTrash() {
    if (!window.confirm("Eliminar definitivamente los productos en papelera?")) return;
    setBusyBulkTrash(true);
    setMsg(null);
    try {
      const targetIds = trashedProducts.map((p) => p.id);
      const res = (await apiPost(
        "/api/admin/products/bulk-purge",
        { olderThanDays: 0, limit: 500 },
        { csrfCookieName: CSRF_COOKIE_NAME }
      )) as { processed?: number };
      setProducts((prev) => prev.filter((p) => !targetIds.includes(p.id)));
      if (selectedId && targetIds.includes(selectedId)) startNew();
      setMsg(`Productos eliminados definitivamente: ${res?.processed ?? targetIds.length}.`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyBulkTrash(false);
    }
  }

  const currentImage = mainImage(draft);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Catalogo administrativo</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Productos</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Gestiona visibilidad, precios, stock e imagenes desde una vista de operacion.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[380px]">
            <Button type="button" onClick={startNew} variant="primary" size="md">
              Nuevo producto
            </Button>
            {viewMode === "active" ? (
              <Button type="button" variant="secondary" size="md" onClick={() => void bulkTrashArchived()} disabled={busyBulkTrash}>
                {busyBulkTrash ? "Procesando..." : "Enviar archivados"}
              </Button>
            ) : (
              <Button type="button" variant="destructive" size="md" onClick={() => void bulkPurgeTrash()} disabled={busyBulkTrash}>
                {busyBulkTrash ? "Procesando..." : "Vaciar papelera"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Publicados" value={activeVisibleCount} tone="green" />
          <Metric label="Archivados" value={archivedCount} />
          <Metric label="Sin imagen" value={noImageCount} tone={noImageCount ? "rose" : "slate"} />
          <Metric label="Sin stock" value={noStockCount} tone={noStockCount ? "rose" : "slate"} />
          <Metric label="Bajo stock" value={lowStockCount} tone={lowStockCount ? "rose" : "slate"} />
          <Metric label="Papelera" value={trashedProducts.length} tone="blue" />
        </div>
      </section>

      {msg && <Toast msg={msg} onClose={() => setMsg(null)} />}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Control de catálogo</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              {incompleteCount > 0 ? "Corrige primero lo que bloquea la venta" : "Catalogo sin bloqueos graves"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Los productos con solo bajo stock no se mezclan aqui; se revisan aparte para no confundir prioridades.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyIssueFilter("needs-work")} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100">
              Corregir graves ({incompleteCount})
            </button>
            <button type="button" onClick={() => applyIssueFilter("low-stock")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 hover:bg-amber-100">
              Reponer bajo stock ({lowStockCount})
            </button>
            <button type="button" onClick={() => applyIssueFilter("no-image")} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
              Subir imagenes ({noImageCount})
            </button>
          </div>
        </div>

        {criticalProducts.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1fr_150px_130px] bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
              <span>Producto</span>
              <span>Problema</span>
              <span className="text-right">Accion</span>
            </div>
            <div className="divide-y divide-slate-100">
              {criticalProducts.map((p) => {
                const mainIssue = productIssues(p).find((issue) => issue !== "Bajo stock") ?? "Revisar";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p)}
                    className={`grid w-full grid-cols-[1fr_150px_130px] items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50 ${selectedId === p.id ? "bg-emerald-50" : "bg-white"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-950">{p.name || p.slug}</span>
                      <span className="block text-xs font-semibold text-slate-500">Stock {totalStock(p)} / {p.images.length} imagen(es)</span>
                    </span>
                    <span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-black ${issueTone(mainIssue)}`}>{mainIssue}</span>
                    <span className="text-right text-xs font-black text-[var(--brand-700)]">{selectedId === p.id ? "Editando" : "Abrir editor"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            No hay productos sin imagen, sin stock, sin precio o sin variantes. Solo queda mantenimiento normal de inventario.
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">Inventario del catalogo</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {filteredProducts.length} de {baseProducts.length} productos visibles con los filtros actuales.
              </p>
            </div>
            {(query || typeFilter || statusFilter || issueFilter !== "all") && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_180px_180px_180px]">
            <label className="grid gap-1 text-xs font-black text-slate-600">
              Buscar
              <Input value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Nombre, marca, slug o precio" uiSize="md" />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">
              Tipo
              <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setVisibleCount(PAGE_SIZE); }} uiSize="md">
                <option value="">Todos los tipos</option>
                {typeOptions.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} ({typeCounts.get(t.key) ?? 0})
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">
              Estado
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as "" | Product["status"]); setVisibleCount(PAGE_SIZE); }} uiSize="md">
                <option value="">Todo estado</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">
              Orden
              <Select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} uiSize="md">
                <option value="name">Nombre</option>
                <option value="stock-asc">Menor stock</option>
                <option value="price-desc">Precio mayor</option>
                <option value="price-asc">Precio menor</option>
                <option value="status">Estado</option>
              </Select>
            </label>
          </div>

          <div className="mt-4 inline-grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("active")}
              className={`rounded-md px-4 py-2 text-xs font-black transition ${viewMode === "active" ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-950"}`}
            >
              Catalogo ({activeProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("trash")}
              className={`rounded-md px-4 py-2 text-xs font-black transition ${viewMode === "trash" ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-950"}`}
            >
              Papelera ({trashedProducts.length})
            </button>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Filtros utiles</p>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", `Todos (${baseProducts.length})`],
                ["needs-work", `Por corregir (${incompleteCount})`],
                ["no-image", `Sin imagen (${noImageCount})`],
                ["no-stock", `Sin stock (${noStockCount})`],
                ["low-stock", `Bajo stock (${lowStockCount})`],
                ["on-sale", `En oferta (${onSaleCount})`],
                ["archived", `Archivados (${archivedCount})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyIssueFilter(key as IssueFilter)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                    issueFilter === key
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-white text-left text-[11px] font-black uppercase tracking-wide text-slate-500 shadow-[inset_0_-1px_0_#e2e8f0]">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-3 py-3">Categoria</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Stock</th>
                <th className="px-3 py-3">Revision</th>
                <th className="px-3 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Edicion</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No hay productos con esos filtros.
                  </td>
                </tr>
              )}
              {visibleProducts.map((p) => {
                const isSelected = p.id === selectedId;
                const stock = totalStock(p);
                const issues = productIssues(p);
                return (
                  <tr key={p.id} onClick={() => selectProduct(p)} className={`cursor-pointer transition ${isSelected ? "bg-emerald-50" : "bg-white hover:bg-slate-50"}`}>
                    <td className="border-b border-slate-100 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          {mainImage(p) ? (
                            <Image
                              src={optimizedProductImage(mainImage(p), 160)}
                              alt={p.name || p.slug}
                              fill
                              unoptimized
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-[10px] font-black text-slate-300">IMG</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">{p.name || p.slug}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{p.brand || "Sin marca"}</p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <p className="text-xs font-black text-slate-700">{p.productType}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{p.audience}</p>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className={`inline-flex min-w-[78px] justify-center rounded-full border px-2 py-1 text-[11px] font-black ${p.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                        {p.status === "active" ? "Activo" : "Archivado"}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right">
                      <span className={`inline-flex min-w-10 justify-center rounded-lg px-2.5 py-1.5 text-sm font-black tabular-nums ${stock <= 3 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-800"}`}>
                        {stock}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      {issues.length === 0 ? (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                          Completo
                        </span>
                      ) : (
                        <div className="flex max-w-[260px] flex-wrap gap-1.5">
                          {issues.slice(0, 3).map((issue) => (
                            <span key={issue} className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${issueTone(issue)}`}>
                              {issue}
                            </span>
                          ))}
                          {issues.length > 3 && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-500">+{issues.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right">
                      <p className="font-black tabular-nums text-slate-950">{money(p.onSale ? p.salePrice : p.price)}</p>
                      {p.onSale && <p className="text-[11px] font-black text-rose-600">Oferta</p>}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right">
                      <span className={`inline-flex min-w-[76px] justify-center rounded-lg px-3 py-2 text-xs font-black ${isSelected ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {isSelected ? "Editando" : "Editar"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredProducts.length > PAGE_SIZE && (
          <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Mostrando {Math.min(visibleCount, filteredProducts.length)} de {filteredProducts.length}. Carga por bloques para mantener el admin rapido.
            </p>
            <div className="flex gap-2">
              {visibleCount > PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  Ver menos
                </button>
              )}
              {visibleCount < filteredProducts.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="h-9 rounded-lg border border-slate-950 bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800"
                >
                  Cargar 12 mas
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{selectedId ? "Editor del producto seleccionado" : "Nuevo producto"}</p>
              <h2 className="mt-1 truncate text-2xl font-black text-slate-950">{draft.name || draft.slug || "Producto sin nombre"}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {draft.productType} / {draft.status === "active" ? "visible en tienda" : "oculto o archivado"} / stock {draftStock}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={busy} variant="primary" size="md">{busy ? "Guardando..." : "Guardar"}</Button>
              {viewMode === "active" ? (
                <Button type="button" onClick={() => void deleteSelected()} disabled={busyDelete || !selected} variant="secondary" size="md">
                  {busyDelete ? "Procesando..." : "Mover a papelera"}
                </Button>
              ) : (
                <>
                  <Button type="button" onClick={() => void restoreSelected()} disabled={busyDelete || !selected} variant="secondary" size="md">Restaurar</Button>
                  <Button type="button" onClick={() => void purgeSelected()} disabled={busyDelete || !selected} variant="destructive" size="md">Eliminar</Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1">
            {[
              ["basic", "Datos"],
              ["media", "Imagenes"],
              ["inventory", "Inventario"],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setEditorTab(key as EditorTab)} className={`rounded-md px-3 py-2 text-sm font-black transition ${editorTab === key ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">
            <div className={`rounded-xl border p-3 ${draftIssues.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <p className={`text-xs font-black uppercase tracking-wide ${draftIssues.length ? "text-amber-700" : "text-emerald-700"}`}>
                {draftIssues.length ? "Falta corregir" : "Producto listo"}
              </p>
              {draftIssues.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {draftIssues.map((issue) => (
                    <span key={issue} className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${issueTone(issue)}`}>
                      {issue}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm font-semibold text-emerald-800">Tiene datos, imagen, precio y stock suficiente para vender.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ruta recomendada</p>
              <ol className="mt-2 grid gap-1 text-xs font-semibold text-slate-600">
                <li className={editorTab === "basic" ? "text-slate-950" : ""}>1. Datos y precio</li>
                <li className={editorTab === "media" ? "text-slate-950" : ""}>2. Imagen principal</li>
                <li className={editorTab === "inventory" ? "text-slate-950" : ""}>3. Stock por variante</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="p-4">
          {editorTab === "basic" && (
            <div className="grid gap-4">
              <Panel title="Datos comerciales" subtitle="Define como aparece y se vende el producto.">
                <div className="grid gap-3 lg:grid-cols-4">
                  <label className="grid gap-1 text-xs font-bold text-slate-600 lg:col-span-2">
                    Nombre
                    <Input
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((d) => {
                          const name = e.target.value;
                          const canAutofillSlug = !d.slug || d.slug === safeSlug(d.name || "");
                          return { ...d, name, slug: canAutofillSlug ? safeSlug(name) : d.slug };
                        })
                      }
                      placeholder="Ej: Nike Air Max 270"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Tipo
                    <Select value={draft.productType} onChange={(e) => setDraft((d) => { const nextType = e.target.value; return { ...d, productType: nextType, audience: needsAudienceByType(nextType) ? d.audience : "todos" }; })}>
                      {typeOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </Select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Estado
                    <Select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Product["status"] }))}>
                      <option value="active">Activo visible</option>
                      <option value="archived">Archivado oculto</option>
                    </Select>
                  </label>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-4">
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Marca
                    <Input value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))} placeholder="Nike, Adidas..." />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Categoria interna
                    <Input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="Running, Casual..." />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Publico
                    <Select value={draft.audience} onChange={(e) => setDraft((d) => ({ ...d, audience: e.target.value as Product["audience"] }))} disabled={!needsAudienceByType(draft.productType)}>
                      {AUDIENCE_OPTIONS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                    </Select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Slug
                    <Input value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: safeSlug(e.target.value) }))} placeholder="nike-air-max" />
                  </label>
                </div>

                <label className="mt-3 grid gap-1 text-xs font-bold text-slate-600">
                  Descripcion
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    className="min-h-[96px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] focus:border-[var(--brand-400)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/25"
                    placeholder="Material, uso recomendado, detalles de talla, etc."
                  />
                </label>
              </Panel>

              <Panel title="Precios" subtitle="Precio regular, oferta y calculo de descuento.">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Precio base
                    <Input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))} />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Oferta
                    <Select value={draft.onSale ? "yes" : "no"} onChange={(e) => setDraft((d) => ({ ...d, onSale: e.target.value === "yes", salePrice: e.target.value === "yes" ? d.salePrice : null }))}>
                      <option value="no">Sin oferta</option>
                      <option value="yes">En oferta</option>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Precio oferta
                    <Input type="number" min="0" step="0.01" value={draft.salePrice ?? ""} disabled={!draft.onSale} onChange={(e) => setDraft((d) => ({ ...d, salePrice: e.target.value === "" ? null : Number(e.target.value) }))} />
                  </label>
                </div>
                {draft.onSale && draft.salePrice !== null && draft.price > 0 && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                    Oferta visible: {money(draft.salePrice)} / ahorro {Math.max(0, Math.round(((draft.price - draft.salePrice) / draft.price) * 100))}%
                  </div>
                )}
              </Panel>
            </div>
          )}

          {editorTab === "media" && (
            <Panel title="Imagenes" subtitle="Miniaturas, principal y texto alternativo.">
              <div className="mb-4 grid gap-3 lg:grid-cols-[180px_1fr_auto] lg:items-center">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {currentImage ? (
                    <Image
                      src={optimizedProductImage(currentImage, 900)}
                      alt={draft.name || draft.slug}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-sm font-black text-slate-300">SIN IMAGEN</div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950">{draft.images.length} imagen(es)</p>
                  <p className="mt-1 text-sm text-slate-500">La principal aparece en catalogo y tarjetas.</p>
                </div>
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[var(--brand-200,#a7d7ac)] bg-[var(--brand-50)] px-4 text-sm font-black text-[var(--brand-700)] hover:bg-[var(--brand-100,#d8eedc)]">
                  Subir WebP
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickImage(f); e.currentTarget.value = ""; }} />
                </label>
              </div>

              <div className="grid gap-2">
                {draft.images.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Agrega al menos una imagen para mejorar el catalogo.</div>}
                {draft.images.map((img, idx) => (
                  <div key={`${img.url}-${idx}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 lg:grid-cols-[64px_minmax(0,1fr)_120px_160px_90px] lg:items-center">
                    <div className="relative h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-white">
                      {img.url ? (
                        <Image
                          src={optimizedProductImage(img.url, 180)}
                          alt={img.alt ?? ""}
                          fill
                          unoptimized
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-xs font-bold text-slate-300">IMG</div>
                      )}
                    </div>
                    <Input value={img.url} onChange={(e) => setDraft((d) => { const copy = [...d.images]; const current = copy[idx]; if (!current) return d; copy[idx] = { ...current, url: e.target.value }; return { ...d, images: copy }; })} placeholder="URL de imagen" uiSize="sm" />
                    <label className="inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
                      <input type="checkbox" checked={img.isMain} onChange={() => setDraft((d) => ({ ...d, images: d.images.map((x, i) => ({ ...x, isMain: i === idx })) }))} className="h-4 w-4 rounded border-slate-300" />
                      Principal
                    </label>
                    <Input value={img.alt ?? ""} onChange={(e) => setDraft((d) => { const copy = [...d.images]; const current = copy[idx]; if (!current) return d; copy[idx] = { ...current, alt: e.target.value }; return { ...d, images: copy }; })} placeholder="Alt SEO" uiSize="sm" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, images: d.images.filter((_, i) => i !== idx).map((x, order) => ({ ...x, order, isMain: order === 0 ? true : x.isMain })) }))}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {editorTab === "inventory" && (
            <Panel title="Variantes e inventario" subtitle="Tallas, colores, SKU y stock.">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 gap-2 sm:w-80">
                  <Metric label="Variantes" value={draft.variants.length} />
                  <Metric label="Stock total" value={draftStock} tone={draftStock <= 3 ? "rose" : "green"} />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setDraft((d) => ({ ...d, variants: [...d.variants, { id: `v${d.variants.length + 1}`, stock: 0 }] }))}>
                  Agregar variante
                </Button>
              </div>

              <div className="grid gap-2">
                {draft.variants.map((v, idx) => (
                  <div key={`${v.id}-${idx}`} className={`grid gap-2 rounded-lg border p-2 lg:grid-cols-[1fr_90px_110px_1fr_110px_90px] lg:items-center ${Number(v.stock) <= 0 ? "border-rose-200 bg-rose-50/60" : "border-slate-200 bg-slate-50"}`}>
                    <Input value={v.id} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, id: e.target.value } : x)) }))} placeholder="ID" uiSize="sm" />
                    <Input value={v.size ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, size: e.target.value || undefined } : x)) }))} placeholder="Talla" uiSize="sm" />
                    <Input value={v.color ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, color: e.target.value || undefined } : x)) }))} placeholder="Color" uiSize="sm" />
                    <Input value={v.sku ?? ""} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, sku: e.target.value || undefined } : x)) }))} placeholder="SKU" uiSize="sm" />
                    <Input type="number" min="0" value={v.stock} onChange={(e) => setDraft((d) => ({ ...d, variants: d.variants.map((x, i) => (i === idx ? { ...x, stock: Number(e.target.value) } : x)) }))} placeholder="Stock" uiSize="sm" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== idx) }))}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </section>
    </div>
  );
}
