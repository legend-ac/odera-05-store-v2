import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { getServerEnv } from "@/lib/env";

let inited = false;

declare global {
  // Persist across Next.js dev hot reloads.
  // eslint-disable-next-line no-var
  var __oderaFirestoreSettingsApplied: boolean | undefined;
}

export function getAdminApp() {
  if (!inited) {
    const env = getServerEnv();
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY,
        }),
      });
    }
    inited = true;
  }
  return getApps()[0]!;
}

const serverEnv = getServerEnv();
export const adminDb = getFirestore(getAdminApp(), serverEnv.FIRESTORE_DATABASE_ID);
if (!globalThis.__oderaFirestoreSettingsApplied) {
  try {
    adminDb.settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("Firestore has already been initialized")) {
      throw e;
    }
  }
  globalThis.__oderaFirestoreSettingsApplied = true;
}

export const adminAuth = getAuth(getAdminApp());
export const adminAppCheck = getAppCheck(getAdminApp());
