import type { Transporter } from "nodemailer";

export type TransactionalMessage = { to: string; subject: string; text: string; html?: string };

function isPermanentSmtpFailure(cause: unknown): boolean {
  if (!cause || typeof cause !== "object") return false;
  const error = cause as { code?: unknown; responseCode?: unknown };
  if (typeof error.responseCode === "number") {
    // A temporary provider rejection can also carry Nodemailer's EAUTH code.
    if (error.responseCode >= 400 && error.responseCode < 500) return false;
    if (error.responseCode >= 500 && error.responseCode < 600) return true;
  }
  return error.code === "EAUTH";
}

/** Shared delivery path for the production transport and the local SMTP check. */
export async function deliverTransactionalEmail(
  message: TransactionalMessage,
  transport: Pick<Transporter, "sendMail">,
  from: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await transport.sendMail({ from, ...message });
      return { ok: true };
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : "unknown error";
      if (isPermanentSmtpFailure(cause)) break;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 350 * attempt));
    }
  }
  return { ok: false, error: lastError };
}
