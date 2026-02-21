import "server-only";

import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";

type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await transporter.sendMail({
          from: `"ODERA 05 STORE" <${env.SMTP_USER}>`,
          to: params.to,
          subject: params.subject,
          text: params.text,
          html: params.html,
        });
        return { ok: true };
      } catch (e) {
        lastError = e instanceof Error ? e.message : "unknown error";
        if (attempt < 3) await wait(350 * attempt);
      }
    }

    console.error("[email] send failed after retries", lastError);
    return { ok: false, error: lastError };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[email] send failed", msg);
    // NO bloquear el flujo por fallo SMTP.
    return { ok: false, error: msg };
  }
}
