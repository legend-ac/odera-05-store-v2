# ODERA 05 STORE (Next.js 14 + Firebase, CERO INVERSIÓN)

> Este repo está diseñado para correr en **Vercel Hobby/Free** y **Firebase Spark** (sin billing).
> Incluye un **modo de Storage** por feature flag porque **Cloud Storage for Firebase requiere Blaze desde 03-feb-2026**.
>
> - Default: `STORAGE_MODE=spark_public_only` (sin Firebase Storage)
> - Modo migración futura: `STORAGE_MODE=firebase_storage` (requiere Blaze + método de pago)

## Stack
- Next.js 14 (App Router) + TypeScript strict
- TailwindCSS
- Firestore + Firebase Auth (Google Sign-In) + App Check
- Route Handlers (`src/app/api/**/route.ts`) con Firebase Admin SDK (Node runtime)
- Emails: Nodemailer + Gmail SMTP (App Password)
- Cron TTL: GitHub Actions schedule (gratis, mínimo 5 min)
- Backups: GitHub Actions artifacts (gratis)

## Requisitos
- Node 18+ (recomendado Node 20)
- Firebase project en plan **Spark**
- Vercel account (nota: Hobby tiene restricciones de uso no comercial)

## Setup Firebase (pasos manuales)
1. **Auth**
   - Enable Google provider (Firebase Console → Authentication → Sign-in method).
2. **Firestore**
   - Crear Firestore en modo nativo.
   - Deploy de reglas:
     ```bash
     npm i -g firebase-tools
     firebase login
     firebase use <TU_PROJECT_ID>
     firebase deploy --only firestore:rules
     ```
3. **App Check**
   - App Check → Web app → reCAPTCHA v3 site key.
   - Activa enforcement para Firestore (y Storage solo si aplica).

## Variables de entorno (Vercel / local)
Crea `.env.local` (no comitear):

### Server (solo backend)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (pega el PEM con `\n` y el código lo convierte a saltos reales)
- `SMTP_USER`
- `SMTP_PASS` (App Password Gmail)
- `CRON_SECRET`
- `STORAGE_MODE` = `spark_public_only` (default)
- (opcional) `ADMIN_ALLOWLIST_EMAILS` = emails separados por coma
- (opcional) `ENABLE_APP_CHECK_VERIFY` = `true` para verificar App Check en endpoints críticos

### Client (NEXT_PUBLIC_*)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_CHECK_SITE_KEY`

## Correr en local
```bash
npm install
npm run dev
```

## Hacerte admin
1) Inicia sesión con Google en la web (crea usuario).
2) Corre el script (requiere las env vars server):
```bash
node --loader ts-node/esm scripts/set-admin-claim.ts <UID>
```
> Alternativa: usa `ts-node` si lo prefieres. Ajusta según tu entorno.

## Cron TTL (libre)
- GitHub Actions (`.github/workflows/ttl.yml`) llama a:
  `POST https://TU_DOMINIO.vercel.app/api/cron/release-expired`
  con header `x-cron-secret`.

## Nota sobre /dashboard
- `middleware.ts` SOLO verifica **presencia** de cookie.
- La verificación real (session cookie + claim admin) se hace en `src/app/(admin)/dashboard/layout.tsx` en runtime **nodejs**.

## Limitaciones
- Sin Blaze => no Firebase Storage (por defecto).
- Gmail SMTP tiene límites (usa correos transaccionales mínimos).
- TTL se hace por cron: es “best effort” (idempotente).
