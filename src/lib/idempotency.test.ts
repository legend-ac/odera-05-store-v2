import { describe, expect, it } from "vitest";
import { buildIdempotencyDocId } from "./idempotency";

describe("create-order idempotency key mapping", () => {
  it("generates stable document ids for same ip+key", () => {
    const a = buildIdempotencyDocId("1.2.3.4", "same-key");
    const b = buildIdempotencyDocId("1.2.3.4", "same-key");
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("generates different ids for different keys", () => {
    const a = buildIdempotencyDocId("1.2.3.4", "k1");
    const b = buildIdempotencyDocId("1.2.3.4", "k2");
    expect(a).not.toBe(b);
  });
});
