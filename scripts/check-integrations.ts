import { createServer, type AddressInfo, type Socket } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import nextEnv from "@next/env";
import { deliverTransactionalEmail } from "../src/lib/server/emailDelivery";
import { createTransactionalTransport } from "../src/lib/server/email";
import { renderOrderEmail } from "../src/lib/server/emailTemplates";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const checkProviders = process.argv.includes("--providers");
const report: Record<string, unknown> = { checkedAt: new Date().toISOString(), mode: checkProviders ? "providers-and-local-smtp" : "local-smtp", ordersCreated: 0, externalEmailsSent: 0 };

function errorCode(cause: unknown): string {
  if (cause && typeof cause === "object" && "code" in cause) return String(cause.code);
  return cause instanceof Error ? cause.name : "CHECK_FAILED";
}

async function checkLocalSmtp() {
  const connections = new Set<Socket>();
  const received: string[] = [];
  const server = createServer(socket => {
    connections.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => connections.delete(socket));
    socket.write("220 local.odera.test ESMTP integration sink\r\n");
    let buffer = "";
    let dataMode = false;
    let message: string[] = [];
    socket.on("data", chunk => {
      buffer += chunk.toString("utf8");
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (dataMode) {
          if (line === ".") {
            received.push(message.join("\r\n"));
            message = [];
            dataMode = false;
            socket.write("250 2.0.0 stored locally\r\n");
          } else message.push(line.startsWith("..") ? line.slice(1) : line);
        } else if (/^(EHLO|HELO)\b/i.test(line)) socket.write("250-local.odera.test\r\n250 SIZE 1048576\r\n");
        else if (/^RCPT TO:/i.test(line)) socket.write(line.toLowerCase().includes("integration@localhost.test") ? "250 2.1.5 local recipient\r\n" : "550 only local test recipient allowed\r\n");
        else if (/^(MAIL FROM:|RSET|NOOP)/i.test(line)) socket.write("250 2.0.0 ok\r\n");
        else if (/^DATA$/i.test(line)) { dataMode = true; socket.write("354 end with a dot\r\n"); }
        else if (/^QUIT$/i.test(line)) socket.end("221 2.0.0 bye\r\n");
        else socket.write("502 unsupported test command\r\n");
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const transport = nodemailer.createTransport({host: "127.0.0.1", port: (server.address() as AddressInfo).port, secure: false, connectionTimeout: 5000, socketTimeout: 10_000});
  try {
    const html = renderOrderEmail({
      storeName: "ODERA 05 STORE", title: "Pedido de prueba de integración", publicCode: "ORDER-INTEGRATION",
      statusLabel: "Prueba local; no es un pedido", customerName: "Cliente <prueba>", customerEmail: "integration@localhost.test", customerPhone: "000000000",
      items: [{name: "Producto de prueba", qty: 1, unitPrice: "S/ 150.00", lineTotal: "S/ 150.00"}],
      subtotal: "S/ 150.00", discount: "S/ 0.00", shipping: "S/ 10.00", total: "S/ 160.00", paymentMethod: "YAPE",
      trackingUrl: "https://example.test/track", receiptUrl: "https://example.test/receipt.png",
    });
    const delivered = await deliverTransactionalEmail({to: "integration@localhost.test", subject: "ODERA Integration ORDER-INTEGRATION", text: "ORDER-INTEGRATION - no real order was created.", html}, transport, "ODERA Test <sender@localhost.test>");
    const wire = received[0] ?? "";
    if (!delivered.ok || received.length !== 1 || !wire.includes("ORDER-INTEGRATION") || !wire.includes("Content-Type: text/html") || !wire.includes("Content-Type: text/plain") || !html.includes("&lt;prueba&gt;")) throw new Error("LOCAL_SMTP_MESSAGE_INVALID");
    await writeFile("integration-results/email-preview.html", html, "utf8");
    return {ok: true, messagesReceived: received.length, textAndHtmlReceived: true, recipient: "integration@localhost.test", preview: "integration-results/email-preview.html"};
  } finally {
    transport.close();
    for (const socket of connections) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

async function verifySmtpProvider() {
  if (!process.env.SMTP_USER?.trim() || !process.env.SMTP_PASS?.trim()) return {ok: false, status: "not-configured"};
  let transport: ReturnType<typeof createTransactionalTransport> | undefined;
  try {
    transport = createTransactionalTransport();
    await transport.verify();
    return {ok: true, connectionAndAuthentication: true, inboxDelivery: "not-tested", messagesSent: 0};
  } catch (cause) { return {ok: false, status: "verification-failed", code: errorCode(cause), messagesSent: 0}; }
  finally { transport?.close(); }
}

async function checkCloudinaryUpload() {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloud || !preset) return {ok: false, status: "not-configured"};
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}`;
  const body = new FormData();
  // A generated one-pixel PNG contains no customer or order information.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw1cAAAAASUVORK5CYII=", "base64");
  body.append("file", new Blob([png], {type: "image/png"}), `integration-${randomUUID()}.png`);
  body.append("upload_preset", preset);
  body.append("folder", "admin-health/integration-checks");
  body.append("tags", "odera-integration-check");
  const result: Record<string, unknown> = {ok: false};
  let deleteToken = "";
  try {
    const response = await fetch(`${endpoint}/image/upload`, {method: "POST", body, signal: AbortSignal.timeout(20_000)});
    const uploaded = await response.json() as {public_id?: string; secure_url?: string; delete_token?: string; width?: number; height?: number};
    if (!response.ok || !uploaded.secure_url || !uploaded.public_id) return {ok: false, status: "upload-rejected", httpStatus: response.status};
    result.publicId = uploaded.public_id;
    result.uploadAccepted = true;
    deleteToken = uploaded.delete_token ?? "";
    const image = await fetch(uploaded.secure_url, {signal: AbortSignal.timeout(20_000)});
    const bytes = await image.arrayBuffer();
    result.deliveryVerified = image.ok && (image.headers.get("content-type") ?? "").startsWith("image/") && bytes.byteLength > 0;
    result.deliveredBytes = bytes.byteLength;
    result.ok = result.deliveryVerified;
  } catch (cause) { result.status = "request-failed"; result.code = errorCode(cause); }
  finally {
    if (deleteToken) {
      try {
        const deleted = await fetch(`${endpoint}/delete_by_token`, {method: "POST", body: new URLSearchParams({token: deleteToken}), signal: AbortSignal.timeout(15_000)});
        const deletion = await deleted.json() as {result?: string};
        result.cleanup = deleted.ok && deletion.result === "ok" ? "deleted" : "delete-failed";
      } catch { result.cleanup = "delete-failed"; }
    } else if (result.publicId) result.cleanup = "test-asset-retained-no-delete-token";
  }
  return result;
}

await mkdir("integration-results", {recursive: true});
try { report.localSmtp = await checkLocalSmtp(); }
catch (cause) { report.localSmtp = {ok: false, code: errorCode(cause)}; }
if (checkProviders) {
  // SMTP verify authenticates only; it never calls sendMail on the provider.
  report.smtpProvider = await verifySmtpProvider();
  report.cloudinary = await checkCloudinaryUpload();
}
await writeFile("integration-results/latest.json", JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
const checks = [report.localSmtp, ...(checkProviders ? [report.smtpProvider, report.cloudinary] : [])] as Array<{ok?: boolean}>;
if (checks.some(check => !check?.ok)) process.exitCode = 1;
