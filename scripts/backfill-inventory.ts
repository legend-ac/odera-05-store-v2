#!/usr/bin/env node
/**
 * Builds the materialized inventory fields used by /dashboard/inventory.
 *
 * Run a preview first: npm run inventory:backfill
 * Apply after reviewing it: npm run inventory:backfill -- --apply
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";

// Next.js loads .env.local for the app, but a standalone tsx script does not.
// Load only missing values, so explicit CI environment variables still win.
function loadLocalEnv(): void {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1]!;
    if (process.env[key] !== undefined) continue;
    const raw = match[2] ?? "";
    process.env[key] = raw.replace(/^(["'])(.*)\1$/, "$2");
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function summary(variants: unknown): { inventoryTotal: number; inventoryState: "OUT" | "LOW" | "HEALTHY" } {
  const inventoryTotal = Array.isArray(variants)
    ? variants.reduce((sum, variant: any) => sum + Math.max(0, Number(variant?.stock ?? 0)), 0)
    : 0;
  return { inventoryTotal, inventoryState: inventoryTotal === 0 ? "OUT" : inventoryTotal <= 3 ? "LOW" : "HEALTHY" };
}

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const projectId = required("FIREBASE_PROJECT_ID");
  const clientEmail = required("FIREBASE_CLIENT_EMAIL");
  const privateKey = required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore(getApps()[0]!, process.env.FIRESTORE_DATABASE_ID || "(default)");
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let scanned = 0;
  let changes = 0;

  for (;;) {
    let query: FirebaseFirestore.Query = db.collection("products").orderBy("__name__").limit(400);
    if (last) query = query.startAfter(last);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = db.batch();
    let batchChanges = 0;
    for (const doc of snapshot.docs) {
      scanned += 1;
      const data = doc.data() as any;
      const next = summary(data.variants);
      if (Number(data.inventoryTotal) === next.inventoryTotal && data.inventoryState === next.inventoryState) continue;
      changes += 1;
      batchChanges += 1;
      if (apply) batch.update(doc.ref, { ...next, inventoryUpdatedAt: Timestamp.now() });
    }
    if (apply && batchChanges) await batch.commit();
    last = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < 400) break;
  }
  console.log(`${apply ? "Applied" : "Preview"}: ${changes} product(s) need inventory fields updated out of ${scanned}.`);
  if (!apply && changes) console.log("Run again with --apply to write the changes.");
}

main().catch((error) => { console.error(error); process.exit(1); });
