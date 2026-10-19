import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), doc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (read: () => Promise<unknown>) => read }));
vi.mock("@/lib/server/firebaseAdmin", () => ({ adminDb: { doc: mocks.doc } }));

import { getStoreSocialLinks } from "./storeSocialLinks";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.doc.mockReturnValue({ get: mocks.get });
});

describe("redes públicas incluidas en el HTML", () => {
  it("entrega únicamente enlaces públicos configurados", async () => {
    mocks.get.mockResolvedValue({ data: () => ({
      socialLinks: { instagram: "https://instagram.com/odera", whatsapp: "https://wa.me/51900000000", tiktok: "javascript:alert(1)", facebook: 123, smtpPassword: "private" },
      privateKey: "private",
    }) });
    expect(await getStoreSocialLinks()).toEqual({ instagram: "https://instagram.com/odera", whatsapp: "https://wa.me/51900000000" });
  });

  it("mantiene disponible la tienda sin redes configuradas", async () => {
    mocks.get.mockResolvedValue({ data: () => undefined });
    expect(await getStoreSocialLinks()).toEqual({});
  });

  it("no bloquea la página si falla la lectura opcional", async () => {
    mocks.get.mockRejectedValue(new Error("Unavailable"));
    expect(await getStoreSocialLinks()).toEqual({});
  });
});
