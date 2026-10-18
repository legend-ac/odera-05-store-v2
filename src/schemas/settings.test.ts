import { describe, expect, it } from "vitest";
import { storeSettingsSchema } from "./settings";
import { normalizeStoreInformation } from "@/lib/storeInformation";

const existingSettings = {
  storeName: "Tienda de prueba",
  publicContactEmail: "",
  publicWhatsapp: "",
  paymentInstructions: {},
};

describe("store appearance settings", () => {
  it("preserves compatibility with settings saved before the theme selector", () => {
    expect(storeSettingsSchema.parse(existingSettings)).not.toHaveProperty("theme");
  });

  it.each(["dark", "light"] as const)("accepts the %s version without changing other settings", (theme) => {
    const parsed = storeSettingsSchema.parse({
      ...existingSettings,
      theme,
      homePromo: { couponCode: "ODERA10", freeShippingFrom: 200 },
    });
    expect(parsed.theme).toBe(theme);
    expect(parsed.storeName).toBe(existingSettings.storeName);
    expect(parsed.homePromo).toEqual({ couponCode: "ODERA10", freeShippingFrom: 200 });
  });

  it.each(["cream", "LIGHT", "", null, true, 1, {}])("rejects an unsupported theme: %j", (theme) => {
    const parsed = storeSettingsSchema.safeParse({ ...existingSettings, theme });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["theme"]);
  });
});

describe("store commercial information", () => {
  it("accepts old settings without inventing commercial values", () => {
    const parsed = storeSettingsSchema.parse(existingSettings);
    expect(parsed.businessInformation).toBeUndefined();
    expect(Object.values(normalizeStoreInformation(parsed.businessInformation))).toEqual(["", "", "", "", ""]);
  });

  it("trims confirmed information while preserving separate destination and exchange fields", () => {
    const parsed = storeSettingsSchema.parse({
      ...existingSettings,
      businessInformation: {
        storeHours: "  Horario confirmado  ",
        deliveryLima: " Plazo Lima ",
        deliveryProvinces: " Plazo provincias ",
        exchangePeriod: " Plazo cambios ",
        exchangeConditions: " Condiciones confirmadas\nSegunda línea ",
      },
    });
    expect(parsed.businessInformation).toEqual({
      storeHours: "Horario confirmado",
      deliveryLima: "Plazo Lima",
      deliveryProvinces: "Plazo provincias",
      exchangePeriod: "Plazo cambios",
      exchangeConditions: "Condiciones confirmadas\nSegunda línea",
    });
  });

  it("rejects non-text information and unbounded policy input", () => {
    expect(storeSettingsSchema.safeParse({ ...existingSettings, businessInformation: { storeHours: 123 } }).success).toBe(false);
    expect(storeSettingsSchema.safeParse({ ...existingSettings, businessInformation: { exchangeConditions: "a".repeat(2001) } }).success).toBe(false);
  });

  it("preserves category images when saving store information", () => {
    const parsed = storeSettingsSchema.parse({
      ...existingSettings,
      businessInformation: { storeHours: "" },
      productTypes: [{ key: "ropa", label: "Ropa", imageUrl: "https://res.cloudinary.com/test/image/upload/ropa.webp" }],
    });
    expect(parsed.productTypes?.[0]?.imageUrl).toBe("https://res.cloudinary.com/test/image/upload/ropa.webp");
  });

  it("ignores malformed stored values instead of displaying invented promises", () => {
    expect(normalizeStoreInformation({ storeHours: false, deliveryLima: 3, deliveryProvinces: "  ", exchangePeriod: null, exchangeConditions: {} }))
      .toEqual(normalizeStoreInformation(undefined));
    expect(normalizeStoreInformation({ storeHours: "  Texto confirmado  " }).storeHours).toBe("Texto confirmado");
  });
});
