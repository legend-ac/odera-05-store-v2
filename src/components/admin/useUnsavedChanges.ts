"use client";

import { useEffect } from "react";

/** Protect both browser exits and client-side links in the admin workspace. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    let leaving = false;
    let reset: ReturnType<typeof setTimeout> | undefined;
    const confirmLeave = () => {
      if (!window.confirm("Tienes cambios sin guardar. ¿Quieres salir y descartarlos?")) return false;
      leaving = true;
      reset = setTimeout(() => { leaving = false; }, 1000);
      return true;
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving) return;
      event.preventDefault(); event.returnValue = "";
    };
    const followLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.pathname === location.pathname && url.search === location.search && url.origin === location.origin) return;
      if (!confirmLeave()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const beforeLeave = (event: Event) => { if (!confirmLeave()) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    window.addEventListener("odera:before-admin-leave", beforeLeave);
    return () => {
      clearTimeout(reset);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
      window.removeEventListener("odera:before-admin-leave", beforeLeave);
    };
  }, [dirty]);
}
