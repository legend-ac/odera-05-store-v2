import "server-only";

export function getRequestIp(req: Request): string {
  // Vercel / proxies: x-forwarded-for can be a comma separated list.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "0.0.0.0";
}

export function getUserAgent(req: Request): string {
  return req.headers.get("user-agent") ?? "unknown";
}
