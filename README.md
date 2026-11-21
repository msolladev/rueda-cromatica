# rueda-cromatica

App personal para pintar miniaturas de Warhammer: una rueda de color que funciona como una física y, para cada color, las pinturas reales más parecidas de cada marca. Es una PWA instalable que funciona sin conexión, en 13 idiomas.

Está publicada en [colorwheel.msolla.dev](https://colorwheel.msolla.dev/).

## Qué hace

- **Rueda de color** continua, con un anillo de tono y un triángulo de blanco y negro, y una plantilla giratoria. Calcula en el modelo RYB, el de la pintura física, o en el digital. Genera las armonías (complementario, complementario dividido, análogos, análogos con acento, tríada, tétrada, cuadrado y monocromático) y un esquema de miniatura: la base con su sombra y su luz, su tríada y su complementario, con mezclas que simulan pigmentos.
- **Pinturas parecidas**: para cada color, las pinturas más cercanas de cada marca por ΔE CIEDE2000, o las más cercanas de todas, con filtros por marca y tipo, y una etiqueta de cercanía. Avisa cuando el color de una pintura es aproximado.
- **Buscador de pinturas**: se busca una pintura que se tiene, por su nombre, su código o su marca, y su color pasa a ser la base de la rueda.
- **Catálogo** de las líneas vigentes de Warhammer Colour (antes Citadel), Vallejo, The Army Painter y AK Interactive: unas 1400 pinturas.
- **Preferencias** (marcas, filtros, vista, tema, idioma, rueda y la pintura elegida) guardadas en el navegador.

Las equivalencias oficiales entre marcas, las líneas descatalogadas y las cuentas de usuario llegan en fases posteriores. La hoja de ruta está en el [CLAUDE.md](CLAUDE.md#estado-y-hoja-de-ruta), y el alcance del MVP, razonado en el [ADR-0019](docs/adr/0019-alcance-minimo-mvp.md).

## Paquetes

| Paquete                                                          | Qué es                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`packages/color-wheel`](packages/color-wheel/README.md)         | La rueda de color: cálculos y componente, sin pinturas                                             |
| [`packages/domain`](packages/domain/README.md)                   | El modelo del catálogo de pinturas, la búsqueda de las pinturas parecidas y la búsqueda por nombre |
| [`packages/catalog-builder`](packages/catalog-builder/README.md) | El script que importa las fuentes de datos y genera `catalog.json`                                 |
| [`apps/web`](apps/web/README.md)                                 | La PWA                                                                                             |

## Documentación

Las especificaciones describen cómo funciona hoy cada parte; los ADR, por qué se decidió así.

- [docs/01](docs/01-modelo-dominio.md): el modelo del dominio.
- [docs/02](docs/02-esquema-catalog-json.md): el formato de `catalog.json`.
- [docs/03](docs/03-identificadores.md): los identificadores y su estabilidad.
- [docs/04](docs/04-datos-curados.md): los datos del catálogo y sus fuentes.
- [docs/05](docs/05-rueda-de-color.md): la rueda de color.
- [docs/06](docs/06-pinturas-parecidas.md): las pinturas parecidas y la búsqueda por nombre.
- [docs/07](docs/07-web.md): la web.
- [docs/08](docs/08-despliegue.md): el despliegue y cómo volver atrás.
- [docs/adr](docs/adr/README.md): las decisiones de arquitectura, con su índice.
- [docs/investigacion](docs/investigacion/README.md): los informes de investigación, fechados.
- La referencia de la API de `color-wheel` y `domain` se genera con `pnpm docs:api` y se publica en `/reference/` de la web.

## Ramas y despliegue

El trabajo entra en `preprod` con un PR fusionado con _squash_, y cada push a `preprod` despliega en preproducción si pasa la CI. `preprod` llega a `main` con un PR fusionado con un commit de merge, y cada push a `main` despliega en producción y crea la etiqueta `release/` de la publicación. Los dos entornos están en un homelab. El detalle, en [docs/08](docs/08-despliegue.md).

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
- `pnpm --filter @chromatic-wheel/catalog-builder build-catalog`: regenera `apps/web/public/catalog.json` a partir de los datos, y falla sin escribir nada si un ID publicado desaparece sin lápida o si reaparece uno retirado ([docs/03](docs/03-identificadores.md) §6-7). Con `--check` no escribe nada y falla si el versionado está desactualizado.
- `pnpm --filter @chromatic-wheel/catalog-builder import-simogecko`: importa Citadel de la tabla de SimoGecko a `data/brands/citadel.json`. Se ejecuta a demanda; después, `pnpm format` y `build-catalog`.
- `pnpm --filter @chromatic-wheel/catalog-builder import-donnervs <brand-id>`: igual, para una marca desde los datos de DonnervS.
- `pnpm --filter @chromatic-wheel/catalog-builder --silent next-release-tag`: escribe la etiqueta de una publicación hecha hoy ([docs/03](docs/03-identificadores.md) §7). La usa el despliegue a producción.
- `pnpm --filter <paquete> <script>`: ejecuta un script de un paquete concreto.
