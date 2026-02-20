"use client";

import { useMemo, useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";

type Product = {
  id: string;
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
};

function emptyProduct(): Product {
  return {
    id: "",
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
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/webp",
      quality
    );
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
  if (slug.length < 2) errors.push("El slug es obligatorio (minimo 2 caracteres).");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("El slug debe estar en formato kebab-case (ejemplo: nike-air-max).");
  if ((draft.name ?? "").trim().length < 2) errors.push("El nombre es obligatorio.");
  if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) errors.push("El precio debe ser un numero valido.");
  if (!Array.isArray(draft.variants) || draft.variants.length === 0) errors.push("Agrega al menos una variante.");
  return errors;
}

async function uploadToCloudinary(blob: Blob, slug: string, filename: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("upload_preset", uploadPreset);
  form.append("folder", `products/${slug}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const detail = json?.error?.message ? String(json.error.message) : `HTTP_${res.status}`;
    throw new Error(`CLOUDINARY_UPLOAD_FAILED: ${detail}`);
  }

  const url = typeof json?.secure_url === "string" ? json.secure_url : "";
  if (!url) throw new Error("CLOUDINARY_NO_URL");
  return url;
}

export default function ProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<Product>(() => emptyProduct());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);

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

      // Update local list
      setProducts((prev) => {
        const exists = prev.find((p) => p.id === draft.slug);
        const nextItem: Product = { ...draft, id: draft.slug };
        if (exists) return prev.map((p) => (p.id === draft.slug ? nextItem : p));
        return [nextItem, ...prev];
      });
      setSelectedId(draft.slug);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      if (m === "VALIDATION_ERROR") {
        setMsg("Error de validacion. Revisa slug, nombre, precio y variantes.");
      } else {
        setMsg(`Error: ${m}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage(file: File) {
    setMsg(null);
    try {
      const slug = safeSlug(draft.slug);
      const filename = `${slug}-${Date.now()}.webp`;
      const provisionalUrl = `/products/${filename}`;

      // Always show something immediately in UI
      setDraft((d) => ({
        ...d,
        images: [...d.images, { url: provisionalUrl, isMain: d.images.length === 0, order: d.images.length, alt: d.name || d.slug }],
      }));
      setMsg("Imagen agregada. Intentando subir...");

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

      try {
        const url = await uploadToCloudinary(blob, slug, filename);
        setDraft((d) => ({
          ...d,
          images: d.images.map((img) => (img.url === provisionalUrl ? { ...img, url } : img)),
        }));
        setMsg(`Imagen subida a Cloudinary (${width}x${height}, ~${sizeKB}KB).`);
        return;
      } catch (uploadErr: any) {
        console.warn("Cloudinary upload failed, fallback to manual URL", uploadErr);
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);

      setMsg(
        `No se pudo subir automáticamente. Se descargó ${filename} y se agregó ${provisionalUrl}. ` +
          `${converted ? "Imagen convertida a WebP. " : ""}` +
          `Coloca ese archivo en public/products y guarda el producto.`
      );
    } catch (e) {
      console.warn(e);
      alert("No se pudo procesar la imagen.");
    }
  }

  return (
    <div className="grid xl:grid-cols-[300px_1fr] gap-4 md:gap-6">
      <div className="panel p-3 md:p-4 h-fit">
        <div className="font-semibold text-slate-900 mb-2">Productos</div>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white hover:bg-slate-50"
            onClick={() => {
              setSelectedId("");
              setDraft(emptyProduct());
              setMsg(null);
            }}
          >
            Nuevo
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white hover:bg-slate-50 disabled:opacity-50"
            disabled={!selected}
            onClick={loadSelected}
          >
            Cargar
          </button>
        </div>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
        >
          <option value="">(Selecciona)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.slug} - {p.status === "active" ? "Activo" : "Archivado"}
            </option>
          ))}
        </select>

        <div className="mt-3 text-xs text-slate-500">
          Nota: aquí el <b>docId</b> es el <b>slug</b>. Cambiar slug crea otro documento.
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Editor de producto</h1>
            <p className="text-sm text-slate-600">Crea y actualiza productos con variantes e imágenes.</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn-brand disabled:opacity-50"
          >
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>

        {msg ? <div className="text-sm text-slate-700 panel p-3">{msg}</div> : null}

        <div className="grid gap-4">
          <div className="grid md:grid-cols-2 gap-3 panel p-3 md:p-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Slug (kebab-case)</label>
              <input value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Estado</label>
              <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as any }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>

          <div className="grid gap-1 panel p-3 md:p-4">
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

          <div className="grid md:grid-cols-2 gap-3 panel p-3 md:p-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Marca</label>
              <input value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Categoría</label>
              <input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid gap-1 panel p-3 md:p-4">
            <label className="text-sm font-medium">Descripción</label>
            <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="border border-slate-300 rounded-md px-3 py-2 text-sm min-h-28" />
          </div>

          <div className="grid md:grid-cols-3 gap-3 panel p-3 md:p-4">
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
              <div className="font-medium">Imágenes (spark: solo URLs o /public)</div>
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
                        const copy = [...d.images];
                        copy[idx] = { ...copy[idx]!, url: e.target.value };
                        return { ...d, images: copy };
                      })
                    }
                    className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    placeholder="https://... o /products/..."
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
                        const copy = [...d.images];
                        copy[idx] = { ...copy[idx]!, alt: e.target.value };
                        return { ...d, images: copy };
                      })
                    }
                    className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    placeholder="alt"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white hover:bg-neutral-50"
                    onClick={() => setDraft((d) => ({ ...d, images: d.images.filter((_, i) => i !== idx) }))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              {!draft.images.length ? <div className="text-sm text-neutral-500">Sin imágenes.</div> : null}
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl p-3 md:p-4 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div className="font-medium">Variantes</div>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white hover:bg-neutral-50"
                onClick={() => setDraft((d) => ({ ...d, variants: [...d.variants, { id: `v${d.variants.length + 1}`, stock: 0 }] }))}
              >
                + Variante
              </button>
            </div>

            <div className="grid gap-2">
              {draft.variants.map((v, idx) => (
                <div key={idx} className="grid md:grid-cols-[160px_120px_120px_1fr_120px_90px] gap-2 items-center">
                  <input value={v.id} onChange={(e) => setDraft((d) => {
                    const copy = [...d.variants];
                    copy[idx] = { ...copy[idx]!, id: e.target.value };
                    return { ...d, variants: copy };
                  })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="id" />

                  <input value={v.size ?? ""} onChange={(e) => setDraft((d) => {
                    const copy = [...d.variants];
                    copy[idx] = { ...copy[idx]!, size: e.target.value || undefined };
                    return { ...d, variants: copy };
                  })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="talla" />

                  <input value={v.color ?? ""} onChange={(e) => setDraft((d) => {
                    const copy = [...d.variants];
                    copy[idx] = { ...copy[idx]!, color: e.target.value || undefined };
                    return { ...d, variants: copy };
                  })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="color" />

                  <input value={v.sku ?? ""} onChange={(e) => setDraft((d) => {
                    const copy = [...d.variants];
                    copy[idx] = { ...copy[idx]!, sku: e.target.value || undefined };
                    return { ...d, variants: copy };
                  })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="sku (opcional)" />

                  <input type="number" value={v.stock} onChange={(e) => setDraft((d) => {
                    const copy = [...d.variants];
                    copy[idx] = { ...copy[idx]!, stock: Number(e.target.value) };
                    return { ...d, variants: copy };
                  })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" placeholder="stock" />

                  <button type="button" className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white hover:bg-neutral-50" onClick={() => setDraft((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== idx) }))}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-2 text-xs text-neutral-500">
              El stock se decrementa/incrementa exclusivamente en el backend (transactions).
            </div>
          </div>
        </div>

        <div className="text-xs text-neutral-500">
          Seguridad: el endpoint valida con Zod + session cookie + admin claim + CSRF. En modo Spark, URLs de imágenes deben ser https:// o /public.
        </div>
      </div>
    </div>
  );
}
