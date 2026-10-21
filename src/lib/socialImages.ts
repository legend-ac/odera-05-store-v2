/** Public JPEG copies of the original artwork, sized for social previews. */
const socialImages = {
  home: {
    url: "/og-home-social.jpg",
    width: 1200,
    height: 630,
    alt: "ODERA 05 STORE — Muévete a Tu Manera. Zapatillas · Ropa · Accesorios — Lima, Perú",
    type: "image/jpeg",
  },
  catalog: {
    url: "/og-catalog-social.jpg",
    width: 1200,
    height: 630,
    alt: "Catálogo ODERA 05 STORE — Zapatillas · Ropa · Accesorios — Lima, Perú",
    type: "image/jpeg",
  },
  square: {
    url: "/og-square-social.jpg",
    width: 1200,
    height: 1200,
    alt: "ODERA 05 STORE — Zapatillas · Ropa · Accesorios — Lima, Perú",
    type: "image/jpeg",
  },
};

type SocialImage = typeof socialImages.home;

// Platforms choose their own preview layout; image order expresses preference.
export function getSocialImages(variant: "home" | "catalog" = "home", baseUrl?: URL): [SocialImage, SocialImage] {
  const resolve = (image: SocialImage): SocialImage => ({
    ...image,
    url: baseUrl ? new URL(image.url, baseUrl).href : image.url,
  });
  return [resolve(socialImages[variant]), resolve(socialImages.square)];
}
