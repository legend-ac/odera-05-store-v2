# Evidencia de calidad — ODERA 05 STORE

Última verificación: 17 de octubre de 2026.

## Puerta de calidad

Antes de una entrega se ejecuta una verificación reproducible:

```bash
npm run test:quality
```

La orden integra pruebas unitarias, cobertura del núcleo crítico, flujo E2E público, verificación TypeScript y compilación de producción aislada.

## Alcance verificado

| Capa | Evidencia | Resultado actual |
| --- | --- | --- |
| Reglas y esquemas | Stock, envíos, idempotencia, búsqueda, seguimiento, metadatos, configuración comercial, CSRF y entrega de correo | 82 pruebas unitarias |
| Rutas y páginas de servidor | Reservas, comprobantes, carrito, Libro de Reclamaciones y metadatos de producto | 32 pruebas unitarias |
| Automatizaciones y respaldo | Autenticación del cron, limpieza explícita, liberación por talla, pago recibido, cifrado y rechazo de claves/datos alterados | 25 pruebas adicionales; 139 unitarias en total |
| Recorrido público E2E | Inicio e hidratación; catálogo → ficha → carrito → checkout; reserva y comprobante; vencimiento; imágenes agotadas y recuperación | 14 pruebas en Chrome de escritorio y móvil |
| Tipado | Compilación estática TypeScript | Sin errores |
| Revisión de código | `npm run lint` | Sin errores; una advertencia existente de fuente externa |
| Producción | Compilación aislada con `npm run build:verify` | Correcta |
| Correo local | Plantilla y envío por SMTP a receptor local, con HTML y texto | Correcto; ningún destinatario externo |
| Gmail configurado | Conexión y autenticación sin enviar correo | Rechazado: `535 / EAUTH` |
| Cloudinary configurado | Carga real de PNG de prueba y lectura desde CDN | Correcto |
| Seguridad de producción | `npm run audit:production` | 0 críticas, 0 altas; 8 moderadas pendientes |
| Firestore actualizado | Lectura real de configuración con el SDK cliente y el parche gRPC | Correcta; ninguna escritura |

## Cobertura medida

La cobertura se mide sobre el límite unitario mantenido: reglas de pedido, inventario, pago, carrito y Libro de Reclamaciones. No se incluyen artificialmente el panel administrativo, scripts de mantenimiento o componentes puramente visuales.

Mínimos bloqueantes configurados:

- Líneas y sentencias: 50%
- Ramas: 50%
- Funciones: 80%

En la última medición de cobertura, las **114 pruebas unitarias** pasaron con Vitest 4.1.12. El núcleo alcanzó **94.62%** de líneas, **91.33%** de sentencias, **76.29%** de ramas y **95.23%** de funciones. Las reglas de negocio (`src/lib`) alcanzaron **99.07%** de líneas. La cobertura incluye metadatos de productos, información comercial, entrega de correo, lectores de enlaces, envío y esquemas de reserva/pago. Se agregaron seis casos de cookies/CSRF asíncronos y cinco casos de errores SMTP permanentes y temporales. Después se añadieron 25 pruebas del cron y del cifrado: la ejecución más reciente pasó **139 pruebas en 22 archivos**; no se recalculó la cobertura con esos casos.

## Actualización de seguridad

Se actualizaron Next.js a **15.5.28**, React/React DOM a **19.3.1**, Nodemailer a **10.1.2**, Firebase a **11.10.0**, Firebase Admin a **13.10.0** y Vitest/cobertura a **4.1.12**. Las dependencias transitivas con parches compatibles también se actualizaron. Tailwind permanece en la rama 3 (**3.4.19**) para conservar los estilos actuales.

La migración adapta cookies, CSRF, parámetros de páginas y metadatos a las API asíncronas de Next.js. Las diecisiete rutas que comprueban CSRF esperan esa validación antes de continuar. Se siguió la [guía oficial de Next.js 15](https://nextjs.org/docs/app/guides/upgrading/version-15).

Se aplican dos reemplazos acotados en `package.json`: PostCSS **8.5.30** dentro de Next.js y gRPC **1.13.7** dentro del SDK cliente de Firestore. Este último conserva la rama principal 1 y `proto-loader` 0.7; se comprobó una lectura pública real sin escrituras. [Publicación oficial de gRPC 1.13.7](https://github.com/grpc/grpc-node/releases/tag/@grpc%2Fgrpc-js@1.13.7).

| Auditoría npm | Antes | Después |
| --- | --- | --- |
| Producción | 32 dependencias afectadas: 3 críticas, 10 altas, 18 moderadas y 1 baja | 8 moderadas; 0 altas y 0 críticas |
| Completa, incluidas herramientas | 57 dependencias afectadas: 6 críticas, 26 altas, 24 moderadas y 1 baja | 17: 7 altas, 10 moderadas y 0 críticas |

Estos números cuentan paquetes afectados y propagación por dependencias, no fallos independientes comprobados en la tienda. La auditoría de producción pasa con `npm run audit:production`, que falla si aparecen alertas altas o críticas. Los resultados resumidos se conservan aquí; los JSON temporales se retiraron durante la limpieza del proyecto y la auditoría se puede repetir con ese comando.

Los ocho avisos moderados de producción proceden de `uuid` y su cadena en los SDK de Google. No se forzaron versiones mayores internas ni se degradó Firebase para ocultarlos. Las siete alertas altas restantes pertenecen a herramientas de desarrollo: la cadena de patrones de archivos de Tailwind y ESLint. No hay parche compatible para `braces` en Tailwind 3; queda pendiente una migración de herramientas con revisión visual. El [reporte del mantenedor de braces](https://github.com/micromatch/braces/issues/70) describe el riesgo con patrones no confiables; la configuración de esta tienda usa archivos locales.

El entorno de verificación usa Node **20.18.0**. npm avisa que una dependencia del analizador ESLint (`eslint-visitor-keys` 5) declara Node **20.19** como mínimo de la rama 20. Las comprobaciones pasaron en este equipo; conviene usar una versión de Node admitida por todas las herramientas en CI. No se modificó la instalación global de Node.

## Alcance intencional del E2E

La prueba del catálogo real navega hasta checkout sin crear pedidos. Los nuevos casos de reserva y pago interceptan las API de escritura y Cloudinary y usan datos de muestra: comprueban que no se solicite comprobante antes de reservar, que se muestre el importe confirmado por el servidor y que una reserva vencida o con pago recibido no permita pagar otra vez. No crean pedidos reales, no envían correos ni modifican inventario. Las pruebas unitarias de las rutas ejecutan sus transacciones con Firestore simulado.

La reserva sin pago dura 20 minutos. Un comprobante recibido conserva el stock hasta la revisión o cancelación del equipo; no se libera automáticamente por el vencimiento del plazo de pago.

Las pruebas de imágenes fuerzan fallos de todas las fotos y comprueban el respaldo en tarjetas, galería y carrito. También verifican que una imagen nueva vuelva a mostrarse aunque la lista conserve el mismo número de fotos. El carrito móvil se comprobó sin desbordamiento horizontal y con el botón de cantidad dentro de la pantalla.

Se agregó una comprobación de hidratación del inicio y navegación al carrito y de regreso. Detecta errores JavaScript y verifica que las redes no se dupliquen en el pie del inicio. El pie mantiene la misma estructura durante SSR y la primera renderización del navegador, y después aplica la variante de la ruta. Se corrigió así la diferencia observada en la página publicada. En la ejecución local más reciente pasaron 13 casos; el restante, que observó una solicitud duplicada de imagen en desarrollo, pasó al repetirlo después de terminar la compilación.

Después de actualizar las dependencias, se capturó el inicio en anchos de **1366 px** y **393 px**: sin errores JavaScript ni desbordamiento horizontal. La foto real del local cargó al desplazarse hasta su sección. Las capturas temporales se retiraron durante la limpieza del proyecto.

## Comprobación de integraciones

`npm run test:integrations` usa la plantilla real y la entrega compartida con producción contra un receptor SMTP en este equipo. Se recibió un mensaje con texto y HTML; no crea pedidos ni envía correo a terceros. La vista generada queda en `integration-results/email-preview.html`.

Con Nodemailer actualizado se repitió esta comprobación local correctamente. Los errores permanentes de autenticación/SMTP 5xx ya no provocan tres intentos; los errores temporales de red y SMTP 4xx conservan el reintento. Esto no sustituye credenciales válidas para Gmail.

`npm run check:providers` es una comprobación manual que autentica SMTP y carga una imagen mínima en Cloudinary. No forma parte de `test:quality`, porque realiza una carga externa real. Los resultados se guardan sin claves en `integration-results/latest.json`.

- **Gmail:** rechazó las credenciales existentes con `535 / EAUTH`. Se revisaron `.env.local`, `.env.vercel.local` y `.env.vercel.prod`: la configuración local y la de producción coinciden; la otra no contiene un par SMTP. No se modificaron esas credenciales. La llegada a una bandeja externa sigue sin verificarse y el envío real queda pendiente de una autenticación válida.
- **Cloudinary:** aceptó y sirvió un PNG generado de 67 bytes, sin datos de clientes ni pedidos. El proveedor no devolvió token de borrado, por lo que el archivo de prueba permanece como `admin-health/integration-checks/vufg60d9w1calzlaqeux`. Su referencia está en el informe local para poder retirarlo desde Cloudinary.

La verificación SMTP comprueba conexión/autenticación, no recepción en una bandeja externa ([Nodemailer](https://nodemailer.com/smtp)). El borrado por token depende de que Cloudinary lo devuelva en la carga ([Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference)).

## Información visible al consumidor

El sitio ofrece enlaces visibles a términos y condiciones, privacidad, envíos, cambios y devoluciones, ubicación de la tienda y Libro de Reclamaciones. Las fichas de zapatillas incluyen una guía de medición del pie en centímetros. El envío conserva la tarifa existente de S/10 y el umbral configurado para envío gratis; se confirma el importe antes del pago. El libro valida datos, registra la solicitud y entrega un código de seguimiento.

En **Ajustes → Tienda** se pueden completar horarios, plazos para Lima y provincias y condiciones de cambios. Los datos se muestran en las páginas correspondientes cuando están configurados; los campos vacíos indican consultar a la tienda. No se publicaron horarios ni plazos inventados. Guardar estos campos preserva las imágenes de categorías.

Las fichas generan título, descripción, Open Graph y Twitter a partir del producto real. Se comprobó un producto público: nombre correcto, foto presente, marca una sola vez y canonical correspondiente. La URL base se obtiene de `NEXT_PUBLIC_SITE_URL`/`SITE_URL` o de las variables de despliegue Vercel; en desarrollo usa localhost. `.env.example` documenta el campo opcional.

## Despliegue y tareas programadas

El dominio de producción es [odera-05-store-v2.vercel.app](https://odera-05-store-v2.vercel.app). Roboto y Roboto Condensed se empaquetan con sus licencias en `src/app/fonts`, evitando que el build dependa de la descarga de esas fuentes. `.vercelignore` excluye archivos de entorno, compilaciones, cachés e informes del paquete de despliegue.

La versión de aplicación `253d813` quedó publicada en Vercel con estado `READY`. Contra el dominio público pasaron los **14 E2E**, sin crear pedidos reales. La revisión adicional comprobó **13 páginas HTTP 200**, el título, imagen y canonical de un producto, ambas fuentes locales HTTP 200 y el inicio en **1366 px** y **393 px**, sin errores JavaScript ni desbordamiento horizontal.

App Check conserva una clave de prueba en producción: el navegador no obtiene un token válido y continúa sin él. Se comprobó que la verificación del servidor está desactivada (`ENABLE_APP_CHECK_VERIFY` no es `true`), por lo que esta configuración no impide llamar a las API. Firestore y los tres enlaces sociales cargaron correctamente. Queda pendiente configurar una clave real antes de activar esa protección; no se cambiaron claves ni se desactivaron protecciones durante el despliegue.

Los workflows `ttl.yml` y `backup.yml`, antes desactivados por inactividad, quedaron **activos y verificados**. La versión de aplicación `33c57b9` se publicó en Vercel con estado `READY` antes de reactivar el cron. Pasaron TypeScript, lint (solo la advertencia de fuente ya existente), compilación y las 139 pruebas unitarias.

- **Reservas:** el cron cada 10 minutos envía `includeTrashCleanup: false`. La llamada sin ese campo también omite la limpieza; solo el booleano explícito `true` permite mover o purgar registros antiguos. La [ejecución comprobada](https://github.com/legend-ac/odera-05-store-v2/actions/runs/39095427952) devolvió HTTP 200, liberó una reserva vencida y confirmó cero registros movidos o borrados. Los pagos recibidos conservan su reserva.
- **Respaldo:** la [ejecución comprobada](https://github.com/legend-ac/odera-05-store-v2/actions/runs/39095415757) generó un artefacto cifrado de 91,388 bytes, con conservación de 30 días. Se descargó y autenticó en memoria cada archivo de `products`, `orders`, `settings` y `counters` con la clave local, sin generar JSON legible ni importar datos a Firestore. Las copias semanales usan AES-256-GCM y requieren `BACKUP_ENCRYPTION_KEY`; solo se suben archivos `.json.enc`.

La clave de recuperación está en `.env.backup.local`, excluida de Git y Vercel, y en un secreto de GitHub. El README explica cómo recuperar un archivo sin sobrescribir exportaciones ni escribir en Firestore. La papelera no tiene limpieza programada. Las comprobaciones temporales se retiran con el comando de limpieza; la clave de recuperación se conserva.

## Apariencia clara y oscura

El administrador puede elegir **Oscuro** o **Claro crema** desde Ajustes → Tienda
y guardar la selección global. La API conserva el tema existente cuando un
cliente antiguo omite el campo, valida las opciones y mantiene la autenticación
administrativa y CSRF. Guardar invalida la caché del tema y del layout; el HTML
inicial y el navegador reciben el mismo valor. El dashboard conserva su paleta
clara local.

Se adaptaron cabecera, pie, inicio, catálogo y fichas, carrito, checkout y pago,
confirmación, seguimiento, reclamos y login. Las fotos mantienen sus colores.
Las comprobaciones locales pasaron **164 pruebas unitarias**, TypeScript,
compilación de producción y **14 E2E** en Chrome de escritorio y móvil. Lint no
reporta errores; conserva la advertencia existente de la fuente externa.

La revisión visual local simuló la paleta clara sin escribir ajustes reales:
10 páginas HTTP 200, fondo crema y texto oscuro, sin errores JavaScript ni
desbordamiento horizontal a 1366 px, e inicio móvil a 393 px. El guardado del tema,
la compatibilidad con ajustes anteriores y la carga del valor para SSR se
verificaron con pruebas unitarias de servidor y API.

La aplicación `552add4` quedó publicada con estado `READY` en el dominio de
producción. Se repitió allí la comprobación de las 10 páginas y la simulación
visual clara en escritorio y móvil, sin errores JavaScript ni desbordamiento.
Todas entregaron el atributo de tema en el HTML inicial. La comprobación no
cambió los ajustes reales: el administrador elige la apariencia al guardar.

## Cómo revisar para la exposición

1. Ejecutar `npm run test:quality` con la tienda local abierta en `http://localhost:3000`.
2. Mostrar `playwright-report/index.html` si se requiere el resultado visual de E2E.
3. Mostrar `coverage/index.html` para el detalle por archivo.

## Limpieza del proyecto

Se retiraron **387.05 MiB** de compilaciones, cachés e informes regenerables, además de dos componentes sin referencias (`ui/card.tsx` y `ui/badge.tsx`). La carpeta de respaldo solo contenía directorios vacíos; no se eliminaron respaldos con datos. Se conservaron imágenes activas, dependencias, pruebas, configuración y variables de entorno.

La limpieza se puede repetir con `npm run clean:generated`; `--dry-run` muestra los objetivos sin borrarlos y `--all` incluye `.next` cuando el servidor está detenido. Las carpetas generadas vuelven a aparecer al usar desarrollo, compilación o pruebas. `npm run typecheck` ahora genera solo los tipos de rutas con `next typegen`, sin construir toda la aplicación. Tras la limpieza pasaron TypeScript y las **114 pruebas unitarias**.
