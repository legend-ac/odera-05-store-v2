#!/usr/bin/env node
/**
 * scripts/backup.ts
 * Exports key Firestore collections to JSON files (GitHub Actions artifact).
 *
 * Usage:
 *   npm run backup:run
 *
 * Requires:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function tsToIso(ts: any): any {
  if (!ts) return ts;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return ts;
}

function deepConvert(obj: any): any {
  if (Array.isArray(obj)) return obj.map(deepConvert);
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[k] = deepConvert(tsToIso(v));
    return out;
  }
  return obj;
}

async function exportCollection(db: FirebaseFirestore.Firestore, colName: string): Promise<any[]> {
  const col = db.collection(colName);
  const out: any[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let q: FirebaseFirestore.Query = col.orderBy("__name__").limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      out.push({ id: d.id, ...deepConvert(d.data()) });
    }
    last = snap.docs[snap.docs.length - 1]!;
    if (snap.size < 500) break;
  }

  return out;
}

async function main() {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const db = getFirestore();
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(process.cwd(), "backup", "out", today);
  fs.mkdirSync(outDir, { recursive: true });

  const collections = ["products", "orders", "settings", "counters"] as const;

  for (const c of collections) {
    const data = await exportCollection(db, c);
    fs.writeFileSync(path.join(outDir, `${c}.json`), JSON.stringify(data, null, 2), "utf-8");
    console.log(`Exported ${c}: ${data.length} docs`);
  }

  console.log(`✅ Backup written to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
