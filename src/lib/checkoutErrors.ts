export function checkoutErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    OUT_OF_STOCK: "La cantidad solicitada ya no está disponible. Vuelve al carrito y ajusta las cantidades antes de pagar.",
    PRODUCT_NOT_FOUND: "Un producto ya no está disponible. Vuelve al carrito para retirarlo.",
    PRODUCT_INACTIVE: "Un producto ya no está a la venta. Vuelve al carrito para retirarlo.",
    VARIANT_NOT_FOUND: "La talla o el color elegidos ya no están disponibles. Vuelve al producto y elige otra opción.",
    ORDER_EXPIRED: "La reserva venció. No realices el pago; vuelve al catálogo para comprobar la disponibilidad. Si ya pagaste, contacta a la tienda con tu número de pedido.",
    ORDER_CANCELLED: "El pedido fue cancelado. No realices el pago. Si ya pagaste, contacta a la tienda con tu número de pedido.",
    ORDER_ALREADY_FINAL: "Este pedido ya fue atendido. Consulta su estado en Seguimiento.",
    PAYMENT_ALREADY_SENT: "Ya recibimos el reporte de pago de este pedido. Consulta su estado en Seguimiento.",
    OPERATION_CODE_ALREADY_USED: "Ese código de operación ya está registrado en otro pedido. Revisa tu comprobante.",
    INVALID_TRACKING_TOKEN: "El enlace del pedido no es válido. Abre el enlace completo que recibiste al reservar.",
    ORDER_NOT_FOUND: "No encontramos esa reserva. Revisa el enlace de seguimiento.",
    VALIDATION_ERROR: "Revisa los datos del formulario y vuelve a intentarlo.",
    RATE_LIMIT: "Has realizado varios intentos seguidos. Espera un minuto antes de volver a intentar.",
  };
  return messages[code.split(":")[0]!] ?? "No pudimos completar la solicitud. Vuelve a intentarlo; si ya tienes un pedido, consulta su seguimiento antes de crear otro.";
}
