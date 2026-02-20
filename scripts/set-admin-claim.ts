#!/usr/bin/env node
/**
 * scripts/set-admin-claim.ts
 * Usage:
 *   npm run admin:set-claim -- <UID>
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Missing UID. Usage: npm run admin:set-claim -- <UID>");
    process.exit(1);
  }

  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  const auth = getAuth();
  await auth.setCustomUserClaims(uid, { admin: true });

  console.log(`✅ Set admin claim for uid=${uid}`);
  console.log("NOTE: The user must sign out/in again to refresh the token.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
