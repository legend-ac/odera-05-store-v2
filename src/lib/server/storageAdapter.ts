import "server-only";

import { getServerEnv } from "@/lib/env";

export type StorageMode = "spark_public_only" | "firebase_storage";

export function getStorageMode(): StorageMode {
  const env = getServerEnv();
  return env.STORAGE_MODE;
}

/**
 * StorageAdapter:
 * - spark_public_only: NO se suben archivos, solo URLs externas o paths en /public
 * - firebase_storage: (migración futura) permitir subida directa a Firebase Storage (requiere Blaze)
 */
export function assertImageUrlAllowed(url: string): void {
  const mode = getStorageMode();
  if (mode === "spark_public_only") {
    // Permitimos:
    // - https://... (hosting externo)
    // - /... (archivo dentro de /public)
    if (url.startsWith("https://")) return;
    if (url.startsWith("/")) return;
    throw new Error("In spark_public_only mode, image url must be https://... or /public path.");
  }
}
