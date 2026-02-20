"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

function ConfirmPageInner() {
  const sp = useSearchParams();
  const publicCode = sp.get("publicCode") ?? "";
  const trackingToken = sp.get("trackingToken") ?? "";

  const [settings, setSettings] = useState<any | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "store"));
        if (!snap.exists()) return;
        if (mounted) setSettings(snap.data());
      } catch (e) {
        console.warn(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMsg(`${label} copiado.`);
      setTimeout(() => setCopyMsg(null), 1800);
    } catch {
      setCopyMsg("No se pudo copiar. Copialo manualmente.");
      setTimeout(() => setCopyMsg(null), 1800);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Pedido registrado</h1>

      <div className="border border-neutral-200 rounded-xl p-4">
        <div className="text-sm text-neutral-600">Codigo de pedido</div>
        <div className="text-xl font-semibold break-all">{publicCode || "-"}</div>
        <button
          type="button"
          onClick={() => copyText(publicCode, "Codigo")}
          className="mt-2 px-3 py-2 text-sm rounded-md border border-neutral-300"
        >
          Copiar codigo
        </button>

        <div className="mt-4 text-sm text-neutral-600">Clave de seguimiento</div>
        <div className="font-mono text-sm break-all">{trackingToken || "-"}</div>
        <button
          type="button"
          onClick={() => copyText(trackingToken, "Clave de seguimiento")}
          className="mt-2 px-3 py-2 text-sm rounded-md border border-neutral-300"
        >
          Copiar clave
        </button>

        <button
          type="button"
          onClick={() => copyText(`Codigo: ${publicCode}\nClave: ${trackingToken}`, "Datos de seguimiento")}
          className="mt-2 ml-2 px-3 py-2 text-sm rounded-md border border-neutral-300"
        >
          Copiar ambos
        </button>

        {copyMsg ? <div className="mt-2 text-xs text-emerald-700">{copyMsg}</div> : null}
      </div>

      <div className="border border-neutral-200 rounded-xl p-4">
        <div className="font-medium mb-2">Como pagar</div>
        {settings ? (
          <div className="text-sm text-neutral-700 whitespace-pre-wrap">
            {settings.paymentInstructions?.yapeNumber ? `Yape: ${settings.paymentInstructions.yapeNumber} (${settings.paymentInstructions.yapeName ?? ""})\n` : ""}
            {settings.paymentInstructions?.plinNumber ? `Plin: ${settings.paymentInstructions.plinNumber} (${settings.paymentInstructions.plinName ?? ""})\n` : ""}
            {!settings.paymentInstructions?.yapeNumber && !settings.paymentInstructions?.plinNumber ? "Pronto agregaremos los metodos de pago." : ""}
          </div>
        ) : (
          <div className="text-sm text-neutral-600">Cargando datos de pago...</div>
        )}
      </div>

      <div className="text-sm text-neutral-700">
        Cuando completes tu pago, entra a Mis pedidos y envia tu codigo de operacion.
      </div>

      <a
        href={`/track?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`}
        className="px-4 py-2 rounded-md bg-black text-white text-sm w-fit"
      >
        Ir a Mis pedidos
      </a>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-8 text-sm text-neutral-600">Cargando...</div>}>
      <ConfirmPageInner />
    </Suspense>
  );
}
