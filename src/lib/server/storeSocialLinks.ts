import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/server/firebaseAdmin";
import type { SocialLinks } from "@/components/HomeSocialLinks";

// Store settings updates already invalidate store-theme. Share that tag so
// the public links refresh with the appearance without another client read.
export const getStoreSocialLinks = cache(unstable_cache(async (): Promise<SocialLinks> => {
  try {
    const snapshot = await adminDb.doc("settings/store").get();
    const configured = snapshot.data()?.socialLinks;
    const links: SocialLinks = {};
    for (const key of ["instagram", "tiktok", "facebook", "whatsapp"] as const) {
      const value = configured?.[key];
      if (typeof value === "string" && /^https?:\/\//.test(value)) links[key] = value;
    }
    return links;
  } catch {
    return {};
  }
}, ["public-store-social-links"], { revalidate: 60, tags: ["store-theme"] }));
