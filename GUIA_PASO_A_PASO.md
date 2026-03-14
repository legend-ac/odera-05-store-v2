# Guía de Implementación y Arquitectura — ODERA 05 STORE

El presente documento detalla la arquitectura, configuración y despliegue del proyecto **ODERA 05 STORE**. Esta guía está orientada a desarrolladores y administradores del sistema, proporcionando una visión técnica estructurada para asegurar la correcta operación de la plataforma.

> **Nota Arquitectónica:** El sistema está diseñado para operar eficientemente bajo infraestructura de costo cero (Firebase Spark Plan y Vercel Hobby/Free). Por esta razón, la arquitectura prescinde de Cloud Functions y delega tareas recurrentes a flujos automatizados (GitHub Actions).

---

## 1. Arquitectura del Sistema

El ecosistema se compone de los siguientes servicios principales:

1. **Frontend (Next.js 14 App Router):** Interfaz de usuario pública (catálogo, carrito, checkout, seguimiento) y panel de administración privado.
2. **Backend (Next.js Route Handlers):** Capa de API (`/api/...`) ejecutada en el entorno Node de Vercel. Gestiona de forma segura las transacciones de negocio.
3. **Plataforma de Datos y Autenticación (Firebase):**
   - **Firestore:** Base de datos principal (productos, pedidos, auditoría).
   - **Firebase Authentication:** Gestión de acceso administrativo (integración con Google).
   - **Firebase App Check:** Capa de seguridad anti-abuso.
4. **Automatización Técnica (GitHub Actions):**
   - **Cron TTL:** Ejecución periódica para la liberación de inventario reservado y no procesado.
   - **Backups:** Respaldo semanal de la base de datos Firestore exportado como artefacto seguro.

### 1.1 Flujo Transaccional de Compra (Checkout)
El proceso de compra está diseñado para garantizar la consistencia de los datos y evitar la sobreventa:
- El cliente consolida su carrito y procede al checkout (`POST /api/create-order`).
- El backend procesa una **transacción atómica en Firestore** que:
  - Valida la disponibilidad de inventario en tiempo real.
  - Genera una reserva temporal de stock.
  - Emite un código público de seguimiento (`publicCode`) y un token de seguridad (`trackingToken`).
- Si el pago no se consolida dentro de la ventana de reserva temporal, el entorno automatizado (Cron TTL) cancela el pedido y restituye el inventario sistemáticamente.

---

## 2. Gestión de Activos y Almacenamiento (Storage)

Debido a las restricciones operativas del plan Spark, el sistema opera por defecto bajo la siguiente directiva de almacenamiento:

- `STORAGE_MODE=spark_public_only`

**Implicaciones Técnicas:**
- No se realizan cargas de contenido multimedia a través de Firebase Storage.
- Los recursos gráficos de los productos deben referenciarse mediante URL externas (CDNs corporativas) o ser depositados estáticamente en el repositorio bajo el directorio `public/` (ej. `public/products/item.webp`).

---

## 3. Topología del Proyecto

La estructura del código fuente está consolidada bajo los estándares de Next.js App Router:

- `src/app/(public)/...`: Interfaces orientadas a clientes y consumidores.
- `src/app/(admin)/...`: Centro de operaciones y panel de control gerencial.
- `src/app/api/.../route.ts`: Endpoints que procesan lógica de control servidor.
- `src/lib/firebase/*`: Bibliotecas de integración del cliente de Firebase.
- `src/lib/server/*`: Herramientas exclusivas del entorno backend (Admin SDK, servicios de notificación electrónica SMTP, barreras de seguridad).
- `firestore.rules` y `firestore.indexes.json`: Políticas estáticas de seguridad y configuración de lectura estructurada.
- `.github/workflows/*`: Pipelines operativos para integración y despliegue continuo (CI/CD) limitados a rutinas de Cron y Backups.

---

## 4. Modelado Estructural de Datos (Firestore)

La gobernanza de datos estipula el particionamiento de la información en diversas colecciones:

- **`products`**: Repositorio central de bienes de consumo continuo y variantes. (La identidad documental reside en el atributo `slug`).
- **`orders`**: Registro formal e inmutable de operaciones transaccionales. Almacena comprobantes operacionales (`publicCode` y `trackingToken`), lapsos temporales de viabilidad (`reservedUntil`) y una deconstrucción instantánea de precios vigentes al cursarse la transacción.
- **`counters/orders`**: Índice numérico para asignación correlativa.
- **`paymentOps`**: Infraestructura preentiva fundamentada en directivas de idempotencia (previene duplicidad interaccional en pasarelas de pago).
- **`auditLogs` / `stockLogs`**: Entornos consultivos inmutables orientados a la auditoría estricta de alteraciones de inventario y acciones sensitivas administrativas.

---

## 5. Políticas de Seguridad e Integridad Perimetral (Firestore Rules)

La seguridad base prescinde voluntariamente de manipulaciones directas cliente-servidor para entidades sensitivas:

- **Operaciones de Catálogo (`products`)**: La lectura recae libre pero condicionada (`status == active`). El ingreso y alteración de perfiles de productos es facultad absoluta de los administradores logueados.
- **Órdenes e Inventario Transaccional (`orders`, `stockLogs`, `paymentOps`)**: El acceso cliente está bloqueado universalmente (`allow read, write: if false;`). Esta rigidez impone que todo cruce interactivo concurra obligatoriamente filtrado por un entorno controlado backend mediante **Firebase Admin SDK**.

---

## 6. Procedimiento de Configuración y Arranque Inicial (Setup)

### Paso 1: Configuración en Consola Firebase
1. Apertura de un nuevo proyecto desde "Firebase Console". Certifique que la facturación se encuentra inhabilitada (Plan Spark).

### Paso 2: Configuración de Base de Datos
1. Active Firestore seleccionando modalidad nativa.
2. Realice el despliegue fundacional de directivas ejecutando:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use <TU_PROJECT_ID>
   firebase deploy --only firestore:rules,firestore:indexes
   ```

### Paso 3: Activación de Módulos (Authentication y App Check)
1. Active al proveedor "Google" desde "Authentication > Sign-in Method".
2. Asiente la aplicación sobre "App Check" emitiendo claves operacionales **reCAPTCHA v3**. Traslade el código emitido al ecosistema bajo el título `NEXT_PUBLIC_APP_CHECK_SITE_KEY`.

### Paso 4: Credenciales del Administrador Servidor (Service Account)
Aísle los parámetros sustantivos dentro del JSON de la "Service Account" y relaciónelos con las variables de ambiente correspondientes:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (Atienda meticulosamente el sostenimiento del patrón de saltos literales `\n`).

### Paso 5: Mensajería Transaccional In-App (SMTP)
1. Instale un esquema de Contraseña Analítica de Aplicación tras habilitar "A2F" (Autenticación en Dos Pasos) para la matriz encargada del envío por Gmail.
2. Incorpore a las variables del sistema los parámetros:
   - `SMTP_USER`
   - `SMTP_PASS`

### Paso 6: Aislamiento de Variables Locales Paramétricas
Recree el entorno configurando en su entorno `.env.local` partiendo del andamiaje existente `.env.example`:

**Sección Privada/Servidor:**
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SMTP_USER`, `SMTP_PASS`, `CRON_SECRET`, `STORAGE_MODE=spark_public_only`

**Sección Pública/Cliente:**
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_APP_CHECK_SITE_KEY`

### Paso 7: Despliegue en Entorno de Desarrollo (Local Dev)
```bash
npm install
npm run dev
```

---

## 7. Directivas Operacionales del Panel de Control Administrador

Para consolidar control de las matrices de la Tienda de e-Commerce:
1. Navegue e identifíquese a través de `/login` mediante la habilitación Google.
2. Envíe confirmación accediendo al entorno "Users" ubicado en el núcleo "Authentication" a fin de conseguir la identificación UID del perfil asimilado.
3. Transfiera facultades administrativas absolutas desde terminal configurada ejecutando:
   ```bash
   npm run admin:set-claim -- <TU_UID>
   ```
4. Recargue el esquema de autentificación desconectándose y conectándose para formalizar los privilegios plenos a `/dashboard`. *(Alternativa pasiva: Listar el e-mail asociado dentro del token de configuración `ADMIN_ALLOWLIST_EMAILS`).*

---

## 8. Procesos de Mantenimiento Automatizado y CRON

### 8.1 Regulación Sistemática Time-To-Live (Cron TTL)
- **Directriz Estática:** `.github/workflows/ttl.yml`
- **Requisitos Secretos (GitHub Secrets):** `CRON_URL` y `CRON_SECRET`.
- **Eficacia Teórica:** Lanza peticiones intervaladas automatizadas al punto de liberación `/api/cron/release-expired`, cancelando sistemáticamente reservaciones inoperantes y reintegrando capital estático (stock).

### 8.2 Protocolo Regular de Respaldo Contiguo
- **Directriz Estática:** `.github/workflows/backup.yml`
- **Requisitos Secretos (GitHub Secrets):** Exclusivo Service Account (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
- **Eficacia Teórica:** Ejecuta una consolidación perimetral volcando de manera cíclica archivos de exportación en formato universal JSON subyacentes finalmente a la categoría transitoria de artefacto del repositorio.

---

## 9. Criterios Integrales de Despliegue (Production Vercel)

1. Sincronice interactivamente los repositorios desde Vercel (Import Project / GitHub).
2. Valide simétricamente la portabilidad de todas y cada una de las variables privadas y públicas en su formato correcto sin espacios inoperantes dentro de los listados Environment (Production/Preview).
3. Efectúe una instancia final o redespliegue correctivo *(Redeploy)* si ejerce actualizaciones manuales sobre variables inyectadas postergadas a compresión Vercel.

---

## 10. Resolución Estructurada de Incidencias Operativas (Troubleshooting)

- **Evento: “PERMISSION_DENIED” referenciado por operaciones Firestore:** Revise metódicamente su listado nativo de políticas `firestore.rules`. Confirme simultáneamente tolerancias al imponer perfiles coercitivos en _App Check Enforcement_.
- **Evento: “requires an index” en la carga central administrativa o catálogos:** Existe ausencia de jerarquía e índices para filtros paramétricos precompilados. Se solventa promoviendo una actualización remota apuntando el set de índices `.json` subyacentes de Firestore hacia la red base.
- **Evento de Acceso: “NOT_ADMIN”:** Su cuenta carece del atributo sustancial de acceso validado (`admin: true` como fragmento transaccional de Custom Claim) o inexiste en la plantilla excepcional `ADMIN_ALLOWLIST_EMAILS`.
- **Evento de Integridad Criptográfica: “CSRF_FAILED”:** Restricción perimetral ante la ausencia de confirmación bidireccional segura. La firma cifrada enmascarada dentro de `odera_csrf` resultó nula o violada; inicie su reconección exclusiva comenzando desde `/login`.
