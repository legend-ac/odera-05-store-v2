import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  getServerEnv: vi.fn(),
  generateCsrfToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/firebaseAdmin", () => ({
  adminAuth: { verifyIdToken: mocks.verifyIdToken, createSessionCookie: mocks.createSessionCookie },
}));
vi.mock("@/lib/env", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@/lib/server/csrf", () => ({ generateCsrfToken: mocks.generateCsrfToken }));

import { POST } from "./route";

const idToken = "google-id-token-for-unit-tests-".repeat(3);

function loginRequest({ cookie = "odera_csrf=initial-csrf", header = "initial-csrf", token = idToken }: {
  cookie?: string | null;
  header?: string | null;
  token?: string;
} = {}) {
  return new Request("https://example.test/api/admin/session-login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie === null ? {} : { cookie }),
      ...(header === null ? {} : { "x-csrf": header }),
    },
    body: JSON.stringify({ idToken: token }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
  mocks.verifyIdToken.mockResolvedValue({ uid: "admin-1", email: "admin@example.test", admin: true, auth_time: 1_800_000_000 - 60 });
  mocks.createSessionCookie.mockResolvedValue("signed-admin-session");
  mocks.getServerEnv.mockReturnValue({ ADMIN_ALLOWLIST_EMAILS: "" });
  mocks.generateCsrfToken.mockReturnValue("rotated-csrf");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/admin/session-login", () => {
  it("exchanges a verified admin Google token for an eight-hour session", async () => {
    const response = await POST(loginRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith(idToken, true);
    expect(mocks.createSessionCookie).toHaveBeenCalledWith(idToken, { expiresIn: 8 * 60 * 60 * 1000 });
    expect(response.cookies.get("odera_session")?.value).toBe("signed-admin-session");
  });

  it("accepts an allowlisted email without an admin claim, ignoring casing and surrounding spaces", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "allowlisted-1", email: "Owner@Example.test", auth_time: 1_800_000_000 - 60 });
    mocks.getServerEnv.mockReturnValue({ ADMIN_ALLOWLIST_EMAILS: " , other@example.test, OWNER@example.test , " });

    const response = await POST(loginRequest());

    expect(response.status).toBe(200);
    expect(mocks.createSessionCookie).toHaveBeenCalledOnce();
  });

  it.each([
    { cookie: null, header: "initial-csrf" },
    { cookie: "odera_csrf=initial-csrf", header: null },
    { cookie: null, header: null },
    { cookie: "odera_csrf=initial-csrf", header: "different-csrf" },
  ])("requires matching CSRF cookie and header: %j", async ({ cookie, header }) => {
    const response = await POST(loginRequest({ cookie, header }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "CSRF_FAILED" });
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("rejects an invalid token payload before calling Firebase", async () => {
    const response = await POST(loginRequest({ token: "too-short" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "VALIDATION_ERROR" });
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("does not issue a session to an authenticated Google user without admin access", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "customer-1", email: "customer@example.test", admin: false });
    mocks.getServerEnv.mockReturnValue({ ADMIN_ALLOWLIST_EMAILS: "admin@example.test" });

    const response = await POST(loginRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "NOT_ADMIN" });
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("does not issue cookies when Firebase rejects a token", async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error("The Firebase ID token has expired"));

    const response = await POST(loginRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "SERVER_ERROR" });
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("sets a secure HTTP-only production session and rotates the readable CSRF cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(loginRequest());
    const cookies = response.headers.getSetCookie();
    const sessionCookie = cookies.find((value) => value.startsWith("odera_session="));
    const csrfCookie = cookies.find((value) => value.startsWith("odera_csrf="));

    expect(response.status).toBe(200);
    expect(cookies).toHaveLength(2);
    expect(sessionCookie).toContain("odera_session=signed-admin-session;");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("SameSite=strict");
    expect(sessionCookie).toContain("Path=/");
    expect(sessionCookie).toContain("Max-Age=28800");
    expect(csrfCookie).toContain("odera_csrf=rotated-csrf;");
    expect(csrfCookie).toContain("Secure");
    expect(csrfCookie).toContain("SameSite=strict");
    expect(csrfCookie).toContain("Path=/");
    expect(csrfCookie).toContain("Max-Age=28800");
    expect(csrfCookie).not.toContain("HttpOnly");
    expect(mocks.generateCsrfToken).toHaveBeenCalledOnce();
  });

  it.each([undefined, 0, 1_800_000_000 - 8 * 60 * 60 - 1])("rejects authentication the dashboard would reject before issuing cookies: %s", async authTime => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "admin-1", admin: true, auth_time: authTime });
    const response = await POST(loginRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTH_TOO_OLD" });
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("accepts the same eight-hour boundary as the dashboard", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "admin-1", admin: true, auth_time: 1_800_000_000 - 8 * 60 * 60 });
    const response = await POST(loginRequest());
    expect(response.status).toBe(200);
    expect(mocks.createSessionCookie).toHaveBeenCalledOnce();
  });
});
