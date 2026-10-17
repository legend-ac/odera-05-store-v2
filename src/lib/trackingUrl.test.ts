import { describe, expect, it } from "vitest";
import { parseTrackingUrl } from "./trackingUrl";

const expected = { publicCode: "OD-0001", trackingToken: "secret_123-Abc" };

describe("tracking link parsing", () => {
  it.each([
    "https://odera.example/t/OD-0001/secret_123-Abc",
    " /t/OD-0001/secret_123-Abc/ ",
    "https://odera.example/t/OD%2D0001/secret_123%2DAbc?utm_source=whatsapp#pedido",
  ])("accepts the shop's short link: %s", (url) => {
    expect(parseTrackingUrl(url)).toEqual(expected);
  });

  it.each([
    "https://odera.example/track?publicCode=OD-0001&trackingToken=secret_123-Abc",
    "/track/?trackingToken=secret_123-Abc&publicCode=OD-0001",
    "https://odera.example/track?publicCode=OD%2D0001&trackingToken=secret_123%2DAbc&utm_source=email",
  ])("keeps accepting the original query link: %s", (url) => {
    expect(parseTrackingUrl(url)).toEqual(expected);
  });

  it.each([
    "", "not a link", "https://[invalid",
    "javascript:alert(1)",
    "https://odera.example/track?publicCode=OD-0001",
    "/track?publicCode=OD-0001&trackingToken=short",
    "/track?publicCode=OD-0001&publicCode=OD-0002&trackingToken=secret_123-Abc",
    "/t/OD-0001/", "/t/OD-0001/secret_123-Abc/extra",
    "/t/OD-0001/secret%ZZ123", "/t/OD-0001/secret%2F123",
    "/elsewhere?publicCode=OD-0001&trackingToken=secret_123-Abc",
  ])("rejects incomplete, ambiguous or malformed links: %s", (url) => {
    expect(parseTrackingUrl(url)).toBeNull();
  });
});
