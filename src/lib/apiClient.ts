"use client";

import { getAppCheckToken } from "@/lib/firebase/appCheck";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1] ?? "") : null;
}

export async function apiPost<T>(url: string, body: unknown, opts?: { csrfCookieName?: string; idempotencyKey?: string }): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };

  // Optional App Check header
  const token = await getAppCheckToken();
  if (token) headers["x-firebase-appcheck"] = token;

  if (opts?.idempotencyKey) headers["x-idempotency-key"] = opts.idempotencyKey;

  if (opts?.csrfCookieName) {
    const csrf = getCookie(opts.csrfCookieName);
    if (csrf) headers["x-csrf"] = csrf;
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const err = json?.error ? String(json.error) : `HTTP_${res.status}`;
    throw new Error(err);
  }
  return json as T;
}

export function makeIdempotencyKey(): string {
  // simple client key. For stronger you can incorporate randomBytes via Web Crypto.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const CSRF_COOKIE_NAME = "odera_csrf";
