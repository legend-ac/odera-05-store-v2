import "server-only";

import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { normalizeStoreTheme } from "@/lib/storeTheme";

export const getStoreTheme = unstable_cache(
  async () => {
    try {
      const snapshot = await adminDb.doc("settings/store").get();
      return normalizeStoreTheme(snapshot.data()?.theme);
    } catch {
      return normalizeStoreTheme(undefined);
    }
  },
  ["store-theme"],
  { revalidate: 60, tags: ["store-theme"] },
);

export const getStoreSocialLinks = unstable_cache(
  async (): Promise<Partial<Record<"instagram" | "tiktok" | "facebook" | "whatsapp", string>> | null> => {
    try {
      const snapshot = await adminDb.doc("settings/store").get();
      const links = snapshot.data()?.socialLinks;
      return Object.fromEntries(
        (["instagram", "tiktok", "facebook", "whatsapp"] as const)
          .filter(key => typeof links?.[key] === "string" && /^https?:\/\//.test(links[key]))
          .map(key => [key, links[key] as string]),
      );
    } catch {
      // Retain the client fallback if the optional server read is unavailable.
      return null;
    }
  },
  ["store-social-links"],
  { revalidate: 60, tags: ["store-theme"] },
);
