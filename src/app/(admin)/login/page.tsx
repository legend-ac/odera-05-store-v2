"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";

function setCsrfCookieIfMissing(): void {
  const existing = document.cookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (existing?.[1]) return;

  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const token = `${Date.now()}-${rand}`;
  const parts = [`${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`, "path=/", "samesite=strict"];
  if (location.protocol === "https:") parts.push("secure");
  document.cookie = parts.join("; ");
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
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0d1f15] via-slate-900 to-[#111827] overflow-hidden px-4 py-12">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute top-[-10%] left-[-5%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[100px]" aria-hidden />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[400px] w-[400px] rounded-full bg-blue-500/8 blur-[100px]" aria-hidden />

      <div className="relative w-full max-w-[420px] fade-in-up">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <span className="grid place-items-center h-14 w-14 rounded-2xl bg-gradient-to-br from-[var(--brand-700)] via-[var(--brand-600)] to-[var(--brand-400)] text-white font-bold text-base shadow-[0_8px_28px_rgba(22,78,32,0.5)] ring-1 ring-white/20">
            <span className="absolute inset-[3px] rounded-xl border border-white/20" />
            O5
          </span>
          <div className="text-center">
            <p className="text-white font-display font-bold text-lg tracking-tight">ODERA 05 STORE</p>
            <p className="text-slate-400 text-xs mt-1">Panel de administración</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-6 sm:p-8 flex flex-col gap-5">
          <div>
            <h1 className="text-xl font-display font-bold text-white">Ingreso de administrador</h1>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">Inicia sesión con Google. Tu cuenta debe tener permisos de administrador.</p>
          </div>

          {err ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {err}
            </div>
          ) : null}

          <button
            type="button"
            onClick={login}
            disabled={busy}
            className="group relative w-full h-12 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-700)] to-[var(--brand-500)] group-hover:from-[var(--brand-600)] group-hover:to-[var(--brand-400)] transition-all duration-200" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 shadow-[0_8px_28px_rgba(45,138,58,0.4)] transition-opacity duration-200" />
            <span className="relative flex items-center justify-center gap-2.5">
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {busy ? "Ingresando..." : "Ingresar con Google"}
            </span>
          </button>

          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Sesión segura por 8 horas con autenticación verificada.
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0d1f15] via-slate-900 to-[#111827]">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-sm text-slate-400">
            Preparando acceso seguro...
          </div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
