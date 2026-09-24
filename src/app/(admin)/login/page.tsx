"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { auth } from "@/lib/firebase/client";

function setCsrfCookieIfMissing(): void {
  const existing = document.cookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (existing?.[1]) return;

  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const token = `${Date.now()}-${rand}`;
  const parts = [`${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`, "path=/", "samesite=strict"];
  if (location.protocol === "https:") parts.push("secure");
  document.cookie = parts.join("; ");
}

function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => {
    const raw = sp.get("next") ?? "/dashboard";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
    return raw;
  }, [sp]);

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
    <div className="grid min-h-screen place-items-center bg-[#0f172a] px-4 py-12">
      <div className="w-full max-w-[420px] fade-in-up">
        <div className="mb-7 flex flex-col items-center gap-3">
          <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-emerald-700 text-base font-black text-white shadow-[0_12px_30px_rgba(5,150,105,0.25)] ring-1 ring-white/15">
            <span className="absolute inset-[4px] rounded-xl border border-white/15" />
            O5
          </span>
          <div className="text-center">
            <p className="text-lg font-black tracking-tight text-white">ODERA 05 STORE</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Panel de administracion</p>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
          <div>
            <h1 className="text-xl font-black text-white">Ingreso de administrador</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
              Inicia sesion con Google. Tu cuenta debe tener permisos de administrador.
            </p>
          </div>

          {err ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
              {err}
            </div>
          ) : null}

          <button
            type="button"
            onClick={login}
            disabled={busy}
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-white px-4 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {busy ? "Ingresando..." : "Ingresar con Google"}
          </button>

          <div className="flex items-center gap-2.5 text-xs font-medium text-slate-500">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Sesion segura por 8 horas con autenticacion verificada.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[#0f172a]">
          <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-400 backdrop-blur-xl">
            Preparando acceso seguro...
          </div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
