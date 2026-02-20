import "server-only";

import { cookies } from "next/headers";
import { randomToken } from "@/lib/server/random";
import { CSRF_COOKIE_NAME } from "@/lib/server/adminSession";

export function readCsrfCookie(): string | null {
  return cookies().get(CSRF_COOKIE_NAME)?.value ?? null;
}

export function generateCsrfToken(): string {
  return randomToken(16);
}

export function assertCsrfHeader(req: Request): void {
  const cookie = readCsrfCookie();
  const header = req.headers.get("x-csrf");
  if (!cookie || !header || cookie !== header) {
    throw new Error("CSRF_FAILED");
  }
}
