export type StoreBusinessInformation = {
  storeHours: string;
  deliveryLima: string;
  deliveryProvinces: string;
  exchangePeriod: string;
  exchangeConditions: string;
};

/** Old settings documents can omit this block. Never invent commercial promises. */
export function normalizeStoreInformation(value: unknown): StoreBusinessInformation {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: keyof StoreBusinessInformation) => typeof source[key] === "string" ? source[key].trim() : "";
  return {
    storeHours: text("storeHours"),
    deliveryLima: text("deliveryLima"),
    deliveryProvinces: text("deliveryProvinces"),
    exchangePeriod: text("exchangePeriod"),
    exchangeConditions: text("exchangeConditions"),
  };
}
