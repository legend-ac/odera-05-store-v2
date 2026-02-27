import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("randomToken", () => {
  it("creates non-empty token", async () => {
    const { randomToken } = await import("./random");
    const token = randomToken(16);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
  });

  it("creates different tokens across calls", async () => {
    const { randomToken } = await import("./random");
    const a = randomToken(12);
    const b = randomToken(12);
    expect(a).not.toBe(b);
  });
});
