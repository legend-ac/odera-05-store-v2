import { formatPEN } from "@/lib/money";

export function buildWhatsAppMessage(params: {
  storeName: string;
  publicCode: string;
  customerName: string;
  customerPhone?: string;
  paymentMethod: string;
  total: number;
  trackingShortUrl: string;
  trackingToken?: string;
  shippingSummary?: string;
  items: { name: string; qty: number; lineTotal: number }[];
}) {
  const lines: string[] = [];

  lines.push(`*${params.storeName}*`);
  lines.push(`Pedido: *${params.publicCode}*`);
  lines.push("");

  lines.push(`Cliente: ${params.customerName}`);
  if (params.customerPhone) {
    lines.push(`Telefono: ${params.customerPhone}`);
  }
  lines.push(`Metodo de pago: *${params.paymentMethod}*`);
  if (params.shippingSummary) {
    lines.push(`Envio: ${params.shippingSummary}`);
  }
  lines.push("");

  lines.push("*Productos*");
  for (const it of params.items) {
    lines.push(`- ${it.name} x${it.qty} - ${formatPEN(it.lineTotal)}`);
  }

  lines.push("");
  lines.push(`Total: *${formatPEN(params.total)}*`);
  if (params.trackingToken) {
    lines.push(`Clave de seguimiento: ${params.trackingToken}`);
  }
  lines.push("");
  lines.push(`Seguimiento: ${params.trackingShortUrl}`);
  lines.push("");
  lines.push("Adjunto mi comprobante");

  return lines.join("\n");
}

