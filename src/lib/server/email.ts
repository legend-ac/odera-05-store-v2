import "server-only";

import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";

type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
};

export async function sendTransactionalEmail(params: SendEmailParams): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const env = getServerEnv();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"ODERA 05 STORE" <${env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[email] send failed", msg);
    // NO bloquear el flujo por fallo SMTP.
    return { ok: false, error: msg };
  }
}
