# Fuentes locales

Roboto y Roboto Condensed conservan los archivos WOFF2 del subconjunto latino
que ya utilizaba la tienda, con los pesos 400, 500 y 700. Se sirven mediante
`next/font/local` para que la compilación no dependa de descargar Google Fonts.

Los archivos se distribuyen con sus licencias SIL Open Font License 1.1:

- [Roboto](OFL-Roboto.txt), [origen oficial](https://github.com/google/fonts/tree/main/ofl/roboto).
- [Roboto Condensed](OFL-RobotoCondensed.txt), [origen oficial](https://github.com/google/fonts/tree/main/ofl/robotocondensed).

Bebas Neue, usada por los títulos y la marca, se sirve desde
`public/fonts/bebas-neue-latin-v16.woff2` con `@font-face` y precarga en el
layout. Conserva el nombre de familia y el aspecto existente sin pedir una hoja
de estilos a Google en cada visita. El archivo latino oficial ocupa 13,8 KB.
Su [licencia](../../../public/fonts/OFL-BebasNeue.txt) y el
[origen oficial](https://github.com/google/fonts/tree/main/ofl/bebasneue)
se conservan junto a la fuente. No se necesitan descargas de fuentes para compilar.
