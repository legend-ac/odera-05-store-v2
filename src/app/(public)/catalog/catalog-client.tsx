"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import { normalizeToken } from "@/lib/searchTokens";

export default function CatalogClient({ initialItems }: { initialItems: ProductCardData[] }) {
  const [qText, setQText] = useState("");
  const token = useMemo(() => normalizeToken(qText).split(/\s+/g).filter(Boolean)[0] ?? "", [qText]);
  const [items, setItems] = useState<ProductCardData[] | null>(initialItems ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setError(null);

    if (!token) {
      setItems(initialItems ?? []);
      return () => {
        mounted = false;
      };
    }

    setItems(null);
    (async () => {
      try {
        const base = collection(db, "products");
        const q = query(base, where("status", "==", "active"), where("searchTokens", "array-contains", token), limit(50));
        const snap = await getDocs(q);

        const raw = snap.docs.map((d) => {
          const data = d.data() as any;
          const imgs = Array.isArray(data.images) ? [...data.images] : [];
          const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
          const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
          const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
          const updatedAtMs = typeof data?.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : 0;
          const dedupeKey = String(data?.slug ?? data?.name ?? d.id).trim().toLowerCase();
          return {
            id: d.id,
            name: String(data.name ?? ""),
            price: Number(data.price ?? 0),
            salePrice: typeof data.salePrice === "number" ? data.salePrice : undefined,
            onSale: Boolean(data.onSale),
            imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
            imageUrls,
            dedupeKey,
            updatedAtMs,
          };
        });

        const byLatest = raw.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        const seen = new Set<string>();
        const list: ProductCardData[] = [];
        for (const it of byLatest) {
          if (seen.has(it.dedupeKey)) continue;
          seen.add(it.dedupeKey);
          list.push({
            id: it.id,
            name: it.name,
            price: it.price,
            salePrice: it.salePrice,
            onSale: it.onSale,
            imageUrl: it.imageUrl,
            imageUrls: it.imageUrls,
          });
        }

        if (mounted) setItems(list);
      } catch (e) {
        console.error(e);
        if (mounted) setError("No pudimos cargar el catalogo. Intenta nuevamente en unos segundos.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token, initialItems]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Catalogo</h1>
        <p className="text-sm text-neutral-600">Encuentra tus productos por nombre, marca o palabra clave.</p>
      </div>

      <div className="panel p-3 md:p-4 flex gap-2">
        <input
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="Buscar (ej. nike, polera, negro)"
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
        />
        <button
          onClick={() => setQText("")}
          className="px-3 py-2 rounded-md border border-slate-300 text-sm bg-white hover:bg-slate-50"
          type="button"
        >
          Limpiar
        </button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {!items ? <div className="text-sm text-neutral-500">Cargando productos...</div> : null}

      {items && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {items && !items.length ? <div className="text-sm text-neutral-500">Aun no hay productos publicados.</div> : null}
    </div>
  );
}
