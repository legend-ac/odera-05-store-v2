import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  collection: vi.fn(),
  runTransaction: vi.fn(),
  batch: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@/lib/server/firebaseAdmin", () => ({
  adminDb: {
    collection: mocks.collection,
    runTransaction: mocks.runTransaction,
    batch: mocks.batch,
  },
}));

import { POST } from "./route";

type Ref = { id: string; path: string };
type DocumentData = Record<string, unknown>;
type Snapshot = { id: string; ref: Ref; exists: boolean; data: () => DocumentData };
type Filter = [field: string, operator: string, value: unknown];
type QueryRead = { collection: string; filters: Filter[]; limit?: number };

const nowMs = Date.UTC(2026, 9, 17, 12);
const dayMs = 24 * 60 * 60 * 1000;

function postCron(body?: string, secret: string | undefined = "test-cron-secret") {
  return POST(new Request("http://localhost/api/cron/release-expired", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === undefined ? {} : { "x-cron-secret": secret }),
    },
    ...(body === undefined ? {} : { body }),
  }));
}

function installFirestore(
  documents: Record<string, DocumentData> = {},
  queryDocuments: (query: QueryRead) => string[] = () => [],
) {
  const queryReads: QueryRead[] = [];
  const references = new Map<string, Ref>();
  const operations: string[] = [];
  let generatedId = 0;

  function refFor(collection: string, id = `generated-${++generatedId}`): Ref {
    const path = `${collection}/${id}`;
    if (!references.has(path)) references.set(path, { id, path });
    return references.get(path)!;
  }

  function snapshot(path: string): Snapshot {
    const separator = path.indexOf("/");
    return {
      id: path.slice(separator + 1),
      ref: refFor(path.slice(0, separator), path.slice(separator + 1)),
      exists: Object.hasOwn(documents, path),
      data: () => documents[path]!,
    };
  }

  type Query = {
    where: (field: string, operator: string, value: unknown) => Query;
    limit: (count: number) => Query;
    get: () => Promise<{ empty: boolean; docs: Snapshot[] }>;
  };

  function queryFor(collection: string, filters: Filter[] = [], limit?: number): Query {
    return {
      where: (field, operator, value) => queryFor(collection, [...filters, [field, operator, value]], limit),
      limit: count => queryFor(collection, filters, count),
      get: async () => {
        const query = { collection, filters, limit };
        queryReads.push(query);
        const docs = queryDocuments(query).map(snapshot);
        return { empty: docs.length === 0, docs };
      },
    };
  }

  mocks.collection.mockImplementation((collection: string) => ({
    ...queryFor(collection),
    doc: (id?: string) => refFor(collection, id),
  }));

  const tx = {
    get: vi.fn(async (ref: Ref) => {
      operations.push(`read:${ref.path}`);
      return snapshot(ref.path);
    }),
    update: vi.fn((ref: Ref, _data: DocumentData) => { operations.push(`update:${ref.path}`); }),
    set: vi.fn((ref: Ref, _data: DocumentData) => { operations.push(`set:${ref.path}`); }),
  };
  const batch = {
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  mocks.batch.mockReturnValue(batch);
  mocks.runTransaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
  return { queryReads, tx, batch, refFor, operations };
}

function expectNoFirestoreAccess() {
  expect(mocks.collection).not.toHaveBeenCalled();
  expect(mocks.runTransaction).not.toHaveBeenCalled();
  expect(mocks.batch).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(nowMs);
  mocks.getServerEnv.mockReturnValue({ CRON_SECRET: "test-cron-secret" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/cron/release-expired", () => {
  it.each([undefined, "", "wrong-secret"])("rechaza credenciales %s antes de leer el cuerpo o Firestore", async secret => {
    // An invalid body must not bypass or take precedence over authentication.
    const request = new Request("http://localhost/api/cron/release-expired", {
      method: "POST",
      headers: secret === undefined ? {} : { "x-cron-secret": secret },
      body: "{invalid-json",
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN" });
    expectNoFirestoreAccess();
  });

  it.each([
    { name: "sin cuerpo", body: undefined },
    { name: "con objeto vacio", body: "{}" },
    { name: "con limpieza desactivada", body: JSON.stringify({ includeTrashCleanup: false }) },
  ])("solo consulta reservas sin ejecutar limpieza $name", async ({ body }) => {
    const { queryReads } = installFirestore();
    const response = await postCron(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      processed: 0,
      autoTrashedOldCancelled: 0,
      autoPurgedOrders: 0,
      autoPurgedProducts: 0,
      trashCleanupEnabled: false,
    });
    expect(queryReads).toEqual([{
      collection: "orders",
      filters: [["status", "==", "SCHEDULED"], ["reservedUntil", "<", Timestamp.fromMillis(nowMs)]],
      limit: 50,
    }]);
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    "{invalid-json",
    "null",
    "[]",
    "true",
    JSON.stringify({ includeTrashCleanup: "true" }),
    JSON.stringify({ includeTrashCleanup: "false" }),
    JSON.stringify({ includeTrashCleanup: 1 }),
    JSON.stringify({ includeTrashCleanup: 0 }),
    JSON.stringify({ includeTrashCleanup: null }),
    JSON.stringify({ includeTrashCleanup: [] }),
    JSON.stringify({ includeTrashCleanup: {} }),
  ])("rechaza cuerpo invalido %s antes de consultar Firestore", async body => {
    const response = await postCron(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "VALIDATION_ERROR" });
    expectNoFirestoreAccess();
  });

  it("solo activa las tres limpiezas con includeTrashCleanup booleano true", async () => {
    const now = Timestamp.fromMillis(nowMs);
    const { queryReads, batch, refFor } = installFirestore({
      "orders/old-cancelled": { status: "CANCELLED", publicCode: "OD-OLD" },
      "orders/already-trashed": { status: "CANCELLED_EXPIRED", deletedAt: Timestamp.fromMillis(nowMs - dayMs) },
      "orders/old-trash": { status: "CANCELLED", publicCode: "OD-TRASH", deletedAt: Timestamp.fromMillis(nowMs - 31 * dayMs) },
      "products/old-trash": { slug: "old-product", deletedAt: Timestamp.fromMillis(nowMs - 31 * dayMs) },
    }, query => {
      if (query.filters.some(([field, operator]) => field === "status" && operator === "in")) {
        return ["orders/old-cancelled", "orders/already-trashed"];
      }
      if (query.filters.some(([field]) => field === "deletedAt")) return [`${query.collection}/old-trash`];
      return [];
    });
    const response = await postCron(JSON.stringify({ includeTrashCleanup: true }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      processed: 0,
      autoTrashedOldCancelled: 1,
      autoPurgedOrders: 1,
      autoPurgedProducts: 1,
      trashCleanupEnabled: true,
    });
    expect(queryReads).toEqual([
      { collection: "orders", filters: [["status", "==", "SCHEDULED"], ["reservedUntil", "<", now]], limit: 50 },
      { collection: "orders", filters: [["status", "in", ["CANCELLED", "CANCELLED_EXPIRED"]], ["createdAt", "<", Timestamp.fromMillis(nowMs - 90 * dayMs)]], limit: 100 },
      { collection: "orders", filters: [["deletedAt", "<", Timestamp.fromMillis(nowMs - 30 * dayMs)]], limit: 100 },
      { collection: "products", filters: [["deletedAt", "<", Timestamp.fromMillis(nowMs - 30 * dayMs)]], limit: 100 },
    ]);
    expect(batch.update).toHaveBeenCalledExactlyOnceWith(refFor("orders", "old-cancelled"), expect.objectContaining({ deletedAt: now }));
    expect(batch.delete).toHaveBeenCalledTimes(2);
    expect(batch.delete).toHaveBeenCalledWith(refFor("orders", "old-trash"));
    expect(batch.delete).toHaveBeenCalledWith(refFor("products", "old-trash"));
    expect(batch.commit).toHaveBeenCalledTimes(3);
  });

  it("libera ambas tallas del mismo producto en una sola actualizacion y cancela la reserva vencida", async () => {
    const product = {
      status: "archived",
      autoArchivedByStock: true,
      variants: [{ id: "size-40", size: "40", stock: 0 }, { id: "size-41", size: "41", stock: 0 }],
    };
    const { tx, refFor, operations, queryReads } = installFirestore({
      "orders/expired": {
        status: "SCHEDULED",
        publicCode: "OD-EXPIRED",
        reservedUntil: Timestamp.fromMillis(nowMs - 60_000),
        itemsSnapshots: [
          { productId: "shoe", variantSnapshot: { id: "size-40" }, qty: 2 },
          { productId: "shoe", variantSnapshot: { id: "size-41" }, qty: 1 },
        ],
      },
      "products/shoe": product,
    }, () => ["orders/expired"]);
    const response = await postCron();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ processed: 1, trashCleanupEnabled: false });
    expect(queryReads).toHaveLength(1);
    expect(tx.get.mock.calls.filter(([ref]) => ref.path === "products/shoe")).toHaveLength(1);
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(tx.update).toHaveBeenCalledWith(refFor("products", "shoe"), expect.objectContaining({
      variants: [{ id: "size-40", size: "40", stock: 2 }, { id: "size-41", size: "41", stock: 1 }],
      status: "active",
      autoArchivedByStock: false,
      inventoryTotal: 3,
      inventoryState: "LOW",
    }));
    expect(tx.update).toHaveBeenCalledWith(refFor("orders", "expired"), {
      status: "CANCELLED_EXPIRED",
      updatedAt: Timestamp.fromMillis(nowMs),
    });
    expect(tx.set.mock.calls.filter(([ref]) => ref.path.startsWith("stockLogs/"))).toEqual([
      [expect.anything(), expect.objectContaining({ productId: "shoe", variantId: "size-40", delta: 2, reason: "RELEASE", orderId: "expired" })],
      [expect.anything(), expect.objectContaining({ productId: "shoe", variantId: "size-41", delta: 1, reason: "RELEASE", orderId: "expired" })],
    ]);
    expect(operations.slice(0, 2)).toEqual(["read:orders/expired", "read:products/shoe"]);
    expect(operations.slice(2).some(operation => operation.startsWith("read:"))).toBe(false);
    expect(product.variants.map(variant => variant.stock)).toEqual([0, 0]);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("conserva PAYMENT_SENT si el pago llego entre la consulta y la transaccion", async () => {
    const { tx, queryReads } = installFirestore({
      "orders/paid-while-querying": {
        status: "PAYMENT_SENT",
        reservedUntil: Timestamp.fromMillis(nowMs - 60_000),
        itemsSnapshots: [{ productId: "shoe", variantSnapshot: { id: "size-40" }, qty: 1 }],
      },
    }, () => ["orders/paid-while-querying"]);
    const response = await postCron("{}");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ processed: 0 });
    expect(queryReads).toHaveLength(1);
    expect(queryReads[0]!.filters[0]).toEqual(["status", "==", "SCHEDULED"]);
    expect(tx.get).toHaveBeenCalledTimes(1);
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
