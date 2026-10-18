export type StockDirection = "ADD" | "REMOVE";
export type StockMovementReason = "RECEIPT" | "CORRECTION" | "DAMAGE" | "RETURN";

export function previewStockMovement(stock: number, quantity: string, direction: StockDirection): {
  delta: number;
  after: number;
  error: string | null;
} {
  if (!Number.isSafeInteger(stock) || stock < 0) {
    return { delta: 0, after: stock, error: "Actualiza el inventario antes de registrar este movimiento." };
  }
  const trimmed = quantity.trim();
  if (!trimmed) return { delta: 0, after: stock, error: "Indica cuántas unidades quieres mover." };
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(Number(trimmed)) || Number(trimmed) < 1 || Number(trimmed) > 100000) {
    return { delta: 0, after: stock, error: "Usa una cantidad entera entre 1 y 100 000." };
  }
  const delta = Number(trimmed) * (direction === "REMOVE" ? -1 : 1);
  if (stock + delta < 0) {
    return { delta, after: stock, error: `Solo hay ${stock} ${stock === 1 ? "unidad disponible" : "unidades disponibles"}.` };
  }
  return { delta, after: stock + delta, error: null };
}

export function inventoryErrorMessage(message: string): string {
  const messages: Record<string, string> = {
    UNAUTHENTICATED: "Tu sesión terminó. Vuelve a iniciar sesión para continuar.",
    AUTH_TOO_OLD: "Tu sesión terminó. Vuelve a iniciar sesión para continuar.",
    NOT_ADMIN: "Tu cuenta no tiene permiso para gestionar el inventario.",
    CSRF_FAILED: "Actualiza la página e intenta registrar el movimiento de nuevo.",
    PRODUCT_NOT_FOUND: "Este producto ya no existe. Actualiza el inventario.",
    VARIANT_NOT_FOUND: "Esta variante cambió. Actualiza el inventario antes de continuar.",
    PRODUCT_IN_TRASH: "Este producto está en la papelera. Restáuralo desde Productos para modificarlo.",
    INSUFFICIENT_STOCK: "El stock cambió y ya no alcanza para esta salida. Actualiza el inventario y revisa la cantidad.",
    VALIDATION_ERROR: "Revisa la cantidad y el motivo del movimiento.",
    INVALID_CURSOR: "La lista cambió. Pulsa Actualizar para volver a cargarla.",
  };
  return messages[message] ?? "No pudimos completar la operación. Inténtalo de nuevo.";
}
