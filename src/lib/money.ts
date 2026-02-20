export function formatPEN(amount: number): string {
  try {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);
  } catch {
    return `S/ ${amount.toFixed(2)}`;
  }
}
