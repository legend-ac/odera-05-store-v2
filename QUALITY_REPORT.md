# Evidencia de calidad — ODERA 05 STORE

## Puerta de calidad

Antes de una entrega se ejecuta una verificación reproducible:

```bash
npm run test:quality
```

La orden integra pruebas unitarias, cobertura del núcleo crítico, flujo E2E público, verificación TypeScript y compilación de producción aislada.

## Alcance verificado

| Capa | Evidencia | Resultado actual |
| --- | --- | --- |
| Reglas de negocio | Stock, precios, cupones, idempotencia, estados, búsqueda y exportación | 22 pruebas unitarias |
| Rutas críticas | Crear pedido, registrar pago, recuperar carrito y Libro de Reclamaciones | 12 pruebas unitarias |
| Recorrido público E2E | Catálogo → ficha → añadir al carrito → carrito → checkout | Chrome de escritorio y móvil |
| Tipado | Compilación estática TypeScript | Sin errores |

## Cobertura medida

La cobertura se mide sobre el límite unitario mantenido: reglas de pedido, inventario, pago, carrito y Libro de Reclamaciones. No se incluyen artificialmente el panel administrativo, scripts de mantenimiento o componentes puramente visuales.

Mínimos bloqueantes configurados:

- Líneas y sentencias: 50%
- Ramas: 50%
- Funciones: 80%

En la última ejecución el núcleo alcanzó **53.83%** de líneas/sentencias, **61.80%** de ramas y **86.36%** de funciones. Las reglas de negocio (`src/lib`) alcanzaron **98.24%** de líneas y la ruta del Libro de Reclamaciones alcanzó **100%**.

## Alcance intencional del E2E

La prueba E2E navega hasta checkout, pero no confirma un pedido ni sube un comprobante. Así se valida el recorrido de compra sin crear pedidos, enviar correos o alterar inventario en un entorno compartido. La confirmación de pago está cubierta a nivel de ruta con Firestore simulado.

## Información visible al consumidor

El sitio ofrece enlaces visibles a términos y condiciones, privacidad, envíos, cambios y devoluciones, ubicación de la tienda y Libro de Reclamaciones. El libro valida datos, registra la solicitud y entrega un código de seguimiento.

## Cómo revisar para la exposición

1. Ejecutar `npm run test:quality` con la tienda local abierta en `http://localhost:3000`.
2. Mostrar `playwright-report/index.html` si se requiere el resultado visual de E2E.
3. Mostrar `coverage/index.html` para el detalle por archivo.
