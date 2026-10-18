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
