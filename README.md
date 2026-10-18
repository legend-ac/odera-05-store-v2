# ODERA 05 STORE

Tienda de zapatillas, ropa y accesorios con catálogo, carrito, reserva de stock,
pago por Yape o Plin, seguimiento de pedidos y panel administrativo.

## Stack

- Next.js 15 (App Router), React 19 y TypeScript strict
- Tailwind CSS 3
- Firestore + Firebase Auth (Google Sign-In) + App Check
- Route Handlers (`src/app/api/**/route.ts`) con Firebase Admin SDK (Node runtime)
- Imágenes y comprobantes: Cloudinary con un preset unsigned
- Emails: Nodemailer + Gmail SMTP (contraseña de aplicación)
- Reservas y respaldos programados con GitHub Actions

Las versiones exactas están en `package-lock.json`. El modo activo es
`STORAGE_MODE=spark_public_only`, con cargas a Cloudinary. `firebase_storage`
contempla una futura integración: cambiar esa variable no implementa las cargas
a Firebase Storage.

## Requisitos

- Node 22.13+ de la rama 22 o Node 24+. La rama 20 requiere al menos 20.19
  para las herramientas actuales.
- Cuentas configuradas en Firebase y Cloudinary
- Un alojamiento compatible con Next.js para producción

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
     firebase deploy --only firestore:rules,firestore:indexes
     ```
3. **App Check**
   - App Check → Web app → reCAPTCHA v3 site key.
   - El enforcement de Firestore se configura en Firebase Console. La verificación
     del encabezado de App Check en las API del servidor se controla por separado
     con `ENABLE_APP_CHECK_VERIFY`.

## Variables de entorno (Vercel / local)
Si `.env.local` todavía no existe, copia [.env.example](.env.example) con ese
nombre y completa los valores. Conserva el archivo existente si ya está
configurado. Los archivos con credenciales no se incluyen en Git.

### Server (solo backend)

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (pega el PEM con `\n` y el código lo convierte a saltos reales)
- `FIRESTORE_DATABASE_ID` (predeterminado `(default)`)
- `SMTP_USER`
- `SMTP_PASS` (App Password Gmail)
- `CRON_SECRET`
- `STORAGE_MODE` = `spark_public_only` (default)
- (opcional) `ADMIN_ALLOWLIST_EMAILS` = emails separados por coma
- (opcional) `ENABLE_APP_CHECK_VERIFY` = `true` para verificar App Check en endpoints críticos
- (opcional) `EMAIL_BRAND_IMAGE_URL`, imagen de marca de los correos

### Client (NEXT_PUBLIC_*)

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_CHECK_SITE_KEY`
- `NEXT_PUBLIC_FIRESTORE_DATABASE_ID`, debe coincidir con el ID del servidor
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, preset unsigned para las cargas
- (opcional) `NEXT_PUBLIC_SITE_URL`, URL pública para enlaces canónicos y metadatos
- (opcional) `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, contemplado para Firebase Storage

Las variables `NEXT_PUBLIC_*` son públicas y llegan al navegador. La plantilla
[.env.example](.env.example) contiene la lista completa.

## Correr en local

```bash
npm ci
npm run dev
```

La vista está en `http://localhost:3000`. Next.js carga `.env.local` para la
aplicación.

## Limpiar archivos generados

```bash
npm run clean:generated -- --dry-run
npm run clean:generated
```

Elimina informes, cachés de pruebas y la compilación de verificación. Para limpiar
también la compilación local, detén `npm run dev` y ejecuta:

```bash
npm run clean:generated -- --all
```

Conserva código, pruebas, imágenes, variables de entorno, dependencias y respaldos
con datos. Solo retira las carpetas de respaldo que estén vacías. `node_modules`
contiene las librerías necesarias; las carpetas `.next` se regeneran al ejecutar
la tienda. La comprobación de TypeScript genera únicamente los tipos de rutas,
sin volver a construir toda la web.

## Hacerte admin

Inicia sesión con Google en `/login`. El acceso requiere el claim `admin: true`
o un correo incluido en `ADMIN_ALLOWLIST_EMAILS`.

El botón abre una ventana de Google. Al terminar, el servidor valida la cuenta,
crea la cookie segura y carga el panel con una solicitud nueva. Si el navegador
bloquea esa ventana, el acceso muestra cómo permitirla; una cancelación o una
cuenta sin permisos también muestran un mensaje. Se evita el retorno silencioso
del flujo anterior con redirección entre Firebase y Vercel, siguiendo la
[alternativa de Firebase para navegadores que bloquean almacenamiento de terceros](https://firebase.google.com/docs/auth/web/redirect-best-practices#popup-sign-in).

Para asignar el claim usando las credenciales locales:

```bash
node --env-file=.env.local --import tsx scripts/set-admin-claim.ts UID_DEL_USUARIO
```

Si las variables ya están cargadas en el proceso, también puedes usar
`npm run admin:set-claim -- UID_DEL_USUARIO`. El script no carga `.env.local`
automáticamente. Después, cierra sesión y vuelve a entrar para renovar el token.

## Reservas y pagos

El checkout confirma stock y total antes del pago. La reserva sin comprobante
dura 20 minutos. En `/checkout/pago`, el cliente puede pagar y enviar el
comprobante; un pago recibido conserva el stock mientras la tienda lo revisa.
El enlace privado permite consultar el seguimiento del pedido.

En **Dashboard → Ajustes → Tienda** se configuran horarios, plazos de entrega y
condiciones de cambios. Los campos vacíos indican consultar a la tienda.

## Apariencia clara u oscura

En **Dashboard → Ajustes → Tienda → Apariencia de la tienda** elige **Oscuro** o
**Claro crema** y pulsa **Guardar configuración**. La selección se guarda para
toda la tienda: inicio, catálogo, fichas, carrito, pago, seguimiento, información
y acceso. La versión clara usa fondo crema, tarjetas blancas, texto oscuro y
acentos rojos. Conserva las fotografías originales y el diseño de cada página.

El servidor entrega el tema guardado en el HTML inicial y actualiza la caché al
guardar los ajustes. Las tiendas sin un tema configurado conservan el oscuro.
El panel administrativo mantiene su paleta clara de trabajo.

## Verificaciones

| Comando | Alcance |
| --- | --- |
| `npm run lint` | Revisión de código |
| `npm run typecheck` | Tipos de rutas y TypeScript, sin compilar toda la web |
| `npm run test` | Pruebas unitarias |
| `npm run test:coverage` | Pruebas con informe de cobertura |
| `npm run test:e2e` | Recorridos en Chrome de escritorio y móvil; requiere la tienda abierta |
| `npm run test:integrations` | Correo contra un receptor SMTP local, sin mensajes externos |
| `npm run check:providers` | Autenticación Gmail sin enviar correo y carga real de una imagen mínima a Cloudinary |
| `npm run audit:production` | Auditoría de producción; bloquea alertas altas y críticas |
| `npm run build:verify` | Compilación de producción aislada en `.next-quality` |
| `npm run test:quality` | Pruebas, cobertura, E2E, TypeScript y compilación aislada |

Los E2E usan Google Chrome y el componente de vídeo de Playwright. Instala Chrome
si no está disponible y ejecuta `npx playwright install ffmpeg` cuando falte ese
componente. Los casos de reserva y pago simulan las API de escritura: no crean
pedidos reales ni descuentan inventario. `check:providers` sí hace una carga
externa y puede dejar una imagen de prueba si no recibe un token de borrado.

Los resultados y pendientes de la última revisión están en
[QUALITY_REPORT.md](QUALITY_REPORT.md). Los informes y capturas se regeneran al
ejecutar sus comprobaciones y se retiran con el comando de limpieza.

## Producción y automatización

Tienda publicada: [odera-05-store-v2.vercel.app](https://odera-05-store-v2.vercel.app).

Con las variables de producción configuradas:

```bash
npm run build
npm run start
```

Configura las variables también en el alojamiento. `NEXT_PUBLIC_SITE_URL` permite
indicar el dominio; si no se define, se detectan las variables de despliegue de
Vercel cuando están disponibles.

`.vercelignore` excluye credenciales locales, cachés, informes y respaldos del
paquete enviado por la CLI. Producción utiliza las variables configuradas en Vercel.

Roboto y Roboto Condensed se incluyen en `src/app/fonts` con sus licencias y se
cargan mediante `next/font/local`; la compilación no necesita descargarlas de
Google Fonts. Conservan las fuentes y pesos usados por el diseño.

- **Cron:** `.github/workflows/ttl.yml` corre cada 10 minutos. Requiere los secretos
  de GitHub `CRON_URL` —URL base de la tienda— y `CRON_SECRET`. Llama a
  `POST /api/cron/release-expired` con `x-cron-secret`. Libera reservas sin pago
  vencidas con `{"includeTrashCleanup":false}`. No mueve ni elimina registros
  de la papelera. La limpieza antigua solo se ejecuta con una llamada autenticada
  que incluya explícitamente `{"includeTrashCleanup":true}`; no está programada.
  La ejecución depende del calendario de GitHub Actions.
- **Respaldos:** `.github/workflows/backup.yml` exporta Firestore cada domingo a las
  03:00 UTC. Requiere los secretos de servidor de Firebase y, si corresponde,
  `FIRESTORE_DATABASE_ID`, además de `BACKUP_ENCRYPTION_KEY` (32 bytes en
  hexadecimal). Exporta productos, pedidos, ajustes y contadores cifrados con
  AES-256-GCM; el artefacto `firestore-backup-encrypted` se conserva 30 días.
  GitHub solo publica archivos `.json.enc` y falla si falta la clave.

Para un respaldo local con el archivo de entorno:

```bash
node --env-file=.env.local --import tsx scripts/backup.ts
```

`npm run backup:run` está disponible cuando las variables ya están cargadas en el
proceso, como en el workflow. La exportación local es JSON legible salvo que
también se cargue `BACKUP_ENCRYPTION_KEY`.

La clave de recuperación se conserva localmente en `.env.backup.local`, excluido
de Git y del despliegue. Conserva una copia segura de ese archivo: GitHub no
permite recuperar el valor de un secreto. Para recuperar un archivo descargado
del artefacto:

```bash
node --env-file=.env.backup.local --import tsx scripts/decrypt-backup.ts backup/out/orders.json.enc backup/out/orders-recovered.json
```

El comando verifica el cifrado y escribe un JSON nuevo sin sobrescribir archivos.
No importa datos a Firestore; la restauración de la base de datos es manual.

## Nota sobre /dashboard

- `src/middleware.ts` SOLO verifica **presencia** de cookie y conserva el destino del panel al solicitar acceso.
- La verificación real (session cookie + claim admin) se hace en `src/app/(admin)/dashboard/layout.tsx` en runtime **nodejs**.

## Inventario operativo

- Usa **Dashboard → Inventario** para priorizar agotados y reposiciones, y ajustar stock por talla/color sin editar toda la ficha.
- Cada ajuste es una transacción: no permite stock negativo y guarda actor, motivo, antes/después y fecha en `stockLogs` / `auditLogs`.
- Antes del primer uso en una tienda existente ejecuta `npm run inventory:backfill` para ver el alcance y luego `npm run inventory:backfill -- --apply` para materializar los campos de inventario. Despliega también `firestore.indexes.json`.

El script de inventario carga `.env.local` automáticamente y conserva las variables
ya definidas en el proceso.
