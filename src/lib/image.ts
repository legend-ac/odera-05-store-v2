export function optimizedProductImage(src: string | undefined, width = 900): string {
  if (!src) return "";
  if (!src.includes("res.cloudinary.com") || !src.includes("/upload/")) return src;
  if (src.includes("/upload/f_auto") || src.includes("/upload/q_auto")) return src;

  const safeWidth = Math.max(96, Math.min(1800, Math.round(width)));
  return src.replace("/upload/", `/upload/f_auto,q_auto:eco,c_limit,w_${safeWidth}/`);
}
