import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import FeaturedProducts from "@/components/FeaturedProducts";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Zapatillas, ropa y accesorios",
  description: "Zapatillas, ropa y accesorios originales con envíos a todo el Perú.",
};

type Category = { key: string; label: string; subtitle: string; cta: string; imageUrl?: string };

const DEFAULT_CATEGORIES: Category[] = [
  { key: "zapatillas", label: "Zapatillas", subtitle: "Running, urbano y fútbol", cta: "Ver zapatillas" },
  { key: "ropa", label: "Ropa", subtitle: "Poleras, casacas y conjuntos", cta: "Ver ropa" },
  { key: "accesorios", label: "Accesorios", subtitle: "Los detalles para completar tu look", cta: "Ver accesorios" },
];

function categoryImage(category: Category, index: number): string {
  if (category.imageUrl) return category.imageUrl;
  if (category.key.includes("zapat")) return "/brand/category-zapatillas.jpg";
  if (category.key.includes("ropa")) return "/brand/category-ropa.jpg";
  if (category.key.includes("acces")) return "/brand/category-accesorios.jpg";
  return ["/brand/category-zapatillas.jpg", "/brand/category-ropa.jpg", "/brand/category-accesorios.jpg"][index % 3]!;
}

export default async function HomePage() {
  let categories = DEFAULT_CATEGORIES;
  let promo = { enabled: true, message: "Envío gratis desde S/ 200", couponCode: "" };

  try {
    const snapshot = await adminDb.doc("settings/store").get();
    if (snapshot.exists) {
      const data = snapshot.data() as any;
      promo = {
        enabled: Boolean(data?.homePromoEnabled ?? true),
        message: String(data?.homePromo?.message ?? promo.message),
        couponCode: String(data?.homePromo?.couponCode ?? "").trim(),
      };
      if (Array.isArray(data?.productTypes) && data.productTypes.length) {
        const configured = data.productTypes
          .filter((item: any) => item?.enabled !== false)
          .map((item: any) => ({
            key: String(item?.key ?? "").trim(),
            label: String(item?.label ?? "").trim(),
            subtitle: String(item?.subtitle ?? "").trim(),
            cta: String(item?.cta ?? "Ver colección").trim(),
            imageUrl: typeof item?.imageUrl === "string" && item.imageUrl ? item.imageUrl : undefined,
          }))
          .filter((item: Category) => item.key && item.label);
        if (configured.length) categories = configured;
      }
    }
  } catch {
    // The storefront remains available with its local defaults.
  }

  return (
    <div className="bg-white text-zinc-950">
      {promo.enabled && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-white sm:text-xs">
          {promo.couponCode && <span className="mr-2 border border-zinc-600 px-1.5 py-0.5 font-mono text-[10px]">{promo.couponCode}</span>}
          {promo.message}
        </div>
      )}

      <section className="mx-auto grid max-w-7xl lg:grid-cols-[1.02fr_0.98fr]">
        <div className="flex min-h-[430px] flex-col justify-end bg-zinc-950 px-6 py-12 text-white sm:min-h-[520px] sm:px-10 lg:px-14">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">ODERA 05 · Perú</p>
          <h1 className="max-w-xl font-display text-5xl font-bold leading-[0.92] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Muévete<br />a tu manera.</h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-zinc-300">Zapatillas, ropa y accesorios seleccionados para todos los días.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/catalog" className="inline-flex h-11 items-center bg-white px-5 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200">Comprar ahora</Link>
            <Link href="/track" className="inline-flex h-11 items-center border border-zinc-600 px-5 text-sm font-semibold text-white transition hover:border-white">Seguir pedido</Link>
          </div>
        </div>
        <div className="relative min-h-[330px] overflow-hidden bg-zinc-100 lg:min-h-0">
          <Image src="/brand/category-zapatillas.jpg" alt="Colección ODERA 05" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-6 pb-6 pt-16 text-xs font-medium text-white sm:px-8">Selección semanal · stock limitado</div>
        </div>
      </section>

      <section className="border-y border-zinc-200">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {["Productos originales", "Envíos a Lima y provincias", "Pagos con Yape y Plin"].map((item, index) => <div key={item} className="flex items-center gap-4 px-6 py-4 text-sm sm:px-7"><span className="font-mono text-xs text-zinc-400">0{index + 1}</span><span className="font-medium">{item}</span></div>)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-7 flex items-end justify-between border-b border-zinc-200 pb-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Explora</p><h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Compra por categoría</h2></div><Link href="/catalog" className="hidden text-sm font-semibold underline underline-offset-4 sm:block">Ver todo</Link></div>
        <div className="grid gap-7 sm:grid-cols-3">
          {categories.map((category, index) => (
            <Link key={category.key} href={`/catalog?type=${encodeURIComponent(category.key)}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100"><Image src={categoryImage(category, index)} alt={category.label} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" /></div>
              <div className="flex items-start justify-between gap-3 pt-3"><div><h3 className="text-lg font-bold">{category.label}</h3><p className="mt-0.5 text-sm text-zinc-500">{category.subtitle}</p></div><span aria-hidden className="pt-1 text-lg transition-transform group-hover:translate-x-1">→</span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-zinc-50 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-7 flex items-end justify-between border-b border-zinc-200 pb-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Recién llegado</p><h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Novedades</h2></div><Link href="/catalog" className="text-sm font-semibold underline underline-offset-4">Ver catálogo</Link></div>
          <FeaturedProducts />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:grid-cols-[0.8fr_1.2fr] sm:px-8 sm:py-20">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Compra simple</p><h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight">Sin pasos confusos.</h2></div>
        <ol className="grid gap-5 sm:grid-cols-3">{["Elige talla y agrega al carrito.", "Registra tu pago con Yape o Plin.", "Revisa el estado de tu pedido."].map((item, index) => <li key={item} className="border-t border-zinc-300 pt-3"><span className="font-mono text-xs text-zinc-500">0{index + 1}</span><p className="mt-2 text-sm font-medium leading-6">{item}</p></li>)}</ol>
      </section>
    </div>
  );
}
