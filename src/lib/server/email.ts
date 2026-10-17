import "server-only";

import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";
import { deliverTransactionalEmail, type TransactionalMessage } from "./emailDelivery";

export function createTransactionalTransport() {
  const env = getServerEnv();
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function sendTransactionalEmail(params: TransactionalMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const env = getServerEnv();

    const transporter = createTransactionalTransport();
    const result = await deliverTransactionalEmail(params, transporter, `"ODERA 05 STORE" <${env.SMTP_USER}>`);
    if (!result.ok) console.error("[email] send failed", result.error);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[email] send failed", msg);
    // NO bloquear el flujo por fallo SMTP.
    return { ok: false, error: msg };
  }
}
