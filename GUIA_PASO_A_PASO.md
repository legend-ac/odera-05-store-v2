# Guía paso a paso — ODERA 05 STORE (explicado “en simple”)

Esta guía está escrita para que puedas **entender qué hace cada parte** y **qué tienes que configurar** para que la tienda funcione.

> **Idea clave:** esta tienda está diseñada para funcionar con **Firebase en plan Spark (gratis, sin tarjeta)** y **Vercel Hobby/Free**.
>
> Por la restricción “cero inversión”, **NO usamos Cloud Functions** ni Firestore TTL “managed deletes” ni Secret Manager.

---

## 1) Mapa mental (qué es qué)

Piensa en 4 servicios distintos:

1. **Tu web (Next.js)**: lo que ve el cliente (catálogo, carrito, checkout, tracking) y lo que ve el admin (dashboard).
2. **Tu API (Next.js Route Handlers)**: rutas tipo `/api/...` que corren en Vercel como “functions” (Node runtime).
3. **Firebase (Firestore + Auth + App Check)**:
   - Firestore = base de datos (productos, pedidos, etc.)
   - Auth = login con Google
   - App Check = “anti-bots” (opcional, pero recomendado)
4. **Cron + backups (GitHub Actions)**:
   - Cada 10 min: llamar a `/api/cron/release-expired` (libera reservas vencidas)
   - 1 vez por semana: exportar Firestore a JSON y guardarlo como artifact

### Flujo de compra (resumen)
- El cliente agrega productos al carrito.
- En checkout, al hacer “Crear pedido” llama a **`POST /api/create-order`**.
- Ese endpoint hace una **transacción en Firestore**:
  - valida stock real
  - descuenta stock
  - crea pedido con `publicCode` y `trackingToken`
  - fija `reservedUntil = ahora + 20 min`
- Si el cliente no paga, un cron (GitHub Actions) cancela y devuelve stock.

### ¿Por qué no se hace todo desde el frontend?
Porque:
- **El frontend se puede manipular** (cambiar precios, cantidades, etc.).
- La única forma confiable de reservar stock es con **transacciones server-side**.

---

## 2) Restricción importante: imágenes / Storage

Por “cero inversión” este proyecto está en modo:

- `STORAGE_MODE=spark_public_only` (DEFAULT)

Eso significa:
- **No subimos archivos a Firebase Storage**.
- Las imágenes de productos deben ser:
  1) una **URL externa** (ej. un hosting de imágenes), o
  2) un archivo en tu repo dentro de `public/` (ej. `public/products/zapatilla.webp`)

> Si en el futuro activaras Blaze, existe un modo de migración (`STORAGE_MODE=firebase_storage`), pero NO es el modo actual.

---

## 3) Carpeta / estructura del proyecto (qué tocar y qué no)

Lo más importante:

- `src/app/(public)/...` → páginas públicas
- `src/app/(admin)/...` → páginas del dashboard
- `src/app/api/.../route.ts` → endpoints del backend (server)
- `src/lib/firebase/*` → Firebase SDK (cliente)
- `src/lib/server/*` → utilidades solo server (Admin SDK, email, rate limit)
- `firestore.rules` + `firestore.indexes.json` → reglas e índices
- `.github/workflows/*` → cron TTL + backups

### Rutas públicas
- `/` home
- `/catalog` catálogo + búsqueda simple
- `/p/[slug]` producto
- `/cart` carrito
- `/checkout` crea pedido (llama API)
- `/confirm` muestra `publicCode` + `trackingToken` + instrucciones de pago
- `/track` tracking + reportar pago (llama API)

### Rutas admin
- `/login` login admin con Google (crea session cookie)
- `/dashboard` dashboard
- `/dashboard/orders` pedidos
- `/dashboard/products` productos
- `/dashboard/settings` ajustes

---

## 4) Firestore (qué se guarda y por qué)

### Colección products
Documento: `products/{slug}`
- Guarda datos del producto y variantes con stock.
- El `docId` ES el `slug` (ej. `products/zapatilla-nike-air`).

### Colección orders
Documento: `orders/{autoId}`
- Tiene `publicCode` (OD-0001, OD-0002, …)
- Tiene `trackingToken` (secreto del cliente, evita enumeración)
- Tiene `reservedUntil` (reserva de stock)
- Tiene `itemsSnapshots` con info “congelada” del producto al momento de comprar.

### Colección counters/orders
Documento: `counters/orders`
- Tiene `seq` para generar el `publicCode` correlativo.

### Colección paymentOps
Documento: `paymentOps/{operationCode}`
- Evita que el mismo código de operación se use en 2 pedidos.

### Colecciones auditLogs / stockLogs
- Guardan “qué pasó” para auditoría.
- En Spark (gratis) hay cuotas: si necesitas reducir costo, se puede bajar el nivel de logging.

---

## 5) Reglas de Firestore (por qué algunas cosas “no se pueden” desde el cliente)

- **Productos**: lectura pública solo `status == active`. Escritura solo admin.
- **Pedidos**: el cliente NO puede leer ni escribir pedidos por Firestore directo.
  - Tracking se hace por **API** con `publicCode + trackingToken`.
- **Logs/contadores/pagos**: bloqueados desde cliente.

> OJO: el **Admin SDK** (server) puede leer/escribir todo y **no respeta rules**. Por eso protegemos la API.

---

## 6) Setup paso a paso (lo mínimo para que funcione)

### Paso A — Crear Firebase Project
1) En Firebase Console: crea un proyecto.
2) **NO actives Billing** (Spark).

### Paso B — Firestore
1) Crea Firestore en modo nativo.
2) Deploy de reglas e índices desde tu PC:

```bash
npm i -g firebase-tools
firebase login
firebase use <TU_PROJECT_ID>
firebase deploy --only firestore:rules,firestore:indexes
```

Si te aparece error de índice en `/catalog`, normalmente es porque falta deploy de indexes.

### Paso C — Authentication
1) Firebase Console → Authentication → Sign-in method
2) Activa **Google**.

### Paso D — App Check
1) Firebase Console → App Check → registra tu “Web app”.
2) Crea reCAPTCHA v3 site key y copia el **site key**.
3) Coloca ese site key en `NEXT_PUBLIC_APP_CHECK_SITE_KEY`.

> Recomendación: activa enforcement de App Check para Firestore cuando ya te esté funcionando local.

### Paso E — Service Account (para Admin SDK en el backend)
Necesitas estas 3 env vars del JSON de service account:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

En Vercel, normalmente debes pegar la private key con `\n` (la app la convierte a saltos reales).

### Paso F — Gmail SMTP
1) Activa 2FA en tu cuenta Gmail.
2) Genera un **App Password**.
3) Usa:
- `SMTP_USER = tu@gmail.com`
- `SMTP_PASS = app_password`

> Importante: si Gmail bloquea envíos, el pedido igual se crea (email “best effort”).

### Paso G — Variables de entorno
Crea `.env.local` copiando `.env.example`.

- Server:
  - FIREBASE_PROJECT_ID
  - FIREBASE_CLIENT_EMAIL
  - FIREBASE_PRIVATE_KEY
  - SMTP_USER
  - SMTP_PASS
  - CRON_SECRET
  - STORAGE_MODE=spark_public_only

- Client:
  - NEXT_PUBLIC_FIREBASE_API_KEY
  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID
  - NEXT_PUBLIC_FIREBASE_APP_ID
  - NEXT_PUBLIC_APP_CHECK_SITE_KEY

### Paso H — Correr local
```bash
npm install
npm run dev
```

---

## 7) Hacerte admin (para entrar al dashboard)

1) Abre `http://localhost:3000/login`.
2) Inicia sesión con Google.
3) Ve a Firebase Console → Authentication → Users y copia tu **UID**.
4) En tu terminal (con env vars server cargadas) corre:

```bash
npm run admin:set-claim -- <TU_UID>
```

5) Haz **logout/login** en la web para refrescar el token.

> Alternativa sin claims: usar `ADMIN_ALLOWLIST_EMAILS` con tu email.

---

## 8) Crear tu primer producto

1) Entra a `/dashboard/products`.
2) Click “Nuevo”.
3) Llena:
- slug (ej. `zapatilla-nike-air`)
- status: `active`
- name, description, brand, category
- price
- variants: por lo menos `{ id: "default", stock: 10 }`

### Imágenes en modo Spark
En el editor:
- Selecciona una imagen.
- El panel la convierte a **WebP** y abre una pestaña para descargar.
- Debes:
  1) descargar el .webp
  2) ponerlo en tu repo: `public/products/archivo.webp`
  3) hacer commit/push y redeploy
  4) usar URL `/products/archivo.webp`

---

## 9) Probar un pedido de punta a punta

1) Abre `/catalog`.
2) Entra a un producto.
3) Agrega al carrito.
4) Ve a `/checkout` y crea pedido.
5) Te manda a `/confirm` con `publicCode + trackingToken`.
6) Entra a `/track`, pega ambos, y verás el estado.
7) “Reportar pago”: ingresa un `operationCode` y envía.
8) En admin `/dashboard/orders` cambia estado a `PAID`, `SHIPPED`, etc.

---

## 10) Cron TTL (liberar reservas vencidas) con GitHub Actions

Este repo ya trae `.github/workflows/ttl.yml`.

En GitHub → Settings → Secrets and variables → Actions → New repository secret:
- `CRON_URL` = tu dominio (ej. `https://tu-tienda.vercel.app`)
- `CRON_SECRET` = el mismo valor que pusiste en Vercel

El workflow llama:
- `POST /api/cron/release-expired` con header `x-cron-secret`.

---

## 11) Backups gratis (artifacts)

Workflow: `.github/workflows/backup.yml`

Secrets en GitHub:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Cada domingo exporta Firestore a:
- `backup/out/YYYY-MM-DD/*.json`

Y lo sube como artifact con retención de 30 días.

---

## 12) Deploy en Vercel (pasos)

1) Sube el repo a GitHub.
2) En Vercel: Import Project desde GitHub.
3) Configura env vars (Production + Preview si quieres).
4) **Redeploy** después de cambiar env vars.

> Nota: en Vercel Hobby hay restricciones de uso no comercial.

---

## 13) Problemas típicos (y cómo reconocerlos)

### “Invalid public env …”
Falta alguna `NEXT_PUBLIC_*` en `.env.local`.

### “Missing env FIREBASE_PRIVATE_KEY”
Falta una env var server.

### “PERMISSION_DENIED” en Firestore
- Revisa reglas.
- Revisa App Check enforcement.

### “requires an index” en catálogo
No has desplegado `firestore.indexes.json`.

### “NOT_ADMIN” al iniciar sesión
Tu usuario no tiene `admin:true` y no está en allowlist.

### “CSRF_FAILED” en acciones admin
- Asegúrate de entrar por `/login` primero.
- El navegador debe tener cookie `odera_csrf`.

---

## 14) Qué personalizar primero

- Texto del home: `src/app/(public)/page.tsx`
- Header/Footer: `src/components/Header.tsx` y `Footer.tsx`
- Nombre tienda en emails: `src/lib/server/email.ts`
- Instrucciones de pago: desde `/dashboard/settings` (se guarda en `settings/store`)

