import { trackOrderSchema, type TrackOrderInput } from "@/schemas/trackOrder";

/** Read both links issued by the shop: /t/code/token and /track?publicCode=... . */
export function parseTrackingUrl(input: string): TrackOrderInput | null {
  const value = input.trim();
  if (!value) return null;

  try {
    const url = new URL(value, "https://tracking.invalid");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;

    let publicCode = "";
    let trackingToken = "";
    const shortPath = url.pathname.match(/^\/t\/([^/]+)\/([^/]+)\/?$/);
    if (shortPath) {
      publicCode = decodeURIComponent(shortPath[1]!).trim();
      trackingToken = decodeURIComponent(shortPath[2]!).trim();
    } else if (/^\/track\/?$/.test(url.pathname)) {
      if (url.searchParams.getAll("publicCode").length !== 1 || url.searchParams.getAll("trackingToken").length !== 1) return null;
      publicCode = (url.searchParams.get("publicCode") ?? "").trim();
      trackingToken = (url.searchParams.get("trackingToken") ?? "").trim();
    } else {
      return null;
    }

    // Generated codes and base64url tokens never contain spaces or path separators.
    if (!/^[A-Za-z0-9-]+$/.test(publicCode) || !/^[A-Za-z0-9_-]+$/.test(trackingToken)) return null;
    const parsed = trackOrderSchema.safeParse({ publicCode, trackingToken });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
