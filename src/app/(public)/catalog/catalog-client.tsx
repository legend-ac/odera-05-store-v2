"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import { normalizeToken } from "@/lib/searchTokens";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";

type SortType = "latest" | "price-asc" | "price-desc" | "name";

export default function CatalogClient({
  initialItems,
  initialQuery,
}: {
  initialItems: ProductCardData[];
  initialQuery: string;
}) {
  const [qText, setQText] = useState(initialQuery ?? "");
  const token = useMemo(() => normalizeToken(qText).split(/\s+/g).filter(Boolean)[0] ?? "", [qText]);
  const [sortBy, setSortBy] = useState<SortType>("latest");
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

  const sortedItems = useMemo(() => {
    const list = [...(items ?? [])];
    if (sortBy === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "price-asc") {
      return list.sort((a, b) => {
        const pa = a.onSale && typeof a.salePrice === "number" ? a.salePrice : a.price;
        const pb = b.onSale && typeof b.salePrice === "number" ? b.salePrice : b.price;
        return pa - pb;
      });
    }
    if (sortBy === "price-desc") {
      return list.sort((a, b) => {
        const pa = a.onSale && typeof a.salePrice === "number" ? a.salePrice : a.price;
        const pb = b.onSale && typeof b.salePrice === "number" ? b.salePrice : b.price;
        return pb - pa;
      });
    }
    return list;
  }, [items, sortBy]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Catalogo</h1>
        <p className="text-sm text-slate-600">Encuentra tus productos por nombre, marca o palabra clave.</p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="grid gap-2 md:grid-cols-[1fr_190px_120px]">
            <Input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Buscar (ej. nike, polera, negro)"
            />
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)}>
              <option value="latest">Mas recientes</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="name">Nombre A-Z</option>
            </Select>
            <Button type="button" variant="secondary" onClick={() => setQText("")}>
              Limpiar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setQText("zapatillas")} className="chip-link">Zapatillas</button>
            <button type="button" onClick={() => setQText("oferta")} className="chip-link">Ofertas</button>
            <button type="button" onClick={() => setQText("futbol")} className="chip-link">Futbol</button>
          </div>
        </CardBody>
      </Card>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {!items ? <div className="text-sm text-slate-500">Cargando productos...</div> : null}

      {items && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedItems.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {items && !items.length ? <div className="text-sm text-slate-500">Aun no hay productos publicados.</div> : null}
    </div>
  );
}
