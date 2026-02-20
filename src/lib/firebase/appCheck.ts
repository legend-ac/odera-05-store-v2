"use client";

import { initializeAppCheck, ReCaptchaV3Provider, getToken, type AppCheck } from "firebase/app-check";
import { getFirebaseApp } from "@/lib/firebase/client";
import { getPublicEnv } from "@/lib/env";

let appCheck: AppCheck | null = null;

export async function initAppCheckIfConfigured(): Promise<void> {
  if (typeof window === "undefined") return;
  if (appCheck) return;

  const env = getPublicEnv();
  if (!env.NEXT_PUBLIC_APP_CHECK_SITE_KEY) return;

  appCheck = initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaV3Provider(env.NEXT_PUBLIC_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export async function getAppCheckToken(): Promise<string | null> {
  try {
    if (!appCheck) await initAppCheckIfConfigured();
    if (!appCheck) return null;
    const res = await getToken(appCheck, false);
    return res.token;
  } catch (e) {
    console.warn("AppCheck token error", e);
    return null;
  }
}
