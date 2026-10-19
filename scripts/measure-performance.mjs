import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, devices } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const profiles = [
  { name: "desktop", viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 },
  {
    name: "mobile-4g",
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["Pixel 5"].userAgent,
    network: { latency: 80, downloadThroughput: 1_250_000, uploadThroughput: 625_000 },
  },
];

function options() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        url: { type: "string" },
        label: { type: "string", default: "current" },
        runs: { type: "string", default: "1" },
        help: { type: "boolean", short: "h" },
      },
    }));
  } catch {
    throw new Error("Argumentos inválidos. Consulta --help.");
  }
  if (values.help) return { help: true };

  let base;
  try {
    base = new URL(values.url || process.env.E2E_BASE_URL || "http://127.0.0.1:3000");
  } catch {
    throw new Error("--url debe ser una dirección HTTP o HTTPS válida.");
  }
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username || base.password || base.search || base.hash || base.pathname !== "/"
  ) {
    throw new Error("--url debe contener solo el origen de la tienda, sin credenciales, ruta ni parámetros.");
  }
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1 || runs > 3) {
    throw new Error("--runs debe ser un entero entre 1 y 3.");
  }
  const label = values.label.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 48) || "current";
  return { base: base.origin, label, runs };
}

function help() {
  console.log(`Medición pública de rendimiento, sin autenticación ni compras.

Uso: npm run measure:performance -- [--url ORIGEN] [--label NOMBRE] [--runs 1..3]

--url    E2E_BASE_URL o http://127.0.0.1:3000 por defecto.
--label  Nombre del informe; se normaliza a letras, números, guiones y guiones bajos.
--runs   Repeticiones por perfil/ruta; 1 por defecto y 3 como máximo.

Perfiles: escritorio 1366x900/DPR1 sin limitación de red;
teléfono 393x852/DPR2, descarga 10 Mbps, subida 5 Mbps y latencia CDP de 80 ms.
Rutas: inicio, catálogo y el primer producto público disponible.
Informe: integration-results/performance-NOMBRE.json.
Cada navegación usa un contexto nuevo y caché HTTP del navegador desactivada.
La caché CDN/servidor y las condiciones del equipo no se controlan.`);
}

function sourceHost(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.hostname : url.protocol;
  } catch {
    return "unknown";
  }
}

// Reading Firestore can use POST (Listen/RunQuery). Block its write endpoints,
// application mutations and external uploads without blocking those reads.
async function installReadOnlyGuard(context, base, blocked) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    let url;
    try {
      url = new URL(request.url());
    } catch {
      return route.abort("blockedbyclient");
    }
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method());
    const applicationWrite = url.origin === base && url.pathname.startsWith("/api/") && mutation;
    // `/image/upload/...` on res.cloudinary.com is image delivery, not an upload.
    const cloudinaryUpload = /(^|\.)cloudinary\.com$/i.test(url.hostname) && (
      mutation || (url.hostname === "api.cloudinary.com" && /\/(upload|destroy|delete_by_token)(?:\/|$)/i.test(url.pathname))
    );
    const firestoreWrite = url.hostname === "firestore.googleapis.com" && (
      /\/Write\/channel(?:\/|$)/i.test(url.pathname) ||
      /:(commit|batchWrite)(?:\/|$)/i.test(url.pathname) ||
      (mutation && /\/documents\//.test(url.pathname) && !url.pathname.includes(":"))
    );
    if (applicationWrite || cloudinaryUpload || firestoreWrite) {
      blocked.push({ kind: applicationWrite ? "application-write" : cloudinaryUpload ? "cloudinary-upload" : "firestore-write", method: request.method() });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
}

async function publicProduct(browser, base) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const blocked = [];
  try {
    await installReadOnlyGuard(context, base, blocked);
    const page = await context.newPage();
    const response = await page.goto(`${base}/catalog`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (!response?.ok()) throw new Error("No se pudo leer el catálogo público para seleccionar un producto.");
    const link = page.locator('a[href^="/p/"]').first();
    await link.waitFor({ state: "attached", timeout: 15_000 });
    const href = await link.getAttribute("href");
    const candidate = new URL(href || "", base);
    if (candidate.origin !== base || !/^\/p\/[^/]+\/?$/.test(candidate.pathname) || candidate.search || candidate.hash) {
      throw new Error("No se encontró una ficha pública válida en el catálogo.");
    }
    return candidate.pathname;
  } finally {
    await context.close();
  }
}

async function measure(browser, base, profile, route, run) {
  const { name, network, ...contextOptions } = profile;
  const context = await browser.newContext({ ...contextOptions, reducedMotion: "reduce", serviceWorkers: "block" });
  const blockedRequests = [];
  const resources = new Map();
  const errors = [];
  const result = { run, mode: name, page: route.name, blockedRequests, errors };

  try {
    await installReadOnlyGuard(context, base, blockedRequests);
    const page = await context.newPage();
    // Error names only: browser messages can contain tokens or complete URLs.
    page.on("pageerror", (error) => errors.push({ kind: "javascript", name: error.name || "Error" }));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (network) {
      await cdp.send("Network.emulateNetworkConditions", { offline: false, ...network, connectionType: "cellular4g" });
    }
    cdp.on("Network.responseReceived", ({ requestId, type, response }) => resources.set(requestId, {
      host: sourceHost(response.url), type, mime: response.mimeType, status: response.status, bytes: 0,
    }));
    cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
      const resource = resources.get(requestId);
      if (resource) resource.bytes = encodedDataLength;
    });
    await page.addInitScript(() => {
      window.__oderaLcp = 0;
      if (typeof PerformanceObserver !== "undefined") {
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) window.__oderaLcp = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch { /* The report leaves LCP null if this browser does not expose it. */ }
      }
    });

    const response = await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    result.status = response?.status() ?? null;
    if (!response?.ok()) errors.push({ kind: "navigation", name: "HTTP_STATUS" });
    await page.locator("h1").first().waitFor({ timeout: 15_000 });
    result.visibleImageDecode = await page.evaluate(async () => {
      const visible = [...document.images].filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
      });
      let timeout;
      const decoded = await Promise.race([
        Promise.all(visible.map((image) => image.decode().catch(() => {}))).then(() => "finished"),
        new Promise((resolve) => { timeout = setTimeout(() => resolve("timeout"), 15_000); }),
      ]);
      clearTimeout(timeout);
      return decoded;
    });
    // Gives buffered paint entries and completed network events time to arrive.
    await page.waitForTimeout(600);
    Object.assign(result, await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const rounded = (value) => value > 0 ? Math.round(value) : null;
      const images = [...document.images].map((image, index) => {
        const rect = image.getBoundingClientRect();
        let sourceHost = "unknown";
        try { sourceHost = new URL(image.currentSrc || image.src).hostname; } catch { /* No source URL is recorded. */ }
        return {
          index, sourceHost, loaded: image.complete && image.naturalWidth > 0,
          visible: rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0,
          width: Math.round(rect.width), naturalWidth: image.naturalWidth,
          loading: image.loading, priority: image.fetchPriority,
        };
      });
      return {
        ttfb: rounded(navigation?.responseStart),
        domContentLoaded: rounded(navigation?.domContentLoadedEventEnd),
        load: rounded(navigation?.loadEventEnd),
        lcp: rounded(window.__oderaLcp),
        images,
        visibleImagesLoaded: images.filter((image) => image.visible).every((image) => image.loaded),
      };
    }));
  } catch (error) {
    errors.push({ kind: "measurement", name: error?.name || "Error" });
  } finally {
    const imageResources = [...resources.values()].filter((resource) => resource.type === "Image");
    result.imageBytes = imageResources.reduce((sum, resource) => sum + resource.bytes, 0);
    result.imageRequests = imageResources.length;
    result.resources = imageResources;
    await context.close();
  }
  return result;
}

async function main() {
  const config = options();
  if (config.help) return help();
  const report = {
    measuredAt: new Date().toISOString(),
    label: config.label,
    // An origin contains no private route, user information or query string.
    origin: config.base,
    runs: config.runs,
    profiles: profiles.map(({ userAgent, ...profile }) => profile),
    conditions: {
      browser: "Google Chrome headless",
      cache: "Fresh browser context per measurement; HTTP cache disabled",
      serverAndCdnCache: "Not controlled; product discovery can warm remote caches",
      cpuThrottling: false,
      scrolling: false,
      reducedMotion: true,
      visibleImageDecodeTimeoutMs: 15_000,
      navigationTimeoutMs: 60_000,
      mutationPolicy: "Application API writes, Cloudinary uploads and Firestore write endpoints blocked; no authentication or purchase clicks",
      scope: "Initial viewport; image bytes observed up to the measurement snapshot, not a full-page download",
    },
    results: [],
  };
  let browser;
  let failed = false;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    report.browserVersion = browser.version();
    const product = await publicProduct(browser, config.base);
    const routes = [{ name: "home", path: "/" }, { name: "catalog", path: "/catalog" }, { name: "product", path: product }];
    for (let run = 1; run <= config.runs; run += 1) {
      for (const profile of profiles) {
        for (const route of routes) {
          const result = await measure(browser, config.base, profile, route, run);
          report.results.push(result);
          if (result.errors.length || result.blockedRequests.length || result.visibleImagesLoaded === false) failed = true;
          console.log(JSON.stringify({
            label: config.label, run, mode: result.mode, page: result.page,
            ttfbMs: result.ttfb ?? null, dclMs: result.domContentLoaded ?? null, lcpMs: result.lcp ?? null,
            imageKB: Math.round(result.imageBytes / 1024), imageRequests: result.imageRequests,
            visibleImagesLoaded: result.visibleImagesLoaded ?? false,
            errors: result.errors.length, blockedWrites: result.blockedRequests.length,
          }));
        }
      }
    }
  } catch (error) {
    failed = true;
    report.error = { name: error?.name || "Error", stage: browser ? "product-discovery" : "browser-launch" };
    console.error("No se pudo completar la medición. Revisa Chrome, el servidor y la disponibilidad pública del catálogo.");
  } finally {
    if (browser) await browser.close();
    const directory = join(root, "integration-results");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, `performance-${config.label}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Informe: integration-results/performance-${config.label}.json`);
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  // Only errors from our argument validation are printed; browser/network errors
  // are captured above without their potentially sensitive URL-bearing messages.
  console.error(error instanceof Error && /^(Argumentos|--url|--runs)/.test(error.message)
    ? error.message
    : "La medición no pudo guardar el informe o liberar sus recursos.");
  process.exitCode = 1;
});
