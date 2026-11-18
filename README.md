# rueda-cromatica

App personal para pintar miniaturas de Warhammer, en forma de PWA instalable que funciona sin conexión. Tiene dos funcionalidades:

1. **Rueda de color** que funciona como una física, con una plantilla giratoria. Genera armonías y un esquema de miniatura: base, tríada, complementario, sombra y luz.
2. **Equivalencias** entre pinturas de distintas marcas.

## Paquetes

| Paquete                                                          | Qué es                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`packages/color-wheel`](packages/color-wheel/README.md)         | La rueda de color: cálculos y componente, sin pinturas                     |
| [`packages/domain`](packages/domain/README.md)                   | El modelo del catálogo de pinturas y la búsqueda de las pinturas parecidas |
| [`packages/catalog-builder`](packages/catalog-builder/README.md) | El script que importa las fuentes de datos y genera `catalog.json`         |
| [`apps/web`](apps/web/README.md)                                 | La PWA                                                                     |

Las especificaciones están en `docs/` y las decisiones de arquitectura, en `docs/adr/`, con su [índice](docs/adr/README.md).

## Instalación

Solo hace falta tener [pnpm](https://pnpm.io/installation). Al ejecutarlo en el repositorio, cambia solo a la versión fijada en `packageManager` y descarga el Node de `devEngines.runtime` ([ADR-0009](docs/adr/0009-toolchain-pnpm-node.md)).

```sh
pnpm install
```

Los tests de navegador de `color-wheel` y `apps/web`, y los de extremo a extremo de `apps/web`, necesitan Chromium:

- `pnpm --filter @chromatic-wheel/color-wheel install-browsers` (la versión recortada para tests) y `pnpm --filter @chromatic-wheel/web install-browsers` (Chromium completo y Firefox, para los tests de extremo a extremo), una vez y cada vez que cambie la versión de Playwright;
- en WSL, además, las librerías del sistema: `pnpm --filter @chromatic-wheel/color-wheel exec playwright install-deps chromium`, que pide la contraseña de `sudo`.

## Comandos

Desde la raíz:

- `pnpm install`: instala las dependencias. La CI usa `--frozen-lockfile`.
- `pnpm lint`: ESLint con tipos en todo el monorepo.
- `pnpm format` / `pnpm format:check`: aplica o comprueba el formato de Prettier.
- `pnpm typecheck`: `tsc` en la raíz y en cada paquete.
- `pnpm test`: Vitest en `domain`, `catalog-builder`, `color-wheel` y `apps/web`. Los proyectos de navegador necesitan Chromium (ver «Instalación»).
- `pnpm build`: build de `color-wheel` (Vite en modo librería y `tsc`) y de `apps/web` (Vite, prerenderizado de cada página y PWA). `SITE_ORIGIN` da el origen de las URL absolutas de la web.
- `pnpm --filter @chromatic-wheel/web test:e2e`: tests de extremo a extremo de la web compilada, con Playwright. Antes hay que ejecutar `pnpm build`.
- `pnpm docs:api`: genera la referencia de la API de `color-wheel` y `domain` en `dist/reference/`, que se abre con `dist/reference/index.html`. Falla si TypeDoc da algún aviso ([ADR-0023](docs/adr/0023-documentacion-tecnica.md)).
- `pnpm --filter @chromatic-wheel/web dev`: servidor de desarrollo de la web, que renderiza cada página como el build.
- `pnpm --filter @chromatic-wheel/web preview`: sirve la web compilada en `http://localhost:4173/`.
- `pnpm --filter @chromatic-wheel/color-wheel dev`: página de pruebas de la rueda, con el código fuente ([docs/05](docs/05-rueda-de-color.md) §8.4). Con `--host`, para abrirla desde el móvil.
- `pnpm --filter @chromatic-wheel/catalog-builder build-catalog`: regenera `apps/web/public/catalog.json` a partir de los datos. Con `--check` no escribe nada y falla si el versionado está desactualizado.
- `pnpm --filter @chromatic-wheel/catalog-builder import-simogecko`: importa Citadel de la tabla de SimoGecko a `data/brands/citadel.json`. Se ejecuta a demanda; después, `pnpm format` y `build-catalog`.
- `pnpm --filter @chromatic-wheel/catalog-builder import-donnervs <brand-id>`: igual, para una marca desde los datos de DonnervS.
- `pnpm --filter <paquete> <script>`: ejecuta un script de un paquete concreto.
