# @chromatic-wheel/web

La PWA: una web instalable que funciona sin conexión, hecha con React, Vite y vite-plugin-pwa. Integra la rueda de `@chromatic-wheel/color-wheel` y, para cada color, busca con `@chromatic-wheel/domain` las pinturas más parecidas de cada marca en `public/catalog.json`, que genera `catalog-builder`. Un buscador de pinturas, sobre la rueda, lleva a la rueda el color de una pintura que se tiene, y muestra sus equivalencias oficiales en otras marcas. Solo presenta: la lógica vive en esos dos paquetes.

Está en 13 idiomas (`/es/`, `/en/`…), y cada página se prerenderiza en el build, así que su contenido y sus metadatos llegan sin JavaScript.

## Desarrollo

Desde la raíz del repositorio:

```sh
pnpm --filter @chromatic-wheel/web dev
```

Abre `http://localhost:5173/`, que lleva al idioma del navegador. El servidor de desarrollo renderiza cada página igual que el build y usa el código fuente de `color-wheel` y `domain`, sin compilarlos.

## Build y tests

- `pnpm build` (desde la raíz) compila `color-wheel` y la web, que acaba en `dist/`: una página por idioma, `sitemap.xml`, `robots.txt` y el service worker. La variable `SITE_ORIGIN` (por ejemplo, `https://example.org`) da el origen de las URL absolutas; sin ella, el de `vite preview`.
- `pnpm --filter @chromatic-wheel/web preview` sirve `dist/` en `http://localhost:4173/`.
- `pnpm --filter @chromatic-wheel/web test` ejecuta los tests de Node y de navegador. Los de navegador necesitan Chromium (ver el [README de la raíz](../../README.md#instalación)).
- `pnpm --filter @chromatic-wheel/web test:e2e` ejecuta los tests de extremo a extremo sobre `dist/`, así que antes hay que compilar.

## Documentación

- Especificación: [docs/07](../../docs/07-web.md).
- Decisiones: [ADR-0024](../../docs/adr/0024-web.md) y, para el buscador, [ADR-0029](../../docs/adr/0029-buscador-pinturas-mvp.md).
- Uso de la rueda: [docs/05](../../docs/05-rueda-de-color.md) §6; búsqueda de pinturas parecidas y por nombre: [docs/06](../../docs/06-pinturas-parecidas.md); formato y carga del catálogo: [docs/02](../../docs/02-esquema-catalog-json.md).
