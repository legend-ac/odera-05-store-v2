import "server-only";

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(s: string) {
  return esc(s).replaceAll("\n", "<br>");
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
  trackingToken?: string;
  shippingSummary?: string;
  receiptUrl?: string;
}) {
  const rows = params.items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e6e8ee;">
          <div style="font-weight:700;color:#0b172a;">${esc(it.name)}</div>
          <div style="color:#5f6f86;font-size:12px;margin-top:2px;">Cantidad: ${it.qty} · Unitario: ${esc(it.unitPrice)}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e6e8ee;text-align:right;color:#0b172a;font-weight:700;">
          ${esc(it.lineTotal)}
        </td>
      </tr>
    `
    )
    .join("");

  const receiptButton = params.receiptUrl
    ? `
      <a href="${params.receiptUrl}" target="_blank"
        style="display:inline-block;background:#0b172a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;">
        Ver comprobante
      </a>`
    : "";

  const trackingToken = params.trackingToken
    ? `<div style="margin-top:8px;color:#5f6f86;font-size:13px;">Clave de seguimiento: <b style="color:#0b172a;">${esc(params.trackingToken)}</b></div>`
    : "";

  const shippingSummary = params.shippingSummary
    ? `<div style="margin-top:8px;color:#5f6f86;font-size:13px;line-height:1.45;">Envio:<br><b style="color:#0b172a;">${nl2br(params.shippingSummary)}</b></div>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(params.title)}</title>
</head>
<body style="margin:0;background:#eef3fa;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:22px 14px;">
    <div style="background:linear-gradient(135deg,#1f4d1f,#2f6f31);border-radius:18px;padding:18px 18px 16px;color:#fff;box-shadow:0 12px 28px rgba(19,43,24,.35);">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;">Confirmacion de pedido</div>
      <div style="font-size:26px;font-weight:900;margin-top:5px;">${esc(params.storeName)}</div>
      <div style="margin-top:4px;font-size:13px;opacity:.92;">Pedido ${esc(params.publicCode)} · ${esc(params.statusLabel)}</div>
    </div>

    <div style="background:#fff;border:1px solid #dbe3ef;border-radius:18px;padding:18px;margin-top:14px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <span style="display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;">
          Estado: ${esc(params.statusLabel)}
        </span>
        <span style="display:inline-block;background:#ecfdf3;border:1px solid #bbf7d0;color:#166534;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;">
          Metodo: ${esc(params.paymentMethod)}
        </span>
      </div>

      <div style="margin-top:14px;">
        <a href="${params.trackingUrl}" target="_blank"
          style="display:inline-block;background:#0b172a;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:800;">
          Ver seguimiento
        </a>
      </div>

      ${trackingToken}
      ${shippingSummary}

      <div style="margin-top:18px;">
        <div style="font-weight:800;color:#0b172a;margin-bottom:8px;">Resumen de productos</div>
        <table style="width:100%;border-collapse:collapse;">
          ${rows}
        </table>

        <table style="width:100%;margin-top:12px;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:4px 0;color:#5f6f86;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#0b172a;">${esc(params.subtotal)}</td></tr>
          <tr><td style="padding:4px 0;color:#5f6f86;">Descuento</td><td style="padding:4px 0;text-align:right;color:#0b172a;">${esc(params.discount)}</td></tr>
          <tr><td style="padding:4px 0;color:#5f6f86;">Envio</td><td style="padding:4px 0;text-align:right;color:#0b172a;">${esc(params.shipping)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:900;color:#0b172a;">Total</td><td style="padding:8px 0;text-align:right;font-weight:900;color:#0b172a;">${esc(params.total)}</td></tr>
        </table>

        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
          ${receiptButton}
        </div>
      </div>
    </div>

    <div style="margin-top:12px;background:#fff;border:1px solid #dbe3ef;border-radius:14px;padding:12px 14px;color:#5f6f86;font-size:12px;line-height:1.45;">
      Cliente: <b style="color:#0b172a;">${esc(params.customerName)}</b> · ${esc(params.customerEmail)} · ${esc(params.customerPhone)}
    </div>

    <div style="margin-top:12px;color:#8a99ad;font-size:12px;text-align:center;">
      &copy; ${new Date().getFullYear()} ${esc(params.storeName)}. Todos los derechos reservados.
    </div>
  </div>
</body>
</html>`;
}

