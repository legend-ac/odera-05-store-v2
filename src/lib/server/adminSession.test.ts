import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifySessionCookie: vi.fn(),
  getServerEnv: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/server/firebaseAdmin", () => ({ adminAuth: { verifySessionCookie: mocks.verifySessionCookie } }));
vi.mock("@/lib/env", () => ({ getServerEnv: mocks.getServerEnv }));

import { requireAdminSessionOrRedirect, verifyAdminSessionCookie } from "./adminSession";

const nowSeconds = 1_800_000_000;

function verifiedAdmin(overrides: Record<string, unknown> = {}) {
  return { uid: "admin-1", email: "admin@example.test", admin: true, auth_time: nowSeconds - 60, exp: nowSeconds + 3600, ...overrides };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(nowSeconds * 1000);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.verifySessionCookie.mockResolvedValue(verifiedAdmin());
  mocks.getServerEnv.mockReturnValue({ ADMIN_ALLOWLIST_EMAILS: "" });
  mocks.cookies.mockResolvedValue({ get: (name: string) => name === "odera_session" ? { value: "signed-session" } : undefined });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
});

afterEach(() => vi.restoreAllMocks());

describe("admin session verification", () => {
  it("verifies revocation and returns the authenticated administrator", async () => {
    await expect(verifyAdminSessionCookie("signed-session")).resolves.toEqual({
      uid: "admin-1", email: "admin@example.test", authTime: nowSeconds - 60, exp: nowSeconds + 3600,
    });
    expect(mocks.verifySessionCookie).toHaveBeenCalledWith("signed-session", true);
  });

  it("accepts a session belonging to an allowlisted administrator without a claim", async () => {
    mocks.verifySessionCookie.mockResolvedValue(verifiedAdmin({ admin: false, email: "Owner@Example.test" }));
    mocks.getServerEnv.mockReturnValue({ ADMIN_ALLOWLIST_EMAILS: " , OWNER@example.test , " });

    await expect(verifyAdminSessionCookie("signed-session")).resolves.toMatchObject({ email: "Owner@Example.test" });
  });

  it("rejects a signed session without admin permissions", async () => {
    mocks.verifySessionCookie.mockResolvedValue(verifiedAdmin({ admin: false }));

    await expect(verifyAdminSessionCookie("customer-session")).rejects.toThrow("NOT_ADMIN");
  });

  it("rejects a revoked session", async () => {
    mocks.verifySessionCookie.mockRejectedValue(new Error("auth/session-cookie-revoked"));

    await expect(verifyAdminSessionCookie("revoked-session")).rejects.toThrow("auth/session-cookie-revoked");
  });

  it.each([undefined, 0, nowSeconds - 8 * 60 * 60 - 1])("requires authentication within the last eight hours: %s", async (authTime) => {
    mocks.verifySessionCookie.mockResolvedValue(verifiedAdmin({ auth_time: authTime }));

    await expect(verifyAdminSessionCookie("old-session")).rejects.toThrow("AUTH_TOO_OLD");
  });

  it("accepts the eight-hour boundary while the signed cookie remains valid", async () => {
    mocks.verifySessionCookie.mockResolvedValue(verifiedAdmin({ auth_time: nowSeconds - 8 * 60 * 60 }));

    await expect(verifyAdminSessionCookie("signed-session")).resolves.toMatchObject({ uid: "admin-1" });
  });
});

describe("admin page session guard", () => {
  it("waits for cookies and allows a verified admin session", async () => {
    await expect(requireAdminSessionOrRedirect()).resolves.toMatchObject({ uid: "admin-1" });
    expect(mocks.verifySessionCookie).toHaveBeenCalledWith("signed-session", true);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects to login without contacting Firebase when no session cookie is present", async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined });

    await expect(requireAdminSessionOrRedirect()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.verifySessionCookie).not.toHaveBeenCalled();
  });

  it("redirects to login when the session fails verification", async () => {
    mocks.verifySessionCookie.mockRejectedValue(new Error("auth/session-cookie-expired"));

    await expect(requireAdminSessionOrRedirect()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
