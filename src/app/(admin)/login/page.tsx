"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";

function setCsrfCookieIfMissing(): void {
  const existing = document.cookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (existing?.[1]) return;

  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const parts = [`${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`, "path=/", "samesite=strict"];
  if (location.protocol === "https:") parts.push("secure");
  document.cookie = parts.join("; ");
}

function LoginPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") ?? "/dashboard", [sp]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function login() {
    setErr(null);
    setBusy(true);
    try {
      setCsrfCookieIfMissing();

      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken(true);

      await apiPost<{ ok: boolean }>("/api/admin/session-login", { idToken }, { csrfCookieName: CSRF_COOKIE_NAME });

      router.push(next);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Error de inicio de sesion";
      setErr(msg);
      try {
        await signOut(auth);
      } catch {
        // ignore
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ingreso de administrador</h1>
      <p className="text-sm text-neutral-600">Inicia sesion con Google. Tu cuenta debe tener permisos de administrador.</p>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      <button
        type="button"
        onClick={login}
        disabled={busy}
        className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
      >
        {busy ? "Ingresando..." : "Ingresar con Google"}
      </button>

      <div className="text-xs text-neutral-500">Nota: el sistema crea una sesion segura por 8 horas.</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-14 text-sm text-neutral-600">Cargando...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
