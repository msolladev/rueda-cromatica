# rueda-cromatica

App personal para pintar miniaturas de Warhammer, en forma de PWA. Tiene dos funcionalidades:

1. **Rueda de color** que funciona como una física, con una plantilla giratoria. Genera armonías y un esquema de miniatura: base, sombra, luz y acento.
2. **Equivalencias** entre pinturas de distintas marcas.

Es un proyecto de aprendizaje del ecosistema Node/TS: prioriza las buenas prácticas sobre los atajos.

## Stack y herramientas

- **Plataforma**: PWA instalable y offline, sin app nativa. React + Vite + TypeScript (strict) + vite-plugin-pwa, sin Next.
- **Monorepo**: pnpm workspaces, sin orquestador (Turborepo, Nx) mientras no haga falta.
- **Versiones fijadas de forma exacta** en `package.json`: Node en `devEngines.runtime` (lo gestiona pnpm) y pnpm en `packageManager`. Nunca rangos ni "latest". Solo se actualizan mediante un PR validado por la CI ([ADR-0009](docs/adr/0009-toolchain-pnpm-node.md)).
- **Calidad**: ESLint 10 (_flat config_, `typescript-eslint` con `strictTypeChecked`) y Prettier. ESLint no se encarga del formato ([ADR-0010](docs/adr/0010-lint-formato.md)).
- **TypeScript 6.0**, no la 7: `typescript-eslint` exige `<6.1.0`. Se sube cuando lo admita.
- **Madurez de dependencias**: `minimumReleaseAge` de 7 días en `pnpm-workspace.yaml`, y `cooldown` equivalente en Dependabot. Las versiones compartidas entre paquetes van en el `catalog:` de pnpm.
- **Tests**: Vitest, obligatorios en `domain` y `catalog-builder`.
- **CI/CD**: GitHub Actions ([ADR-0011](docs/adr/0011-ci-cd.md)).
- **Entornos**: desarrollo en WSL 2, preproducción en el homelab y producción por decidir ([ADR-0012](docs/adr/0012-entornos.md)).

## Estructura objetivo

El monorepo está montado. `domain` ya tiene el contrato del catálogo (esquema, `parseCatalog`, agregado `Catalog` y reglas derivadas) y `catalog-builder` genera `catalog.json`; `apps/web` todavía no tiene lógica. La separación en paquetes, la organización interna por módulos y los patrones están en el [ADR-0018](docs/adr/0018-organizacion-codigo-patrones.md).

- `packages/domain`: TS puro, con el modelo, las armonías, las conversiones, el Delta E (culori) y la validación del catálogo (Zod). Sin dependencias de React ni del navegador.
- `packages/catalog-builder`: script Node que importa las fuentes, las normaliza (culori para el punto medio de los degradados) y genera `catalog.json`. Arquitectura hexagonal en sus bordes (disco y red).
- `apps/web`: React, solo presentación. La lógica vive en el dominio.
- `docs/`: especificaciones, y `docs/adr/` con los ADR.
- Futuro, en la fase 6 ([ADR-0017](docs/adr/0017-arquitectura-objetivo-backend.md)):
  - `apps/api`: backend REST con base de datos, que expone la instantánea pública del catálogo.
  - `apps/admin`: frontal de mantenimiento del catálogo.
  - `packages/importers`: la importación de fuentes, extraída de `catalog-builder`.

## Comandos

Desde la raíz. pnpm cambia solo a la versión de `packageManager` y descarga el Node de `devEngines.runtime`.

- `pnpm install`: instala las dependencias. La CI usa `--frozen-lockfile`.
- `pnpm lint`: ESLint con tipos en todo el monorepo.
- `pnpm format` / `pnpm format:check`: aplica o comprueba el formato de Prettier.
- `pnpm typecheck`: `tsc` en la raíz y en cada paquete.
- `pnpm test`: Vitest en `domain` y `catalog-builder`.
- `pnpm build`: build de `apps/web` (Vite + PWA).
- `pnpm --filter @rueda-cromatica/web dev`: servidor de desarrollo.
- `pnpm --filter @rueda-cromatica/catalog-builder build-catalog`: regenera `apps/web/public/catalog.json` a partir de los datos. Con `--check` no escribe nada y falla si el versionado está desactualizado.
- `pnpm --filter @rueda-cromatica/catalog-builder import-simogecko`: importa Citadel de la tabla de SimoGecko a `data/brands/citadel.json`. Se ejecuta a demanda; después, `pnpm format` y `build-catalog`.
- `pnpm --filter @rueda-cromatica/catalog-builder import-donnervs <brand-id>`: igual, para una marca desde los datos de DonnervS.
- `pnpm --filter <paquete> <script>`: ejecuta un script de un paquete concreto.

## Catálogo

- `catalog.json` lo genera el builder, se versiona en el repositorio y es determinista (sin marcas de tiempo).
- Va en el precaché de Workbox: el service worker solo lo vuelve a descargar cuando cambia su revisión.
- Se carga con `fetch` y se valida al cargarlo. No se importa en el bundle.
- El detalle está en [docs/02-esquema-catalog-json.md](docs/02-esquema-catalog-json.md).

## Reglas de dominio

- **Equivalencias oficiales**: aristas dirigidas (origen → destino) con una fuente del fabricante obligatoria. No se infieren ni las inversas ni las transitivas.
- **Equivalencias calculadas**: CIEDE2000 en el cliente. No se guardan en el JSON.
- **Color aproximado**: un hex es aproximado si la pintura es metálica, si su tipo es lavado, tinta, veladura, contrast o técnica, o si el hex es de origen comunitario. Se calcula en el dominio; en el JSON solo se guardan el origen y la fuente del hex. No se ofrecen equivalencias calculadas con colores aproximados sin avisar.
- **Origen del color**: un único hex por pintura, con su origen (`measured`, `manufacturer` o `community`) y su fuente. Los degradados oficiales de Citadel se reducen a su punto medio en CIELAB ([ADR-0014](docs/adr/0014-origen-seleccion-color.md)). En el MVP cada pintura tiene una sola fuente de color ([ADR-0019](docs/adr/0019-alcance-minimo-mvp.md)).
- **Sustitución frente a equivalencia**: solo hay sustituta si la fuente del fabricante dice que X sustituye a Y. Las cartas de conversión son equivalencias oficiales.
- **Sombra**: es una variación de la base (menos luminosa, menos saturada y con un ligero cambio de tono), no el complementario tal cual. El complementario y las tríadas se usan para el secundario y el acento.
- **Rueda**: calcula en modelo RYB (el de la pintura física) o digital (RGB/HSL), a elección del usuario. Devuelve el color teórico y la pintura real más parecida, filtrando por las marcas activas.
- **Pintura**:
  - Tipo según su función: base, capa, estándar (opaca sin distinción base/capa), lavado, tinta, veladura, contrast (función de una capa, de cualquier marca), técnica o pincel seco ([ADR-0013](docs/adr/0013-clasificacion-pinturas.md)).
  - Metálica, como atributo independiente del tipo.
  - Estado: activa o descatalogada. Si está descatalogada, con su sustituta y la fuente del fabricante, si las hay.
- **IDs**: slugs jerárquicos (`marca/gama/pintura`) que se generan una vez y nunca se recalculan. El código no los descompone.

El modelo completo está en [docs/01-modelo-dominio.md](docs/01-modelo-dominio.md) y los IDs en [docs/03-identificadores.md](docs/03-identificadores.md).

## Alcance

El alcance mínimo y lo aplazado están razonados en el [ADR-0019](docs/adr/0019-alcance-minimo-mvp.md).

- **MVP**: la rueda y, para cada uno de sus colores, las pinturas más parecidas de cada marca, con funcionamiento offline.
  - **Armonías**: complementario, complementario dividido, análogos, análogos con acento, tríada, tétrada rectangular, cuadrado y monocromático, además del esquema de miniatura.
  - **Equivalencias**: solo las calculadas. Las oficiales están aplazadas a la fase 5.
- **Marcas y líneas del MVP**, solo las vigentes:
  - Warhammer Colour, antes Citadel: Base, Layer, Shade, Contrast, Technical y Dry.
  - Vallejo: Model Color y Game Color, con sus subfamilias e incluido Xpress Color.
  - Army Painter: Warpaints Fanatic y Speedpaint 2.0.
  - AK: 3rd Gen y Quick Gen.
  - Fuera del catálogo: productos sin color (mediums, barnices, diluyentes).
- **Futuro** (no implementar sin pedirlo): mi colección, recetas, lista de la compra, cuentagotas sobre foto, sugerencia de lavados, mezclas, Tone Pro, líneas de aerógrafo, Spray, Speedpaint 1.0 y búsqueda por código antiguo.
- **Búsqueda por nombre**, cuando se haga: sin distinguir mayúsculas, apóstrofos ni acentos y por fragmentos (`tigers skin` encuentra «Tiger's Eye Skin»). Después, tolerante a faltas de ortografía (`boney` encuentra «Bony»). Con eso sobran los alias que hoy cubren erratas, como «Nurgles Rot», «Tigers Eye Skin» y «Boney Spikes».
- Si una propuesta se sale del MVP, indícalo antes de implementarla.

## Estado y hoja de ruta

1. **Arquitectura y modelo de datos**: cerrada. Ver docs/01-03 y los ADR 0001-0008.
2. **Montar el monorepo y la toolchain**, según los ADR 0009-0011: hecho.
3. **Investigación de fuentes de datos**: cerrada. Ver el [informe](docs/investigacion/2026-11-fuentes-datos.md), docs/04 y los ADR 0013-0016.
4. **Builder, importadores y prototipo de la rueda**: en curso, con el alcance del [ADR-0019](docs/adr/0019-alcance-minimo-mvp.md). Etapas:
   1. Contrato del catálogo en `domain`: hecho.
   2. Builder mínimo según docs/04, con el paso 4 de la CI: hecho.
   3. Datos: una marca desde una sola fuente y después el resto, una por iteración. Citadel: hecho, desde la tabla de SimoGecko con hex `community`, porque citadelcolour.com (hoy paint.warhammer.com) no publica los hex. The Army Painter: hecho, desde DonnervS con hex `community`; Warpaints Fanatic es una sola gama (lavados, metálicos y efectos se distinguen por el tipo y el atributo metálico). AK Interactive: hecho, desde DonnervS con hex `community`; 3Gen Acrylics es una sola gama con todas las etiquetas de AK (STANDARD, AFV, FIGURES…) salvo AIR, que es de aerógrafo; Quick Gen tiene 79 colores, comprobado en la web de AK.
   4. Color en `domain`: los dos modelos de rueda, las armonías, el esquema de miniatura y el ΔE.
   5. Web: la rueda con su plantilla, el selector de modelo, el filtro de marcas, el aviso de color aproximado y la carga del catálogo.

   Al curar los datos hay que verificar:
   - La retirada de 25 Contrast en 2026. Mientras GW no la confirme, no se marcan como `discontinued`.
   - El reparto en gamas de Vallejo; por ejemplo, si Xpress Color es una gama propia o parte de Game Color. Se aplica la regla de una gama por línea de venta ([ADR-0013](docs/adr/0013-clasificacion-pinturas.md)).

   Los importadores se escriben como funciones puras (fuente → filas), sin acceso a disco dentro de la lógica, para poder reutilizarlos en la fase 6.

5. **Catálogo completo**, aplazado del MVP ([ADR-0019](docs/adr/0019-alcance-minimo-mvp.md)):
   - Equivalencias oficiales y sustituciones, incluida la carta de GW de 2012 si existe una copia fiel ([ADR-0015](docs/adr/0015-fuentes-trazabilidad-licencias.md)).
   - Líneas descatalogadas: las antiguas de Citadel (Citadel Colour, Foundation, Washes de 2008, tintas, Glaze y Edge) y los Warpaints originales.
   - Datos curados en dos capas, con transcripciones literales, claves por documento y exclusiones.
   - Varios candidatos de color por pintura, con prioridad `measured` > `manufacturer` > `community` y elección manual.
   - Desactivación de fuentes con su resumen de cambios, y el script `archive-sources` (Wayback Machine y SHA-256).

   Las lápidas y el test de estabilidad de IDs no esperan a esta fase: se implementan antes de la primera publicación.

6. **Backend, administración del catálogo y sesiones de usuario**, la última fase ([ADR-0017](docs/adr/0017-arquitectura-objetivo-backend.md)). Incluye:
   - Una API REST con base de datos y una web de administración del catálogo, con el frontal y el backend separados.
   - Una instantánea pública del catálogo, pedida por versión de esquema, para que la PWA actualice su catálogo local sin volver a desplegarse. De la API, la PWA solo consume esa instantánea y los endpoints de usuario. La API de administración solo la usa `apps/admin`.
   - Cuentas, sesiones y roles (usuario y administrador), gestionados desde `apps/admin`, con los datos del usuario sincronizados entre dispositivos y offline primero.

Pendiente fuera de la hoja de ruta: provisionar la preproducción en el homelab y decidir dónde va producción. Antes de cualquier despliegue público hay que revisar las fuentes con licencia `unknown` o `terms-of-use`.

## Documentación

- **Fuente de verdad**: el repositorio. Las especificaciones están en `docs/` y los ADR en `docs/adr/` (un fichero por ADR; el README tiene el índice y las normas).
- **Este documento** recoge las decisiones vigentes. El proyecto de claude.ai lo carga desde GitHub junto con docs/01-04.
- **Informes de investigación**: en `docs/investigacion/`, fechados e inmutables. Las normas están en su [README](docs/investigacion/README.md).
- **Especificaciones y ADR**: las especificaciones describen lo vigente; los ADR, por qué se decidió. Un ADR aceptado no se reescribe: se sustituye por otro nuevo.

## Reglas de trabajo

- No inventes valores hex, códigos de pintura ni equivalencias oficiales. Si un dato no procede de una fuente verificable, dilo.
- Justifica cada dependencia que añadas y prefiere pocas y mantenidas.
- Documenta las decisiones de arquitectura relevantes como ADR breves en `docs/adr/`, siguiendo su README.
- Si una decisión nueva contradice este documento, avísame para actualizarlo.
- Antes de crear ficheros o estructura que no estén previstos en `docs/` o en este documento, confirma conmigo dónde van.

## Comunicación

- Responde en castellano de España. El código va en inglés y la documentación en castellano.
- Respuestas breves y concisas, salvo que pida detalle.
- No me des la razón por defecto: defiende la mejor solución técnica.
- Si necesitas que decida algo, plantea opciones concretas y explica qué implica cada una.
- Si no puedes hacer exactamente lo que pido, dilo en lugar de hacer otra cosa. No ejecutes tareas pesadas sin preguntar.
- Al explicar quién hace cada cosa, nombra a las personas o elementos en lugar de usar «tú» y «yo». Ejemplo: «Miguel crea el repositorio, Claude Code instala las dependencias, la CI ejecuta los tests».
