export type StoreTheme = "dark" | "light";

export function normalizeStoreTheme(value: unknown): StoreTheme {
  return value === "light" ? "light" : "dark";
}
