import { describe, expect, it } from "vitest";
import { adminLoginDestination, adminLoginErrorMessage } from "./adminLogin";

describe("destino después del acceso de administrador", () => {
  it("conserva el enlace a los ajustes y sus parámetros", () => {
    expect(adminLoginDestination("/dashboard/settings?tab=store#appearance")).toBe("/dashboard/settings?tab=store#appearance");
  });

  it.each([null, "", "/login", "/catalog", "https://example.com/dashboard", "//example.com/dashboard", "/\\example.com/dashboard", "/dashboard/../login", "/dashboard/%2e%2e/login", "javascript:alert(1)"])("evita destinos externos o volver al login: %s", value => {
    expect(adminLoginDestination(value)).toBe("/dashboard");
  });
});

describe("errores visibles del acceso", () => {
  it("traduce errores de la API que llegan como Error.message", () => {
    expect(adminLoginErrorMessage(new Error("NOT_ADMIN"))).toContain("no tiene permisos");
    expect(adminLoginErrorMessage(new Error("CSRF_FAILED"))).toContain("Recarga la página");
    expect(adminLoginErrorMessage(new Error("AUTH_TOO_OLD"))).toContain("venció");
  });

  it("explica el bloqueo o cancelación de la ventana sin iniciar otra redirección", () => {
    expect(adminLoginErrorMessage({ code: "auth/popup-blocked" })).toContain("Permite las ventanas emergentes");
    expect(adminLoginErrorMessage({ code: "auth/popup-closed-by-user" })).toContain("canceló");
  });

  it("no expone detalles internos de errores desconocidos", () => {
    expect(adminLoginErrorMessage(new Error("internal secret details"))).not.toContain("internal secret details");
  });
});
