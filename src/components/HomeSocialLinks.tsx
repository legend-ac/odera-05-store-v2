"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type SocialLinks = {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  whatsapp?: string;
};

function isUrl(v: string | undefined): v is string {
  return !!v && (v.startsWith("http://") || v.startsWith("https://"));
}

const SOCIALS = [
  {
    key: "instagram" as const,
    label: "Instagram",
    handle: "@oderaperu",
    desc: "Fotos y novedades",
    bg: "from-purple-600 to-pink-600",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "tiktok" as const,
    label: "TikTok",
    handle: "@oderaperu",
    desc: "Videos y drops",
    bg: "from-slate-800 to-slate-900",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M14 3h3c.2 1.8 1.4 3.1 3 3.8V10c-1.8-.2-3.2-.8-4.2-1.8v7.1a5.3 5.3 0 1 1-4.4-5.2v3a2.3 2.3 0 1 0 1.6 2.2V3Z" />
      </svg>
    ),
  },
  {
    key: "facebook" as const,
    label: "Facebook",
    handle: "ODERA 05",
    desc: "Comunidad y ofertas",
    bg: "from-blue-600 to-blue-700",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M13.5 22v-8h2.7l.5-3h-3.2V9.2c0-.9.3-1.5 1.6-1.5h1.7V5.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.2V11H8v3h2.1v8h3.4Z" />
      </svg>
    ),
  },
  {
    key: "whatsapp" as const,
    label: "WhatsApp",
    handle: "Escríbenos",
    desc: "Consultas y pedidos",
    bg: "from-emerald-500 to-green-600",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm5.2 12.7c-.2.6-1.2 1.1-1.7 1.2-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.3-.3.6-.4.8-.4h.6c.2 0 .5 0 .7.5.2.5.8 1.9.9 2 .1.2.1.4 0 .6-.1.2-.2.4-.3.5-.1.2-.3.4-.4.5-.1.1-.2.3-.1.5.1.2.4.8 1 1.3.7.7 1.3 1 1.5 1.1.2.1.4.1.6-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.6-.2.2.1 1.5.7 1.8.9.3.2.4.2.5.4.1.2.1.9-.1 1.5Z" />
      </svg>
    ),
  },
];

export default function HomeSocialLinks() {
  const [links, setLinks] = useState<SocialLinks>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "store"));
        if (!snap.exists() || !alive) return;
        const social = ((snap.data() as any).socialLinks ?? {}) as SocialLinks;
        setLinks(social);
      } catch {
        // silencioso
      }
    })();
    return () => { alive = false; };
  }, []);

  const items = useMemo(
    () => SOCIALS.filter((s) => isUrl(links[s.key])).map((s) => ({ ...s, url: links[s.key]! })),
    [links]
  );

  if (!items.length) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.10)]">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 border-b border-white/8">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-400">Síguenos</p>
          <p className="text-sm font-display font-extrabold text-white mt-0.5">Estamos en redes</p>
        </div>
        <p className="text-[11px] text-slate-400 hidden sm:block">Atención directa por WhatsApp</p>
      </div>

      {/* Cards de redes */}
      <div className={`grid gap-px bg-white/5 ${items.length === 1 ? "grid-cols-1" :
          items.length === 2 ? "grid-cols-2" :
            items.length === 3 ? "grid-cols-3" :
              "grid-cols-2 sm:grid-cols-4"
        }`}>
        {items.map((s) => (
          <a
            key={s.key}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col items-center justify-center gap-2.5 bg-slate-900 px-3 py-5 hover:bg-slate-800/80 transition-colors duration-200 ease-out"
          >
            {/* Blob de color al hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} opacity-0 group-hover:opacity-12 transition-opacity duration-300 ease-out`} />

            {/* Ícono con fondo de color */}
            <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${s.bg} text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)] group-hover:scale-110 group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out`}>
              {s.icon}
            </div>

            {/* Texto */}
            <div className="relative z-10 text-center">
              <p className="text-[13px] font-semibold text-white">{s.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
            </div>

            {/* Handle al hover */}
            <div className="relative z-10 h-3 overflow-hidden">
              <p className="text-[10px] font-semibold text-emerald-400 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all duration-200 ease-out">
                {s.handle} ↗
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
