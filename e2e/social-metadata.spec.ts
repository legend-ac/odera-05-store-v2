import { expect, test } from "@playwright/test";

const crawlers = [
  "WhatsApp/2.24.0",
  "facebookexternalhit/1.1",
  "Twitterbot/1.0",
  "LinkedInBot/1.0",
  "TelegramBot (like TwitterBot)",
  "Discordbot/2.0",
];

for (const [path, primaryImage] of [["/", "og-home-social.jpg"], ["/catalog", "og-catalog-social.jpg"]] as const) {
  test(`${path} delivers social previews in the HTML head without JavaScript`, async ({ request }) => {
    for (const userAgent of crawlers) {
      const response = await request.get(path, { headers: { "User-Agent": userAgent } });
      expect(response.ok(), userAgent).toBeTruthy();
      const head = (await response.text()).split("</head>")[0] ?? "";
      const images = [...head.matchAll(/<meta property="og:image" content="([^"]+)"/g)].map((match) => match[1]!);
      expect(images, userAgent).toHaveLength(2);
      expect(new URL(images[0]!).pathname, userAgent).toBe(`/${primaryImage}`);
      expect(new URL(images[1]!).pathname, userAgent).toBe("/og-square-social.jpg");
      for (const image of images) {
        expect(new URL(image).protocol, userAgent).toMatch(/^https?:$/);
      }
      expect(head, userAgent).toContain('<meta name="twitter:card" content="summary_large_image"');
      expect(head, userAgent).toContain(`<meta name="twitter:image" content="${images[0]}"`);
      expect(head, userAgent).toContain('<meta property="og:image:type" content="image/jpeg"');
      expect(head, userAgent).toContain('<meta property="og:image:width" content="1200"');
    }
  });
}

test("social images are publicly downloadable lightweight JPEGs", async ({ request }) => {
  for (const name of ["home", "catalog", "square"]) {
    const response = await request.get(`/og-${name}-social.jpg`, { headers: { "User-Agent": crawlers[0]! } });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/jpeg");
    const bytes = await response.body();
    expect(bytes.length).toBeLessThan(300_000);
    expect(bytes.subarray(0, 2).toString("hex")).toBe("ffd8");
  }
});
