import { formatPEN } from "@/lib/money";

export function buildWhatsAppMessage(params: {
  storeName: string;
  publicCode: string;
  customerName: string;
  paymentMethod: string;
  total: number;
  trackingShortUrl: string;
  items: { name: string; qty: number; lineTotal: number }[];
}) {
  const lines: string[] = [];

  lines.push(`*${params.storeName}*`);
  lines.push(`Pedido: *${params.publicCode}*`);
  lines.push("");

  lines.push(`Cliente: ${params.customerName}`);
  lines.push(`Pago: *${params.paymentMethod}*`);
  lines.push("");

  lines.push("*Productos*");
  for (const it of params.items) {
    lines.push(`- ${it.name} x${it.qty} - ${formatPEN(it.lineTotal)}`);
  }

  lines.push("");
  lines.push(`Total: *${formatPEN(params.total)}*`);
  lines.push("");
  lines.push(`Seguimiento: ${params.trackingShortUrl}`);
  lines.push("");
  lines.push("Gracias por tu compra");

  return lines.join("\n");
}

