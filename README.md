# ODERA 05 STORE

Tienda de zapatillas, ropa y accesorios con catálogo, carrito, reserva de stock,
pago por Yape o Plin, seguimiento privado y panel administrativo.

**Producción:** [odera-05-store-v2.vercel.app](https://odera-05-store-v2.vercel.app).
Los resultados de pruebas, mediciones de rendimiento y pendientes operativos se
mantienen en [QUALITY_REPORT.md](QUALITY_REPORT.md).

## Tecnologías y arquitectura

| Parte | Implementación |
| --- | --- |
| Lenguaje | TypeScript con comprobación estricta; JavaScript en configuraciones y algunos scripts |
| Aplicación | Next.js 15, App Router y React 19 |
| Presentación | HTML semántico, Tailwind CSS 3, CSS global y CSS Modules |
| Base de datos | Cloud Firestore, base documental NoSQL |
| Acceso administrativo | Firebase Auth con Google y sesión verificada con Firebase Admin SDK |
| API | Route Handlers de Next.js, validaciones con Zod y runtime Node.js |
| Imágenes y comprobantes | Cloudinary; recursos locales de marca en `public/brand` |
| Correo | Nodemailer y Gmail SMTP con contraseña de aplicación |
| Alojamiento | Vercel |
| Automatización | GitHub Actions para reservas vencidas y respaldos cifrados |
| Pruebas | Vitest y Playwright con Chrome de escritorio y teléfono |

Las versiones exactas están en `package-lock.json`. El modo activo es
`STORAGE_MODE=spark_public_only`, con cargas a Cloudinary. `firebase_storage`
contempla otra integración: cambiar esa variable por sí solo no implementa las
cargas a Firebase Storage.

El servidor obtiene los datos iniciales de las páginas públicas; el navegador
gestiona filtros, selección de variantes, carrito y formularios. Las API vuelven
a validar precios, stock, permisos y pagos antes de confirmar operaciones.

### Directorios principales

```text
src/
  app/
    (public)/           Inicio, catálogo, producto, compra e información
    (admin)/            Acceso y dashboard
    api/                Reservas, pagos, seguimiento y operaciones administrativas
    fonts/              Fuentes locales y licencias
    t/                  Seguimiento mediante enlace privado
    globals.css         Tokens de tema y estilos compartidos
    layout.tsx          Fuentes, metadatos, tema y estructura general
  components/           Cabecera, pie, tarjetas, imágenes y componentes compartidos
    admin/              Estructura del panel y control de cambios sin guardar
    cart/               Estado del carrito
  lib/
    firebase/           SDK cliente y App Check
    server/             Firebase Admin, sesiones, correo, CSRF y servicios privados
  schemas/              Validaciones de datos
  middleware.ts         Redirección inicial para rutas del dashboard
public/brand/           Personaje, categorías, local e identidad visual
public/fonts/           Bebas Neue local y su licencia
scripts/                Calidad, limpieza, inventario, permisos y respaldos
e2e/                    Recorridos de navegador
.github/workflows/      Tareas programadas
```

### Rutas

| Ruta | Uso |
| --- | --- |
| `/` | Portada, categorías, novedades, redes y tienda física |
| `/catalog` | Catálogo con búsqueda y filtros |
| `/p/[slug]` | Galería, variantes, disponibilidad y compra de un producto |
| `/cart` | Carrito y revisión de cantidades |
| `/checkout` | Datos del comprador, entrega y creación de reserva |
| `/checkout/pago` | Pago de reserva y envío de comprobante |
| `/confirm` | Confirmación del registro |
| `/track` | Consulta del estado de un pedido |
| `/t/[publicCode]/[trackingToken]` | Enlace privado de seguimiento |
| `/nosotros` | Información de la tienda |
| `/informacion/[slug]` | Términos, privacidad, envíos y cambios/devoluciones |
| `/libro-reclamaciones` | Formulario de quejas y reclamos |
| `/login` | Ingreso administrativo con Google |
| `/dashboard` | Resumen de la operación |
| `/dashboard/products` | Listado y editor de productos |
| `/dashboard/inventory` | Existencias y movimientos por variante |
| `/dashboard/orders` | Gestión de pedidos |
| `/dashboard/settings` | Apariencia, información comercial e integraciones |

## Diseño visual

La identidad utiliza un **estilo editorial deportivo con referencias manga e
ink**: titulares condensados, composición firme, líneas finas, detalles
japoneses y acentos rojos. La adaptación a celular conserva esa identidad con
menos espacio y controles táctiles legibles.

- **Tipografía:** Bebas Neue para titulares y marca; Roboto para lectura y
  formularios; Roboto Condensed como apoyo. Roboto utiliza `next/font/local`;
  Bebas Neue, `@font-face` y precarga local. Se usa `display: swap`, con licencias en
  [src/app/fonts](src/app/fonts/README.md).
- **Forma:** predominan bordes rectos, separadores de un píxel y superficies
  simples. Los botones principales `.btn-brand` usan el corte diagonal de la
  marca; algunos controles de compra conservan la forma rectangular.
- **Jerarquía:** etiquetas pequeñas en mayúsculas, títulos de alto contraste,
  texto secundario discreto y rojo para acciones, selección y ofertas.
- **Portada:** en PC el personaje acompaña al titular. En teléfono el torso se
  integra a su lado con un final suave; descripción, botones e indicadores
  utilizan el ancho disponible.
- **Categorías:** tres tarjetas en PC con imagen completa, título y descripción
  separados. En teléfono se convierten en filas de imagen y texto con una zona
  de enlace amplia, sin textos superpuestos a las fotos.
- **Ficha de producto:** miniaturas laterales en PC y galería/compra en dos
  columnas; en teléfono se apilan y las miniaturas pasan a una tira horizontal.
  Se conservan las imágenes y el orden configurados para cada producto.
- **Compra y pago:** formularios por secciones, selección con borde rojo y
  resumen lateral en PC; una columna en teléfono.
- **Local físico:** foto real y datos en dos columnas, apilados en teléfono,
  con accesos a indicaciones y a la información del local.

### Temas y tokens

En **Dashboard → Ajustes → Tienda → Apariencia de la tienda**, selecciona
**Oscuro** o **Claro crema** y guarda los cambios. La preferencia se aplica a
toda la tienda pública y al acceso. El administrador mantiene su apariencia
clara para trabajar con datos.

| Token | Oscuro | Claro crema | Uso |
| --- | --- | --- | --- |
| `--ink` | `#0E0E12` | `#FAF8F3` | Fondo principal |
| `--ink-2` | `#15151C` | `#FFFFFF` | Tarjetas y paneles |
| `--ink-3` | `#1E1E28` | `#F0ECE3` | Superficies secundarias |
| `--paper` | `#F3EEE4` | `#242321` | Texto principal |
| `--ash` | `#A7A3B1` | `#6C655B` | Texto secundario |
| `--ash-2` | `#3A3848` | `#DCD5C9` | Bordes y separadores |
| `--vermeil` | `#E8452C` | `#C93820` | Acción y énfasis |

Los tokens completos y alias semánticos están en `src/app/globals.css`.
`HomeSections.module.css` y `CategoryGrid.module.css` contienen los ajustes de
portada/local y categorías; `src/app/(public)/purchase.module.css`, los estilos
de checkout y pago. Al modificar una sección, utiliza sus estilos y los tokens
existentes para conservar ambos temas.

El servidor incluye el tema guardado en el HTML inicial. La configuración vive
en `settings/store` y la caché se invalida al guardar. Si no hay un tema
configurado, se utiliza el oscuro.

### Movimiento y accesibilidad

`src/components/StorefrontMotion.tsx`, montado desde el layout público, introduce
secciones y tarjetas al entrar en pantalla mediante `IntersectionObserver` y
Web Animations API. Combina opacidad y un desplazamiento de 14 px, con duración
de 550 ms y una separación entre elementos de hasta 120 ms. Cada elemento se
presenta una vez, sin repetir el efecto al subir.

El contenido del servidor permanece visible sin JavaScript y
`prefers-reduced-motion` desactiva estas entradas. El título y la imagen de la
portada, los formularios y el administrador quedan fuera del efecto. Las acciones
y estadísticas de portada llevan una entrada leve de 6 px. Se mantienen foco visible, etiquetas de formulario
y navegación por teclado.

## Rendimiento e imágenes

La carga prioriza lo visible y evita descargar todas las fotografías del sitio
al abrir una página:

- Las imágenes locales utilizan la optimización de Next.js, formatos AVIF/WebP
  y tamaños adaptados al espacio disponible.
- El componente compartido `ProductImage` solicita imágenes de Cloudinary con
  dimensiones responsivas y formato/calidad automáticos. Las URL firmadas y
  fuentes que no admiten esa transformación conservan su tratamiento compatible.
- La imagen principal de la ficha y las primeras tarjetas visibles reciben
  prioridad; el resto se carga de manera diferida. En el catálogo se priorizan
  solamente las dos primeras tarjetas.
- Una imagen rota se sustituye por otra válida del producto y, si ninguna
  funciona, por un estado de respaldo, sin bloquear navegación ni controles.
- Las imágenes reservan su espacio para reducir saltos de diseño. Las fuentes
  locales evitan una hoja de estilo externa de Google Fonts.
- El catálogo entrega sus tarjetas y los filtros de la URL desde el servidor;
  la lista inicial se puede leer sin esperar a JavaScript. Las lecturas públicas
  de catálogo y búsqueda usan caché de 60 segundos. La disponibilidad mostrada
  puede quedar desactualizada durante esa ventana: precio y stock se vuelven a
  confirmar al reservar, sin usar la caché del catálogo para descontar inventario.
- Las redes oficiales llegan desde el servidor con una caché de 60 segundos,
  invalidada al guardar ajustes. Así no dependen de otra consulta de Firestore
  en el navegador. App Check conserva sus verificaciones y se carga en un
  módulo separado después del primer renderizado.
- Las imágenes optimizadas tienen una caché mínima configurada de 30 días.
  `/brand` se entrega con caché de un año e `immutable`: al sustituir un recurso
  de marca, cambia su nombre o URL para que se reciba la nueva versión.

El objetivo es responder de inmediato y reducir la descarga inicial. **No se
garantiza la carga completa de todas las imágenes y operaciones en un segundo:**
depende de conexión, dispositivo, cachés y servicios como Firebase o Cloudinary.
Las imágenes fuera de pantalla se solicitan al acercarse a ellas y los
formularios confirman el resultado cuando responde la API. Los tiempos y las
condiciones de medición se documentan en [QUALITY_REPORT.md](QUALITY_REPORT.md).

### Medición reproducible

Con la tienda abierta, ejecuta:

```bash
npm run measure:performance -- --url http://127.0.0.1:3000 --label current --runs 1
```

`--url` acepta el origen de una tienda pública, sin ruta, parámetros ni
credenciales. Si se omite, se utiliza `E2E_BASE_URL` o `http://127.0.0.1:3000`.
`--label` se normaliza para nombrar el informe; `--runs` admite entre una y tres
repeticiones. `--help` muestra las opciones.

El script mide inicio, catálogo y el primer producto público disponible con
Chrome headless. Compara escritorio de **1366 × 900 px / DPR 1**, sin limitar la
red, y teléfono de **393 × 852 px / DPR 2**, con descarga de **10 Mbps**, subida
de **5 Mbps** y latencia configurada de **80 ms**. No limita la CPU. Cada muestra
usa un contexto nuevo, caché HTTP del navegador desactivada y movimiento reducido.

El informe `integration-results/performance-<label>.json` registra TTFB,
DOMInteractive, DOMContentLoaded, carga, FCP, LCP, peticiones/peso de imágenes y
estado de las imágenes visibles. Identifica la etiqueta y los tiempos de carga
y pintado del candidato LCP; también cuenta las tareas de más de 50 ms y suma
sus duraciones. El catálogo se consulta primero sin JavaScript para descubrir
una ficha; solo se permite un intento con JavaScript si una versión anterior
del HTML todavía no contiene productos.

El diagnóstico CDP incluye todos los tipos de recursos: host, estado, caché,
peso, tiempo al primer byte y duración de la petición, con resumen por categoría
y los diez recursos más lentos. No guarda rutas ni parámetros de sus URL. Las
duraciones se superponen y una conexión de larga duración no demuestra por sí
sola que bloquee el renderizado. La consola muestra un resumen sin URL de
productos ni recursos. No inicia sesión ni pulsa controles de compra; bloquea
escrituras de API, cargas de Cloudinary y endpoints de escritura de Firestore.

La medición cubre la pantalla inicial, sin desplazamiento, y espera hasta 15
segundos la decodificación de sus imágenes; cada navegación tiene un límite de
60 segundos. El peso corresponde a lo descargado hasta la captura de métricas,
no a todas las imágenes de la página. LCP corresponde al último candidato
observado en ese instante; no representa una medición de campo ni asegura que
no aparezca otro candidato más tarde. Las peticiones todavía abiertas se marcan
como pendientes y su duración llega hasta la captura. No controla la caché de
CDN/servidor y la consulta previa del catálogo puede calentarla. Los resultados dependen también
del equipo y la conexión reales: compara varias muestras en la misma compilación
de producción y condiciones equivalentes. Los informes se excluyen de Git y el
comando de limpieza de generados los elimina.

## Requisitos y ejecución local

- Node.js 22.13+ de la rama 22 o Node.js 24+. Para herramientas que aún se ejecuten
  con Node 20, el mínimo es 20.19.
- Proyecto Firebase con Firestore y autenticación de Google.
- Cuenta y preset de Cloudinary configurados.
- Credenciales SMTP válidas si se necesita enviar correo.

```bash
npm ci
```

Si `.env.local` todavía no existe, copia [.env.example](.env.example) con ese
nombre y completa los valores. Conserva el archivo existente si ya está
configurado. Después:

```bash
npm run dev
```

La aplicación abre en `http://localhost:3000`; Next.js carga `.env.local`.

### Configuración de Firebase

1. Activa Google en **Authentication → Sign-in method** y configura los dominios
   autorizados de desarrollo y producción.
2. Crea Firestore en modo nativo y despliega las reglas e índices del repositorio:

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use <TU_PROJECT_ID>
   firebase deploy --only firestore:rules,firestore:indexes
   ```

3. Configura App Check con reCAPTCHA v3. El enforcement de Firestore se controla
   en Firebase Console; la verificación del encabezado App Check en las API del
   servidor se controla por separado con `ENABLE_APP_CHECK_VERIFY`.

### Variables de entorno

La plantilla [.env.example](.env.example) es la referencia completa. Los archivos
con credenciales se excluyen de Git y del paquete de despliegue.

| Grupo | Variables |
| --- | --- |
| Firebase de servidor | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIRESTORE_DATABASE_ID` |
| Autorización y API | `ADMIN_ALLOWLIST_EMAILS` opcional, `ENABLE_APP_CHECK_VERIFY`, `CRON_SECRET` |
| Correo | `SMTP_USER`, `SMTP_PASS`, `EMAIL_BRAND_IMAGE_URL` opcional |
| Almacenamiento | `STORAGE_MODE` |
| Firebase público | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIRESTORE_DATABASE_ID`, `NEXT_PUBLIC_APP_CHECK_SITE_KEY` |
| Cloudinary público | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` |
| Dominio | `NEXT_PUBLIC_SITE_URL` opcional |
| Integración futura | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` opcional |
| Respaldos, fuera de la aplicación web | `BACKUP_ENCRYPTION_KEY` |

`FIREBASE_PRIVATE_KEY` acepta el PEM con `\n`; el servidor lo convierte a saltos
reales. El ID de Firestore del cliente y el servidor debe coincidir; el
predeterminado es `(default)`. `SMTP_PASS` es una contraseña de aplicación de
Gmail. El preset unsigned de Cloudinary debe permitir las cargas previstas.

Las variables `NEXT_PUBLIC_*` llegan al navegador; no deben contener secretos.
En Vercel se configuran para el entorno correspondiente antes de compilar;
cambiarlas requiere otro despliegue. El correo depende de que Gmail acepte las
credenciales: consulta su última comprobación en el informe de calidad.

## Acceso y seguridad del administrador

Inicia sesión con Google en `/login`. Se requiere el claim `admin: true` o un
correo incluido en `ADMIN_ALLOWLIST_EMAILS`. Una ventana de Google bloqueada,
una cancelación o una cuenta sin permisos muestra un mensaje. Al validar la
cuenta, el servidor crea una cookie de sesión de ocho horas y carga el destino
del panel con una solicitud nueva.

`src/middleware.ts` verifica la presencia de cookie y conserva el destino al
redirigir al acceso. La verificación real de sesión y permisos ocurre en el
servidor, incluido `src/app/(admin)/dashboard/layout.tsx`, con runtime Node.js.
Las operaciones administrativas requieren autorización del servidor; CSRF,
validación de entradas y límites de solicitudes protegen las rutas aplicables.

Para asignar el claim con las credenciales locales:

```bash
node --env-file=.env.local --import tsx scripts/set-admin-claim.ts UID_DEL_USUARIO
```

Si las variables ya están cargadas en el proceso, también puedes usar
`npm run admin:set-claim -- UID_DEL_USUARIO`. El script no carga `.env.local`
automáticamente. Cierra sesión y vuelve a entrar para renovar el token.

## Compra, reservas y seguimiento

1. El cliente elige variante y cantidad; el carrito se conserva en el navegador.
2. El checkout recoge contacto y entrega. El servidor confirma precios,
   descuentos, envío y existencias antes de crear la reserva.
3. La reserva sin comprobante dura **20 minutos**. La transacción descuenta el
   stock de las variantes y registra los movimientos correspondientes.
4. En `/checkout/pago` se consulta el importe confirmado, se elige Yape o Plin y
   se adjunta el comprobante. El pago recibido queda pendiente de revisión por
   la tienda y conserva el stock mientras se valida.
5. El cliente conserva su código y enlace privado de seguimiento. El cron
   devuelve el stock de reservas sin pago vencidas.

La base incluye `products`, `orders`, `settings`, `counters`, registros de stock
en `stockLogs`, auditoría en `auditLogs` y registros auxiliares de operaciones.
Los enlaces de seguimiento incluyen un token privado y no deben publicarse.

En **Dashboard → Ajustes → Tienda** se editan horarios, plazos de entrega,
condiciones de cambios, promociones y apariencia. Los campos comerciales vacíos
indican consultar a la tienda. Los importes y condiciones reflejan esa
configuración; este documento no fija plazos ni políticas sin confirmar.

## Gestión de productos e inventario

- **Productos** separa listado y editor, con secciones de datos, imágenes y
  variantes. El guardado permanece visible y se avisa antes de descartar cambios.
- El listado administrativo carga hasta 90 productos por página, con navegación
  a productos más antiguos o recientes. Sus filtros y búsqueda operan sobre la
  página cargada; Inventario permite localizar productos mediante el índice de
  búsqueda. El catálogo público tiene su propia carga y filtros.
- Se conservan los enlaces existentes. Crear un enlace repetido se rechaza; una
  edición desactualizada tampoco sobrescribe cambios recientes de stock.
  El borrador se mantiene para recuperar los datos.
- **Inventario** registra entradas y salidas por talla/color, muestra el stock
  resultante antes de guardar y conserva responsable, motivo y fecha. Las
  cantidades deben ser enteras y una salida no puede dejar stock negativo.
  Los indicadores describen los productos de la vista cargada.
- La papelera y las acciones masivas se separan de la edición diaria. Cada
  operación masiva afecta hasta 250 productos y confirma su alcance.
- El resumen del dashboard indica el alcance de sus cifras. Un comprobante
  recibido permanece pendiente de validación y no se presenta como reserva vencida.

Antes del primer uso del inventario en una tienda existente, revisa el alcance
del backfill y aplica la migración cuando corresponda:

```bash
npm run inventory:backfill
npm run inventory:backfill -- --apply
```

El primer comando solo informa; `--apply` escribe los campos de inventario.
El script carga `.env.local` y conserva las variables ya definidas en el proceso.
Despliega también `firestore.indexes.json`.

## Verificaciones y mantenimiento

| Comando | Alcance |
| --- | --- |
| `npm run lint` | Revisión de código |
| `npm run typecheck` | Tipos de rutas y TypeScript, sin compilar toda la web |
| `npm run test` | Pruebas unitarias |
| `npm run test:coverage` | Pruebas con informe de cobertura |
| `npm run test:e2e` | Recorridos en Chrome de escritorio y teléfono; requiere la tienda abierta |
| `npm run test:integrations` | Correo contra receptor SMTP local, sin mensajes externos |
| `npm run measure:performance` | Medición pública de inicio, catálogo y producto, con informe JSON |
| `npm run check:providers` | Autenticación Gmail sin enviar correo y carga real de imagen mínima a Cloudinary |
| `npm run audit:production` | Auditoría de producción; bloquea alertas altas y críticas |
| `npm run build:verify` | Compilación de producción aislada en `.next-quality` |
| `npm run test:quality` | Pruebas, cobertura, E2E, TypeScript y compilación aislada |

Los E2E usan Chrome instalado y FFmpeg de Playwright. Si falta este último,
ejecuta `npx playwright install ffmpeg`. `E2E_BASE_URL` permite cambiar el
destino; el predeterminado es `http://127.0.0.1:3000`. Las pruebas de reserva y
pago simulan las API de escritura y no crean pedidos ni descuentan inventario.
`check:providers` sí carga una imagen externa y puede dejarla en Cloudinary si
no recibe un token de borrado.

Los resultados y pendientes están en [QUALITY_REPORT.md](QUALITY_REPORT.md).
Para comprobar un cambio visual, utiliza reservas simuladas; una prueba manual
contra las API reales puede modificar pedidos y stock.

### Limpiar archivos generados

```bash
npm run clean:generated -- --dry-run
npm run clean:generated
```

Elimina informes, cachés de pruebas y la compilación de verificación. Para limpiar
también la compilación de desarrollo, detén el servidor local y ejecuta:

```bash
npm run clean:generated -- --all
```

Conserva código, pruebas, imágenes, variables de entorno, dependencias y respaldos
con datos; solo retira directorios de respaldo vacíos. `node_modules` contiene
las librerías necesarias y `.next` se regenera al ejecutar la aplicación.

## Git y despliegue en Vercel

Repositorio: [legend-ac/odera-05-store-v2](https://github.com/legend-ac/odera-05-store-v2).

El flujo actual registra los cambios en Git y publica mediante la CLI de Vercel.
Un `git push` por sí solo no sustituye el despliegue manual usado en este proyecto.
Revisa el diff y ejecuta las comprobaciones apropiadas antes de registrar y
publicar el alcance aprobado:

```bash
git add <archivos-revisados>
git commit -m "Descripción del cambio"
git push origin main
vercel deploy --prod --yes --archive=tgz --no-wait --json --scope andys-projects-58a83c0b
```

La CLI necesita la cuenta autorizada y el proyecto enlazado. `.vercelignore`
excluye credenciales locales, cachés, informes y respaldos. La aplicación
publicada usa las variables configuradas en Vercel.

Verifica que el despliegue termine en **READY**, que el dominio de producción
apunte a esa versión y que las rutas modificadas funcionen en PC y teléfono.
La aceptación de la subida no confirma que la compilación haya terminado.

Para ejecutar producción en otro alojamiento compatible:

```bash
npm run build
npm run start
```

`NEXT_PUBLIC_SITE_URL` permite fijar el dominio canónico. Si no se define, se
detectan las variables de despliegue de Vercel cuando están disponibles.

## Tareas programadas y respaldos

### Reservas vencidas

`.github/workflows/ttl.yml` programa una ejecución cada diez minutos y admite
ejecución manual. Requiere los secretos de GitHub `CRON_URL` —URL base de la
tienda— y `CRON_SECRET`. Llama a `POST /api/cron/release-expired` con
`x-cron-secret` y `{"includeTrashCleanup":false}`.

El cron libera reservas vencidas sin pago. No mueve ni elimina registros de la
papelera. La limpieza antigua requiere una llamada autenticada con
`{"includeTrashCleanup":true}` y no está programada. Los horarios dependen del
calendario de GitHub Actions y pueden retrasarse.

### Respaldos cifrados

`.github/workflows/backup.yml` exporta Firestore los domingos a las **03:00 UTC**
—sábados a las 22:00 en Lima— y admite ejecución manual. Requiere credenciales
Firebase de servidor, el ID de base correspondiente y `BACKUP_ENCRYPTION_KEY`,
una clave de 32 bytes representada por 64 caracteres hexadecimales.

Exporta **products, orders, settings y counters**, cifrados con AES-256-GCM. El
artefacto `firestore-backup-encrypted` se conserva 30 días. Solo se publican
archivos `.json.enc` y la tarea falla si falta la clave. No es una copia de todas
las colecciones ni incluye los archivos de Cloudinary.

Para exportar localmente con las credenciales de la aplicación:

```bash
node --env-file=.env.local --import tsx scripts/backup.ts
```

La exportación local es JSON legible salvo que también se cargue la clave.
Para cargar la clave de recuperación guardada aparte:

```bash
node --env-file=.env.local --env-file=.env.backup.local --import tsx scripts/backup.ts
```

`npm run backup:run` funciona cuando las variables ya están cargadas en el
proceso, como en el workflow. `.env.backup.local` se excluye de Git y del
despliegue. Conserva otra copia segura: GitHub no permite recuperar el valor de
un secreto y un respaldo cifrado sin su clave no se puede recuperar.

Para descifrar un archivo descargado del artefacto:

```bash
node --env-file=.env.backup.local --import tsx scripts/decrypt-backup.ts backup/out/orders.json.enc backup/out/orders-recovered.json
```

El comando verifica el cifrado y crea un JSON nuevo sin sobrescribir archivos.
No importa datos a Firestore; la restauración de la base de datos es manual.
