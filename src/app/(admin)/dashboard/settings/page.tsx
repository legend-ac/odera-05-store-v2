export const runtime = "nodejs";
export const maxDuration = 60;

import { adminDb } from "@/lib/server/firebaseAdmin";
import SettingsClient from "./settings-client";

const DEFAULT_PRODUCT_TYPES = [
  { key: "zapatillas", label: "Zapatillas", subtitle: "Running, urbano y futbol", cta: "Ver zapatillas", enabled: true },
  { key: "ropa", label: "Ropa", subtitle: "Poleras, casacas y conjuntos", cta: "Ver ropa", enabled: true },
  { key: "accesorios", label: "Accesorios", subtitle: "Mochilas, medias y mas", cta: "Ver accesorios", enabled: true },
];

export default async function SettingsPage() {
  let snap: any = null;
  try {
    snap = await adminDb.doc("settings/store").get();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("NOT_FOUND")) throw e;
  }
  const data = snap?.exists ? (snap.data() as any) : null;

  const initial = data
      ? {
          storeName: String(data.storeName ?? "ODERA 05 STORE"),
          homePromoEnabled: Boolean(data.homePromoEnabled ?? true),
          homePromo: {
            title: String(data.homePromo?.title ?? "Promocion activa"),
            message: String(data.homePromo?.message ?? "Usa el cupon ODERA10 y recibe 10% de descuento."),
            rightNote: String(data.homePromo?.rightNote ?? "Envio gratis por compras desde S/ 200."),
            couponCode: String(data.homePromo?.couponCode ?? "ODERA10"),
            freeShippingFrom: Number(data.homePromo?.freeShippingFrom ?? 200),
          },
          publicContactEmail: String(data.publicContactEmail ?? ""),
          publicWhatsapp: String(data.publicWhatsapp ?? ""),
          socialLinks: {
            instagram: String(data.socialLinks?.instagram ?? ""),
            tiktok: String(data.socialLinks?.tiktok ?? ""),
            facebook: String(data.socialLinks?.facebook ?? ""),
            whatsapp: String(data.socialLinks?.whatsapp ?? ""),
          },
          paymentInstructions: {
            yapeName: String(data.paymentInstructions?.yapeName ?? ""),
            yapeNumber: String(data.paymentInstructions?.yapeNumber ?? ""),
          plinName: String(data.paymentInstructions?.plinName ?? ""),
          plinNumber: String(data.paymentInstructions?.plinNumber ?? ""),
        },
        productTypes: Array.isArray(data.productTypes) && data.productTypes.length
          ? data.productTypes.map((x: any) => ({
              key: String(x?.key ?? ""),
              label: String(x?.label ?? ""),
              subtitle: String(x?.subtitle ?? ""),
              cta: String(x?.cta ?? ""),
              enabled: Boolean(x?.enabled ?? true),
            }))
          : DEFAULT_PRODUCT_TYPES,
      }
      : {
          storeName: "ODERA 05 STORE",
          homePromoEnabled: true,
          homePromo: {
            title: "Promocion activa",
            message: "Usa el cupon ODERA10 y recibe 10% de descuento.",
            rightNote: "Envio gratis por compras desde S/ 200.",
            couponCode: "ODERA10",
            freeShippingFrom: 200,
          },
          publicContactEmail: "",
          publicWhatsapp: "",
          socialLinks: { instagram: "", tiktok: "", facebook: "", whatsapp: "" },
          paymentInstructions: { yapeName: "", yapeNumber: "", plinName: "", plinNumber: "" },
          productTypes: DEFAULT_PRODUCT_TYPES,
        };

  return <SettingsClient initial={initial} />;
}
