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
Diagnóstico: FCP/LCP, tareas largas y tiempos CDP por tipo/host, sin URL privadas.
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
  // Discover the server-rendered link without waiting for unrelated client code.
  // The fallback also permits comparing an older, client-only catalog version.
  for (const javaScriptEnabled of [false, true]) {
    const mode = javaScriptEnabled ? "javascript-fallback" : "html";
    const context = await browser.newContext({ serviceWorkers: "block", javaScriptEnabled });
    let stage = `product-discovery-${mode}-setup`;
    try {
      await installReadOnlyGuard(context, base, []);
      const page = await context.newPage();
      stage = `product-discovery-${mode}-navigation`;
      const response = await page.goto(`${base}/catalog`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      stage = `product-discovery-${mode}-http`;
      if (!response?.ok()) throw new Error("PUBLIC_CATALOG_HTTP_STATUS");
      const link = page.locator('a[href^="/p/"]').first();
      if (!javaScriptEnabled && await link.count() === 0) continue;
      stage = `product-discovery-${mode}-link`;
      await link.waitFor({ state: "attached", timeout: 15_000 });
      const href = await link.getAttribute("href");
      stage = `product-discovery-${mode}-validation`;
      const candidate = new URL(href || "", base);
      if (candidate.origin !== base || !/^\/p\/[^/]+\/?$/.test(candidate.pathname) || candidate.search || candidate.hash) {
        throw new Error("PUBLIC_PRODUCT_LINK_INVALID");
      }
      return { path: candidate.pathname, method: mode };
    } catch (error) {
      error.measurementStage = stage;
      throw error;
    } finally {
      await context.close();
    }
  }
  throw new Error("PUBLIC_PRODUCT_NOT_FOUND");
}

function roundMs(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 10) / 10 : null;
}

function elapsedMs(end, start) {
  return Number.isFinite(end) && Number.isFinite(start) ? roundMs((end - start) * 1000) : null;
}

function phaseMs(timing, start, end) {
  return timing?.[start] >= 0 && timing?.[end] >= 0 ? roundMs(timing[end] - timing[start]) : null;
}

function responseDetails(resource, response, timestamp) {
  resource.responseAt = timestamp;
  resource.host = sourceHost(response.url);
  resource.mime = response.mimeType;
  resource.status = response.status;
  resource.cache.disk = Boolean(response.fromDiskCache);
  resource.cache.serviceWorker = Boolean(response.fromServiceWorker);
  resource.cache.prefetch = Boolean(response.fromPrefetchCache);
  const vercelCache = Object.entries(response.headers ?? {}).find(([name]) => name.toLowerCase() === "x-vercel-cache")?.[1];
  if (typeof vercelCache === "string" && /^(HIT|MISS|STALE|BYPASS|PRERENDER|REVALIDATED)$/i.test(vercelCache)) {
    resource.cache.vercel = vercelCache.toUpperCase();
  }
  const timing = response.timing;
  if (timing) {
    resource.responseHeadersAt = timing.receiveHeadersEnd >= 0 ? timing.requestTime + timing.receiveHeadersEnd / 1000 : undefined;
    resource.networkTimingMs = {
      dns: phaseMs(timing, "dnsStart", "dnsEnd"),
      connect: phaseMs(timing, "connectStart", "connectEnd"),
      ssl: phaseMs(timing, "sslStart", "sslEnd"),
      send: phaseMs(timing, "sendStart", "sendEnd"),
      waitForResponse: phaseMs(timing, "sendEnd", "receiveHeadersStart"),
      receiveHeaders: phaseMs(timing, "receiveHeadersStart", "receiveHeadersEnd"),
    };
  }
}

function networkDiagnostics(resources, snapshotAt) {
  const firstRequestAt = Math.min(...resources.map((resource) => resource.startedAt));
  const detailed = resources.map((resource, index) => ({
    index,
    host: resource.host,
    type: resource.type,
    mime: resource.mime ?? "",
    status: resource.status ?? null,
    cache: resource.cache,
    bytes: resource.bytes,
    completed: Boolean(resource.finishedAt),
    failed: Boolean(resource.failed),
    canceled: Boolean(resource.canceled),
    startMs: elapsedMs(resource.startedAt, firstRequestAt),
    responseMs: elapsedMs(resource.responseAt, firstRequestAt),
    endMs: elapsedMs(resource.finishedAt, firstRequestAt),
    ttfbMs: elapsedMs(resource.responseHeadersAt ?? resource.responseAt, resource.startedAt),
    durationMs: elapsedMs(resource.finishedAt ?? snapshotAt, resource.startedAt),
    downloadMs: elapsedMs(resource.finishedAt, resource.responseHeadersAt ?? resource.responseAt),
    networkTimingMs: resource.networkTimingMs ?? null,
  }));
  const groups = new Map();
  for (const resource of detailed) {
    const group = groups.get(resource.type) ?? { type: resource.type, requests: 0, completed: 0, pending: 0, failed: 0, bytes: 0, durationSumMs: 0, maxDurationMs: 0, ttfbSumMs: 0, ttfbSamples: 0 };
    group.requests += 1;
    group.completed += Number(resource.completed);
    group.pending += Number(!resource.completed);
    group.failed += Number(resource.failed);
    group.bytes += resource.bytes;
    group.durationSumMs += resource.durationMs ?? 0;
    group.maxDurationMs = Math.max(group.maxDurationMs, resource.durationMs ?? 0);
    if (resource.ttfbMs !== null) { group.ttfbSumMs += resource.ttfbMs; group.ttfbSamples += 1; }
    groups.set(resource.type, group);
  }
  return {
    resources: detailed,
    resourceCategorySummary: [...groups.values()].map(({ ttfbSumMs, ttfbSamples, ...group }) => ({
      ...group,
      durationSumMs: roundMs(group.durationSumMs),
      maxDurationMs: roundMs(group.maxDurationMs),
      meanTtfbMs: ttfbSamples ? roundMs(ttfbSumMs / ttfbSamples) : null,
    })),
    slowestResources: [...detailed].sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)).slice(0, 10),
  };
}

async function measure(browser, base, profile, route, run) {
  const { name, network, ...contextOptions } = profile;
  let context;
  let cdp;
  let stage = "context-setup";
  let lastNetworkTimestamp;
  const blockedRequests = [];
  const resources = new Map();
  const redirects = [];
  const errors = [];
  const result = { run, mode: name, page: route.name, blockedRequests, errors };

  try {
    context = await browser.newContext({ ...contextOptions, reducedMotion: "reduce", serviceWorkers: "block" });
    await installReadOnlyGuard(context, base, blockedRequests);
    const page = await context.newPage();
    // Error names only: browser messages can contain tokens or complete URLs.
    page.on("pageerror", (error) => errors.push({ kind: "javascript", name: error.name || "Error" }));
    cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Performance.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (network) {
      await cdp.send("Network.emulateNetworkConditions", { offline: false, ...network, connectionType: "cellular4g" });
    }
    cdp.on("Network.requestWillBeSent", ({ requestId, timestamp, type, request, redirectResponse }) => {
      lastNetworkTimestamp = timestamp;
      const previous = resources.get(requestId);
      if (redirectResponse && previous) {
        responseDetails(previous, redirectResponse, timestamp);
        previous.finishedAt = timestamp;
        previous.bytes = redirectResponse.encodedDataLength ?? 0;
        redirects.push(previous);
      }
      resources.set(requestId, {
        host: sourceHost(request.url), type: type ?? "Other", startedAt: timestamp, bytes: 0,
        cache: { browserServed: false, disk: false, serviceWorker: false, prefetch: false },
      });
    });
    cdp.on("Network.requestServedFromCache", ({ requestId }) => {
      const resource = resources.get(requestId);
      if (resource) resource.cache.browserServed = true;
    });
    cdp.on("Network.responseReceived", ({ requestId, timestamp, type, response }) => {
      lastNetworkTimestamp = timestamp;
      const resource = resources.get(requestId);
      if (resource) {
        resource.type = type;
        responseDetails(resource, response, timestamp);
      }
    });
    cdp.on("Network.dataReceived", ({ requestId, encodedDataLength }) => {
      const resource = resources.get(requestId);
      if (resource) resource.bytes += encodedDataLength;
    });
    cdp.on("Network.loadingFinished", ({ requestId, timestamp, encodedDataLength }) => {
      lastNetworkTimestamp = timestamp;
      const resource = resources.get(requestId);
      if (resource) { resource.bytes = encodedDataLength; resource.finishedAt = timestamp; }
    });
    cdp.on("Network.loadingFailed", ({ requestId, timestamp, canceled }) => {
      lastNetworkTimestamp = timestamp;
      const resource = resources.get(requestId);
      if (resource) { resource.failed = true; resource.canceled = Boolean(canceled); resource.finishedAt = timestamp; }
    });
    await page.addInitScript(() => {
      window.__oderaPerf = {
        lcp: null,
        longTasks: { supported: false, count: 0, sumMs: 0, maxMs: 0 },
      };
      if (typeof PerformanceObserver !== "undefined") {
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__oderaPerf.lcp = {
                startTime: entry.startTime,
                tag: entry.element?.tagName ?? null,
                size: entry.size,
                loadTime: entry.loadTime,
                renderTime: entry.renderTime,
              };
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch { /* The report leaves LCP null if this browser does not expose it. */ }
        if (PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
          window.__oderaPerf.longTasks.supported = true;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const tasks = window.__oderaPerf.longTasks;
              tasks.count += 1;
              tasks.sumMs += entry.duration;
              tasks.maxMs = Math.max(tasks.maxMs, entry.duration);
            }
          }).observe({ type: "longtask", buffered: true });
        }
      }
    });

    stage = "navigation";
    const response = await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    result.status = response?.status() ?? null;
    if (!response?.ok()) errors.push({ kind: "navigation", name: "HTTP_STATUS" });
    stage = "heading";
    await page.locator("h1").first().waitFor({ timeout: 15_000 });
    stage = "visible-image-decode";
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
    stage = "metrics-snapshot";
    Object.assign(result, await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const rounded = (value) => value > 0 ? Math.round(value) : null;
      const roundedZero = (value) => typeof value === "number" && value >= 0 ? Math.round(value * 10) / 10 : null;
      const lcp = window.__oderaPerf?.lcp;
      const tasks = window.__oderaPerf?.longTasks;
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
        domInteractive: rounded(navigation?.domInteractive),
        domContentLoaded: rounded(navigation?.domContentLoadedEventEnd),
        load: rounded(navigation?.loadEventEnd),
        fcp: rounded(performance.getEntriesByName("first-contentful-paint")[0]?.startTime),
        lcp: rounded(lcp?.startTime),
        lcpElement: lcp ? { tag: lcp.tag, size: lcp.size, loadTime: roundedZero(lcp.loadTime), renderTime: roundedZero(lcp.renderTime) } : null,
        longTasks: tasks ? { supported: tasks.supported, count: tasks.count, sumMs: roundedZero(tasks.sumMs), maxMs: roundedZero(tasks.maxMs) } : null,
        images,
        visibleImagesLoaded: images.filter((image) => image.visible).every((image) => image.loaded),
      };
    }));
  } catch (error) {
    errors.push({ kind: "measurement", name: error?.name || "Error", stage });
  } finally {
    let snapshotAt = lastNetworkTimestamp;
    if (cdp) {
      try {
        const { metrics } = await cdp.send("Performance.getMetrics");
        snapshotAt = metrics.find((metric) => metric.name === "Timestamp")?.value ?? snapshotAt;
      } catch { /* Keep finished request durations if the page is no longer available. */ }
    }
    Object.assign(result, networkDiagnostics([...redirects, ...resources.values()], snapshotAt));
    const imageResources = result.resources.filter((resource) => resource.type === "Image");
    result.imageBytes = imageResources.reduce((sum, resource) => sum + resource.bytes, 0);
    result.imageRequests = imageResources.length;
    if (context) await context.close();
  }
  return result;
}

async function main() {
  const config = options();
  if (config.help) return help();
  const report = {
    schemaVersion: 2,
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
      lcpScope: "Latest observed candidate at the snapshot, not a field measurement or guaranteed final LCP",
      resourceTimingScope: "CDP request/response/finish durations; pending requests use snapshot time; overlapping durations and long polling do not identify the rendering critical path by themselves",
    },
    results: [],
  };
  let browser;
  let failed = false;
  let stage = "browser-launch";
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    report.browserVersion = browser.version();
    stage = "product-discovery";
    const product = await publicProduct(browser, config.base);
    report.productDiscovery = { method: product.method };
    const routes = [{ name: "home", path: "/" }, { name: "catalog", path: "/catalog" }, { name: "product", path: product.path }];
    stage = "page-measurements";
    for (let run = 1; run <= config.runs; run += 1) {
      for (const profile of profiles) {
        for (const route of routes) {
          const result = await measure(browser, config.base, profile, route, run);
          report.results.push(result);
          if (result.errors.length || result.blockedRequests.length || result.visibleImagesLoaded === false) failed = true;
          console.log(JSON.stringify({
            label: config.label, run, mode: result.mode, page: result.page,
            ttfbMs: result.ttfb ?? null, fcpMs: result.fcp ?? null, dclMs: result.domContentLoaded ?? null, lcpMs: result.lcp ?? null,
            imageKB: Math.round(result.imageBytes / 1024), imageRequests: result.imageRequests,
            visibleImagesLoaded: result.visibleImagesLoaded ?? false,
            errors: result.errors.length, blockedWrites: result.blockedRequests.length,
          }));
        }
      }
    }
  } catch (error) {
    failed = true;
    report.error = { name: error?.name || "Error", stage: error?.measurementStage ?? stage };
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
