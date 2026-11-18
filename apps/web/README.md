# @chromatic-wheel/web

La PWA: una web instalable que funciona sin conexión, hecha con React, Vite y vite-plugin-pwa. Solo se encarga de la presentación: la rueda vive en `@chromatic-wheel/color-wheel` y la lógica del catálogo, en `@chromatic-wheel/domain`.

Todavía no tiene lógica. Integrará la rueda, el filtro de marcas y las pinturas más parecidas a cada color, y cargará `public/catalog.json`, que genera `catalog-builder`.

Los comandos están en el [README de la raíz](../../README.md#comandos).

## Documentación

- Uso de la rueda y de la búsqueda en la web: [docs/06](../../docs/06-pinturas-parecidas.md) §7.
- Formato y carga del catálogo: [docs/02](../../docs/02-esquema-catalog-json.md).
