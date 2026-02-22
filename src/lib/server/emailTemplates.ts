import "server-only";

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderOrderEmail(params: {
  storeName: string;
  title: string;
  publicCode: string;
  statusLabel: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: { name: string; qty: number; unitPrice: string; lineTotal: string }[];
  subtotal: string;
  discount: string;
  shipping: string;
  total: string;
  paymentMethod: string;
  trackingUrl: string;
  receiptUrl?: string;
}) {
  const rows = params.items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e6e8ee;">
          <div style="font-weight:600;color:#0b0f19;">${esc(it.name)}</div>
          <div style="color:#6b7280;font-size:12px;">Cantidad: ${it.qty} - Unitario: ${esc(it.unitPrice)}</div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e6e8ee;text-align:right;color:#0b0f19;">
          ${esc(it.lineTotal)}
        </td>
      </tr>
    `
    )
    .join("");

  const receiptButton = params.receiptUrl
    ? `
    <a href="${params.receiptUrl}" target="_blank"
      style="display:inline-block;background:#0b0f19;color:#fff;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;">
      Ver comprobante
    </a>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(params.title)}</title>
</head>
<body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="padding:14px 0;font-weight:900;letter-spacing:.5px;color:#0b0f19;">
      ${esc(params.storeName)}
    </div>

    <div style="background:#fff;border:1px solid #e6e8ee;border-radius:18px;padding:18px;">
      <div style="font-size:18px;font-weight:900;color:#0b0f19;margin-bottom:6px;">
        Pedido ${esc(params.publicCode)}
      </div>
      <div style="color:#6b7280;font-size:13px;margin-bottom:14px;">
        Estado: <b style="color:#0b0f19;">${esc(params.statusLabel)}</b>
      </div>

      <div style="margin:14px 0;">
        <a href="${params.trackingUrl}" target="_blank"
          style="display:inline-block;background:#0b0f19;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:800;">
          Ver seguimiento
        </a>
      </div>

      <div style="margin-top:18px;">
        <div style="font-weight:800;color:#0b0f19;margin-bottom:8px;">Resumen</div>
        <table style="width:100%;border-collapse:collapse;">
          ${rows}
        </table>

        <table style="width:100%;margin-top:12px;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:4px 0;color:#6b7280;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#0b0f19;">${esc(params.subtotal)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Descuento</td><td style="padding:4px 0;text-align:right;color:#0b0f19;">${esc(params.discount)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Envio</td><td style="padding:4px 0;text-align:right;color:#0b0f19;">${esc(params.shipping)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:900;color:#0b0f19;">Total</td><td style="padding:8px 0;text-align:right;font-weight:900;color:#0b0f19;">${esc(params.total)}</td></tr>
        </table>

        <div style="margin-top:14px;color:#6b7280;font-size:13px;">
          Pago: <b style="color:#0b0f19;">${esc(params.paymentMethod)}</b>
        </div>

        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
          ${receiptButton}
        </div>

        <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e6e8ee;color:#6b7280;font-size:12px;">
          Cliente: ${esc(params.customerName)} - ${esc(params.customerEmail)} - ${esc(params.customerPhone)}
        </div>
      </div>
    </div>

    <div style="margin-top:14px;color:#9aa1af;font-size:12px;text-align:center;">
      &copy; ${new Date().getFullYear()} ${esc(params.storeName)}. Todos los derechos reservados.
    </div>
  </div>
</body>
</html>`;
}
