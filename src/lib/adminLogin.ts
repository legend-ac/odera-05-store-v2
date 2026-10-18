export function adminLoginDestination(value: string | null): string {
  const fallback = "/dashboard";
  if (!value?.startsWith("/")) return fallback;
  try {
    const base = "https://odera.invalid";
    const destination = new URL(value, base);
    if (destination.origin !== base) return fallback;
    if (destination.pathname !== fallback && !destination.pathname.startsWith(`${fallback}/`)) return fallback;
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return fallback;
  }
}

export function adminLoginErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : error instanceof Error ? error.message : "";

  switch (code) {
    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes de esta página y vuelve a pulsar «Continuar con Google».";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "El acceso con Google se canceló. Vuelve a intentarlo y completa el acceso en la ventana de Google.";
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado para iniciar sesión. Revisa los dominios autorizados en Firebase Authentication.";
    case "auth/operation-not-allowed":
      return "El acceso con Google no está habilitado en Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "Esta cuenta usa otro método de inicio de sesión.";
    case "NOT_ADMIN":
      return "Esta cuenta de Google no tiene permisos de administrador. Usa la cuenta autorizada de la tienda.";
    case "CSRF_FAILED":
      return "No se pudo validar la sesión. Recarga la página e inténtalo nuevamente.";
    case "AUTH_TOO_OLD":
      return "La autenticación de Google venció. Vuelve a iniciar sesión para entrar al administrador.";
    case "auth/network-request-failed":
      return "No se pudo conectar con Google. Revisa tu conexión y vuelve a intentarlo.";
    default:
      return "No se pudo completar el acceso al administrador. Vuelve a intentarlo.";
  }
}
