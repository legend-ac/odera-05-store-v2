import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/server/adminSession", () => ({ CSRF_COOKIE_NAME: "odera_csrf" }));

import { assertCsrfHeader, readCsrfCookie } from "./csrf";

beforeEach(() => vi.clearAllMocks());

function cookieStore(value?: string) {
  return { get: (name: string) => name === "odera_csrf" && value ? { value } : undefined };
}

describe("asynchronous CSRF cookies", () => {
  it("waits for the request cookie store", async () => {
    mocks.cookies.mockResolvedValue(cookieStore("request-token"));
    await expect(readCsrfCookie()).resolves.toBe("request-token");
  });

  it("accepts a header matching the asynchronously read cookie", async () => {
    mocks.cookies.mockResolvedValue(cookieStore("request-token"));
    const request = new Request("https://example.test/api/admin/settings/update", { headers: { "x-csrf": "request-token" } });
    await expect(assertCsrfHeader(request)).resolves.toBeUndefined();
  });

  it.each([
    { cookie: undefined, header: undefined },
    { cookie: undefined, header: "request-token" },
    { cookie: "request-token", header: undefined },
    { cookie: "request-token", header: "different-token" },
  ])("rejects missing or mismatched CSRF values: %j", async ({ cookie, header }) => {
    mocks.cookies.mockResolvedValue(cookieStore(cookie));
    const request = new Request("https://example.test/api/admin/settings/update", { headers: header ? { "x-csrf": header } : {} });
    await expect(assertCsrfHeader(request)).rejects.toThrow("CSRF_FAILED");
  });
});
