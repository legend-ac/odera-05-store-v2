import { describe, expect, it, vi } from "vitest";
import { deliverTransactionalEmail } from "./emailDelivery";

describe("transactional email delivery", () => {
  const message = { to: "receiver@example.test", subject: "Pedido de prueba", text: "TEST-ORDER", html: "<p>TEST-ORDER</p>" };
  it("preserves the actual HTML and text message for the transport", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    expect(await deliverTransactionalEmail(message, {sendMail}, "sender@example.test")).toEqual({ok: true});
    expect(sendMail).toHaveBeenCalledWith({from: "sender@example.test", ...message});
  });
  it("retries a temporary SMTP failure", async () => {
    vi.useFakeTimers();
    try {
      const sendMail = vi.fn().mockRejectedValueOnce(new Error("temporary connection failure")).mockResolvedValue({});
      const result = deliverTransactionalEmail(message, {sendMail}, "sender@example.test");
      await vi.runAllTimersAsync();
      expect(await result).toEqual({ok: true});
      expect(sendMail).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it.each([
    { code: "EAUTH", responseCode: 535 },
    { code: "EAUTH", responseCode: undefined },
    { code: "EENVELOPE", responseCode: 550 },
  ])("does not retry a permanent SMTP rejection ($code/$responseCode)", async ({ code, responseCode }) => {
    const error = Object.assign(new Error("Provider rejected the message"), { code, responseCode });
    const sendMail = vi.fn().mockRejectedValue(error);
    expect(await deliverTransactionalEmail(message, { sendMail }, "sender@example.test"))
      .toEqual({ ok: false, error: "Provider rejected the message" });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
  it.each([
    { code: "EAUTH", responseCode: 454 },
    { code: "EMESSAGE", responseCode: 451 },
  ])("retries a temporary SMTP rejection ($code/$responseCode)", async ({ code, responseCode }) => {
    vi.useFakeTimers();
    try {
      const error = Object.assign(new Error("Provider temporarily unavailable"), { code, responseCode });
      const sendMail = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({});
      const result = deliverTransactionalEmail(message, { sendMail }, "sender@example.test");
      await vi.runAllTimersAsync();
      expect(await result).toEqual({ ok: true });
      expect(sendMail).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it("returns a failure after three attempts without losing the order flow", async () => {
    vi.useFakeTimers();
    try {
      const sendMail = vi.fn().mockRejectedValue(new Error("SMTP unavailable"));
      const result = deliverTransactionalEmail(message, {sendMail}, "sender@example.test");
      await vi.runAllTimersAsync();
      expect(await result).toEqual({ok: false, error: "SMTP unavailable"});
      expect(sendMail).toHaveBeenCalledTimes(3);
    } finally { vi.useRealTimers(); }
  });
});
