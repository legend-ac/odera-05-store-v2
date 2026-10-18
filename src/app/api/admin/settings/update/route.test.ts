import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  assertCsrf: vi.fn(),
  verifySession: vi.fn(),
  doc: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  audit: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/server/csrf", () => ({ assertCsrfHeader: mocks.assertCsrf }));
vi.mock("@/lib/server/adminSession", () => ({ SESSION_COOKIE_NAME: "admin-session", verifyAdminSessionCookie: mocks.verifySession }));
vi.mock("@/lib/server/firebaseAdmin", () => ({
  adminDb: {
    doc: mocks.doc,
    collection: () => ({ add: mocks.audit }),
  },
}));

import { POST } from "./route";

const existingSettings = {
  storeName: "Tienda de prueba",
  publicContactEmail: "",
  publicWhatsapp: "",
  paymentInstructions: {},
};

function request(settings: object) {
  return new Request("https://example.test/api/admin/settings/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ get: (name: string) => name === "admin-session" ? { value: "valid-session" } : undefined });
  mocks.assertCsrf.mockResolvedValue(undefined);
  mocks.verifySession.mockResolvedValue({ uid: "admin-1", email: "admin@example.test" });
  mocks.doc.mockReturnValue({ get: mocks.get, set: mocks.set });
  mocks.get.mockResolvedValue({ exists: true, data: () => ({ ...existingSettings, theme: "dark", homePromo: { couponCode: "ODERA10" } }) });
  mocks.set.mockResolvedValue(undefined);
  mocks.audit.mockResolvedValue(undefined);
});

describe("POST /api/admin/settings/update appearance", () => {
  it("saves the admin-selected theme and invalidates the shared layout after saving", async () => {
    const response = await POST(request({ ...existingSettings, theme: "light" }));

    expect(response.status).toBe(200);
    expect(mocks.assertCsrf).toHaveBeenCalledOnce();
    expect(mocks.verifySession).toHaveBeenCalledWith("valid-session");
    expect(mocks.doc).toHaveBeenCalledWith("settings/store");
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ theme: "light", storeName: "Tienda de prueba" }), { merge: true });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "SETTINGS_UPDATED", after: expect.objectContaining({ theme: "light" }) }));
    expect(mocks.revalidateTag).toHaveBeenCalledWith("store-theme");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.set.mock.invocationCallOrder[0]).toBeLessThan(mocks.revalidateTag.mock.invocationCallOrder[0]!);
  });

  it("keeps a stored theme when an older settings client omits it", async () => {
    const response = await POST(request(existingSettings));

    expect(response.status).toBe(200);
    const [update, options] = mocks.set.mock.calls[0]!;
    expect(update).not.toHaveProperty("theme");
    expect(options).toEqual({ merge: true });
    expect(update.storeName).toBe(existingSettings.storeName);
  });

  it("does not change settings or cache without an admin session", async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined });
    const response = await POST(request({ ...existingSettings, theme: "light" }));

    expect(response.status).toBe(401);
    expect(mocks.verifySession).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects unsupported themes before writing or invalidating the cache", async () => {
    const response = await POST(request({ ...existingSettings, theme: "cream" }));

    expect(response.status).toBe(400);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
