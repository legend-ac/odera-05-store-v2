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
    desc: "Fotos y novedades",
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
    desc: "Videos y drops",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M14 3h3c.2 1.8 1.4 3.1 3 3.8V10c-1.8-.2-3.2-.8-4.2-1.8v7.1a5.3 5.3 0 1 1-4.4-5.2v3a2.3 2.3 0 1 0 1.6 2.2V3Z" />
      </svg>
    ),
  },
  {
    key: "facebook" as const,
    label: "Facebook",
    desc: "Comunidad y ofertas",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M13.5 22v-8h2.7l.5-3h-3.2V9.2c0-.9.3-1.5 1.6-1.5h1.7V5.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.2V11H8v3h2.1v8h3.4Z" />
      </svg>
    ),
  },
  {
    key: "whatsapp" as const,
    label: "WhatsApp",
    desc: "Consultas y pedidos",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm5.2 12.7c-.2.6-1.2 1.1-1.7 1.2-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.3-.3.6-.4.8-.4h.6c.2 0 .5 0 .7.5.2.5.8 1.9.9 2 .1.2.1.4 0 .6-.1.2-.2.4-.3.5-.1.2-.3.4-.4.5-.1.1-.2.3-.1.5.1.2.4.8 1 1.3.7.7 1.3 1 1.5 1.1.2.1.4.1.6-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.6-.2.2.1 1.5.7 1.8.9.3.2.4.2.5.4.1.2.1.9-.1 1.5Z" />
      </svg>
    ),
  },
];

export default function HomeSocialLinks({ compact = false }: { compact?: boolean }) {
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

  if (compact) {
    return (
      <nav aria-label="Redes sociales de ODERA 05" className="border-t border-white/10 pt-6">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Síguenos</p>
        <div className="flex flex-wrap items-center gap-2.5">
          {items.map((s) => (
            <a
              key={s.key}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:border-[var(--vermeil)] hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vermeil)]"
            >
              <span
                className={`footer-social__icon ${s.key === "instagram" ? "text-pink-400" : s.key === "whatsapp" ? "text-emerald-400" : s.key === "facebook" ? "text-blue-400" : "text-white"}`}
                aria-hidden="true"
              >
                {s.icon}
              </span>
              <span>{s.label}</span>
            </a>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <section aria-labelledby="home-social-title" className="home-social mx-auto max-w-7xl px-5 sm:px-8">
      <div className="home-social__inner">
        <div className="home-social__heading">
          <h2 id="home-social-title">SÍGUENOS EN REDES</h2>
          <p>Novedades, lanzamientos y atención directa.</p>
        </div>
        <nav aria-label="Redes sociales de ODERA 05" className="home-social__links">
          {items.map((s) => (
            <a
              key={s.key}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="home-social__link"
            >
              <span className="home-social__icon" aria-hidden="true">{s.icon}</span>
              <span className="home-social__name">{s.label}</span>
              <span className="home-social__arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
