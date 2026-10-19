"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const EXCLUDED_INTERACTION = "form, [role='dialog'], [role='alert'], [role='status'], [aria-live], [data-store-motion='off'], .fixed, .sticky";
const EXCLUDED_CONTENT = `${EXCLUDED_INTERACTION}, .home-hero`;
const CARD_SELECTOR = "[data-store-motion='card']";
const INTRO_SELECTOR = "[data-store-motion='intro']";

function supportsStorefrontMotion(pathname: string) {
  return pathname === "/" || pathname === "/catalog" || pathname === "/nosotros" ||
    pathname.startsWith("/p/") || pathname.startsWith("/informacion/");
}

/** Enhances already visible HTML; animation never gates rendering, loading, or input. */
export default function StorefrontMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !supportsStorefrontMotion(pathname) ||
      typeof IntersectionObserver === "undefined" || typeof Element.prototype.animate !== "function") return;

    const main = document.querySelector("main");
    if (!main) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<HTMLElement>();
    const waiting = new Set<HTMLElement>();
    const active = new Map<HTMLElement, Animation>();
    let frame = 0;
    let stopped = false;

    const reveal = (element: HTMLElement, index: number) => {
      waiting.delete(element);
      observer.unobserve(element);
      if (preference.matches || !element.isConnected || element.contains(document.activeElement)) return;

      const subtle = element.matches(INTRO_SELECTOR) || element.getBoundingClientRect().top < window.innerHeight * 0.8;
      const animation = element.animate(
        [
          { opacity: subtle ? 0.92 : 0.65, translate: `0 ${subtle ? 6 : 14}px` },
          { opacity: 1, translate: "0 0" },
        ],
        {
          duration: 550,
          delay: Math.min(index, 3) * 40,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
      active.set(element, animation);
      const forget = () => { if (active.get(element) === animation) active.delete(element); };
      animation.onfinish = forget;
      animation.oncancel = forget;
    };

    const observer = new IntersectionObserver((entries) => {
      let index = 0;
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) reveal(entry.target, index++);
      }
    }, { threshold: 0.04, rootMargin: "0px 0px 24px 0px" });

    const register = (element: HTMLElement) => {
      const intro = element.matches(INTRO_SELECTOR);
      if (seen.has(element) || element.closest(intro ? EXCLUDED_INTERACTION : EXCLUDED_CONTENT) ||
        element.querySelector(intro ? "form, h1, img" : "form, h1, img[fetchpriority='high']")) return;
      seen.add(element);
      // Content restored above the viewport must not replay when the user scrolls back up.
      if (element.getBoundingClientRect().bottom <= 0 || preference.matches) return;
      waiting.add(element);
      observer.observe(element);
    };

    const scan = () => {
      frame = 0;
      if (stopped) return;
      for (const element of waiting) {
        if (!element.isConnected) { observer.unobserve(element); waiting.delete(element); }
      }
      main.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach(register);
      main.querySelectorAll<HTMLElement>(INTRO_SELECTOR).forEach(register);

      // Keep galleries, buying controls, sticky areas, and the hero/LCP outside motion.
      if (pathname.startsWith("/p/") || pathname === "/catalog") return;
      main.querySelectorAll<HTMLElement>("section").forEach((section) => {
        if (section.closest(EXCLUDED_CONTENT) || section.querySelector("form")) return;
        if (section.querySelector(CARD_SELECTOR)) {
          // A section heading and its cards reveal separately, without nested movement.
          const heading = section.querySelector<HTMLElement>("h2");
          if (heading) register(heading);
          return;
        }
        if (!section.parentElement?.closest("section")) register(section);
      });
    };

    const mutations = new MutationObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(scan);
    });
    mutations.observe(main, { childList: true, subtree: true });

    const stopForInteraction = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      for (const [element, animation] of active) {
        if (element.contains(event.target)) animation.cancel();
      }
    };
    const updatePreference = () => {
      if (!preference.matches) return;
      observer.disconnect();
      waiting.clear();
      for (const animation of active.values()) animation.cancel();
      active.clear();
    };

    main.addEventListener("focusin", stopForInteraction);
    main.addEventListener("pointerdown", stopForInteraction, { capture: true, passive: true });
    preference.addEventListener("change", updatePreference);
    scan();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      main.removeEventListener("focusin", stopForInteraction);
      main.removeEventListener("pointerdown", stopForInteraction, true);
      preference.removeEventListener("change", updatePreference);
      for (const animation of active.values()) animation.cancel();
      active.clear();
      waiting.clear();
    };
  }, [pathname]);

  return null;
}
