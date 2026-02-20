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

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M14 3h3c.2 1.8 1.4 3.1 3 3.8V10c-1.8-.2-3.2-.8-4.2-1.8v7.1a5.3 5.3 0 1 1-4.4-5.2v3a2.3 2.3 0 1 0 1.6 2.2V3Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M13.5 22v-8h2.7l.5-3h-3.2V9.2c0-.9.3-1.5 1.6-1.5h1.7V5.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.2V11H8v3h2.1v8h3.4Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm5.2 12.7c-.2.6-1.2 1.1-1.7 1.2-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.3-.3.6-.4.8-.4h.6c.2 0 .5 0 .7.5.2.5.8 1.9.9 2 .1.2.1.4 0 .6-.1.2-.2.4-.3.5-.1.2-.3.4-.4.5-.1.1-.2.3-.1.5.1.2.4.8 1 1.3.7.7 1.3 1 1.5 1.1.2.1.4.1.6-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.6-.2.2.1 1.5.7 1.8.9.3.2.4.2.5.4.1.2.1.9-.1 1.5Z" />
    </svg>
  );
}

export default function HomeSocialLinks() {
  const [links, setLinks] = useState<SocialLinks>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "store"));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const social = (data.socialLinks ?? {}) as SocialLinks;
        if (mounted) setLinks(social);
      } catch (e) {
        console.warn("[home-social] failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(
    () =>
      [
        { label: "Instagram", url: links.instagram, className: "social-instagram", icon: <InstagramIcon /> },
        { label: "TikTok", url: links.tiktok, className: "social-tiktok", icon: <TikTokIcon /> },
        { label: "Facebook", url: links.facebook, className: "social-facebook", icon: <FacebookIcon /> },
        { label: "WhatsApp", url: links.whatsapp, className: "social-whatsapp", icon: <WhatsAppIcon /> },
      ].filter((x) => isHttpUrl(x.url)),
    [links]
  );

  if (!items.length) return null;

  return (
    <section className="panel p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Nuestras redes</h2>
        <span className="text-xs text-slate-500">Atencion directa</span>
      </div>

      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
        {items.map((x) => (
          <a
            key={x.label}
            href={x.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`chip-link justify-center md:justify-start ${x.className}`}
          >
            {x.icon}
            <span>{x.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
