export const runtime = "nodejs";
export const maxDuration = 60;

import { adminDb } from "@/lib/server/firebaseAdmin";
import SettingsClient from "./settings-client";

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
      }
      : {
          storeName: "ODERA 05 STORE",
          publicContactEmail: "",
          publicWhatsapp: "",
          socialLinks: { instagram: "", tiktok: "", facebook: "", whatsapp: "" },
          paymentInstructions: { yapeName: "", yapeNumber: "", plinName: "", plinNumber: "" },
        };

  return <SettingsClient initial={initial} />;
}
