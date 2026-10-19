import type { ImageLoaderProps } from "next/image";

const UPLOAD_PATH = "/image/upload/";
const DELIVERY_TRANSFORM = /^f_auto,q_auto:eco,c_limit,w_\d+$/;
const TRANSFORM_PARAMETER = /^(?:a|ar|b|bo|c|co|cs|d|dn|dpr|e|f|fl|g|h|l|o|pg|q|r|t|u|w|x|y|z)_[^/]+$/;

function cloudinaryUpload(src: string): URL | null {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password || url.port || !url.pathname.includes(UPLOAD_PATH)) return null;
    // Signed transformations cannot be changed without the private signing key.
    const delivery = url.pathname.split(UPLOAD_PATH)[1] ?? "";
    if (/(?:^|\/)s--[^/]+--(?:\/|$)/.test(delivery) || url.searchParams.has("__cld_token__")) return null;
    return url;
  } catch {
    return null;
  }
}

export function optimizedProductImage(src: string | undefined, width = 900): string {
  if (!src) return "";
  const url = cloudinaryUpload(src);
  if (!url) return src;

  const safeWidth = Math.max(32, Math.min(1800, Math.round(Number.isFinite(width) ? width : 900)));
  const [prefix, path = ""] = url.pathname.split(UPLOAD_PATH);
  const remaining = path.split("/");
  const transforms: string[] = [];
  while (remaining.length > 1 && remaining[0]!.split(",").every((parameter) => TRANSFORM_PARAMETER.test(parameter))) {
    transforms.push(remaining.shift()!);
  }
  // Keep crops, effects and named transformations; replace only our own final
  // delivery step so resizing an already optimized URL remains idempotent.
  if (DELIVERY_TRANSFORM.test(transforms[transforms.length - 1] ?? "")) transforms.pop();
  transforms.push(`f_auto,q_auto:eco,c_limit,w_${safeWidth}`);
  return `${url.origin}${prefix}${UPLOAD_PATH}${[...transforms, ...remaining].join("/")}${url.search}${url.hash}`;
}

export function cloudinaryImageLoader({ src, width }: ImageLoaderProps): string {
  return optimizedProductImage(src, width);
}

// Let next/image produce width candidates while Cloudinary performs delivery
// directly. Other sources keep their previous direct-loading behavior, including
// signed URLs, data previews and hosts that Next's optimizer does not allow.
export function productImageDelivery(src: string, fallbackWidth = 900) {
  if (cloudinaryUpload(src)) return { src, loader: cloudinaryImageLoader, unoptimized: false };
  return { src: optimizedProductImage(src, fallbackWidth), unoptimized: true };
}
