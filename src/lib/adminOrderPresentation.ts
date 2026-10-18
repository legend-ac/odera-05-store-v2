import { isExpirableStatus } from "@/lib/orderStatus";

/** Payment receipts remain reserved until an administrator validates them. */
export function orderReservationNotice(
  order: { status: string; reservedUntilMs: number | null },
  now = Date.now(),
): string | null {
  if (!isExpirableStatus(order.status) || !order.reservedUntilMs) return null;
  const remaining = Math.ceil((order.reservedUntilMs - now) / 60_000);
  if (remaining <= 0) return "Reserva vencida";
  if (remaining <= 15) return `Reserva vence en ${remaining} min`;
  return null;
}
