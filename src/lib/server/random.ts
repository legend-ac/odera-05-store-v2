import "server-only";
import { randomBytes } from "crypto";

export function randomToken(lengthBytes = 16): string {
  // base64url without padding
  return randomBytes(lengthBytes).toString("base64url");
}
