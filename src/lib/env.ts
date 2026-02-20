import { z } from "zod";

function normalizeEnvString(v: string | undefined): string | undefined {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeEnvObject<T extends Record<string, string | undefined>>(raw: T): T {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = normalizeEnvString(v);
  return out as T;
}

const serverSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIRESTORE_DATABASE_ID: z.string().min(1).default("(default)"),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  STORAGE_MODE: z.enum(["spark_public_only", "firebase_storage"]).default("spark_public_only"),
  ADMIN_ALLOWLIST_EMAILS: z.string().optional(),
  ENABLE_APP_CHECK_VERIFY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function getServerEnv(): ServerEnv {
  const raw = normalizeEnvObject({
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIRESTORE_DATABASE_ID: process.env.FIRESTORE_DATABASE_ID,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    CRON_SECRET: process.env.CRON_SECRET,
    STORAGE_MODE: process.env.STORAGE_MODE,
    ADMIN_ALLOWLIST_EMAILS: process.env.ADMIN_ALLOWLIST_EMAILS,
    ENABLE_APP_CHECK_VERIFY: process.env.ENABLE_APP_CHECK_VERIFY,
  });

  const parsed = serverSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server env: ${msg}`);
  }

  // Accept escaped newlines from local/Vercel env formats.
  const privateKey = parsed.data.FIREBASE_PRIVATE_KEY.replace(/\\r/g, "\r").replace(/\\n/g, "\n");

  return {
    ...parsed.data,
    FIREBASE_PRIVATE_KEY: privateKey,
  };
}

const publicSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_APP_CHECK_SITE_KEY: z.string().min(1),
  NEXT_PUBLIC_FIRESTORE_DATABASE_ID: z.string().min(1).default("(default)"),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function getPublicEnv(): PublicEnv {
  const raw = normalizeEnvObject({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_APP_CHECK_SITE_KEY: process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY,
    NEXT_PUBLIC_FIRESTORE_DATABASE_ID: process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  });

  const parsed = publicSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid public env: ${msg}`);
  }
  return parsed.data;
}