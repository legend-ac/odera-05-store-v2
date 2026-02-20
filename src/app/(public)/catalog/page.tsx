"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import { normalizeToken } from "@/lib/searchTokens";

export default function CatalogPage() {
  const [qText, setQText] = useState("");
  const token = useMemo(() => normalizeToken(qText).split(/\s+/g).filter(Boolean)[0] ?? "", [qText]);
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setItems(null);
    setError(null);

    (async () => {
      try {
        const base = collection(db, "products");
        const q = token
          ? query(base, where("status", "==", "active"), where("searchTokens", "array-contains", token), limit(50))
          : query(base, where("status", "==", "active"), limit(50));

        const snap = await getDocs(q);

        const list: ProductCardData[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const imgs = Array.isArray(data.images) ? [...data.images] : [];
          const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
          const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
          const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
          return {
            id: d.id,
            name: String(data.name ?? ""),
            price: Number(data.price ?? 0),
            salePrice: typeof data.salePrice === "number" ? data.salePrice : undefined,
            onSale: Boolean(data.onSale),
            imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
            imageUrls,
          };
        });

        if (mounted) setItems(list);
      } catch (e) {
        console.error(e);
        if (mounted) setError("No pudimos cargar el catalogo. Intenta nuevamente en unos segundos.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Catalogo</h1>
        <p className="text-sm text-neutral-600">Encuentra tus productos por nombre, marca o palabra clave.</p>
      </div>

      <div className="flex gap-2">
        <input
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="Buscar (ej. nike, polera, negro)"
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={() => setQText("")}
          className="px-3 py-2 rounded-md border border-neutral-300 text-sm"
          type="button"
        >
          Limpiar
        </button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {!items ? <div className="text-sm text-neutral-500">Cargando productos...</div> : null}

      {items && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {items && !items.length ? <div className="text-sm text-neutral-500">Aun no hay productos publicados.</div> : null}
    </div>
  );
}
