# rueda-cromatica

Qué es el proyecto, cómo se instala y los comandos están en el README:

@README.md

Es un proyecto de aprendizaje del ecosistema Node/TS: prioriza las buenas prácticas sobre los atajos.

## Stack y herramientas

- **Plataforma**: PWA instalable y offline, sin app nativa. React + Vite + TypeScript (strict) + vite-plugin-pwa, sin Next.
- **Monorepo**: pnpm workspaces, sin orquestador (Turborepo, Nx) mientras no haga falta.
- **Versiones fijadas de forma exacta** en `package.json`: Node en `devEngines.runtime` (lo gestiona pnpm) y pnpm en `packageManager`. Nunca rangos ni "latest". Solo se actualizan mediante un PR validado por la CI ([ADR-0009](docs/adr/0009-toolchain-pnpm-node.md)).
- **Calidad**: ESLint 10 (_flat config_, `typescript-eslint` con `strictTypeChecked`) y Prettier. ESLint no se encarga del formato ([ADR-0010](docs/adr/0010-lint-formato.md)).
- **TypeScript 6.0**, no la 7: `typescript-eslint` exige `<6.1.0`. Se sube cuando lo admita.
- **Madurez de dependencias**: `minimumReleaseAge` de 7 días en `pnpm-workspace.yaml`, y `cooldown` equivalente en Dependabot. Las versiones compartidas entre paquetes van en el `catalog:` de pnpm.
- **Tests**: Vitest, obligatorios en `domain`, `catalog-builder`, `color-wheel` y `apps/web`. El componente de la rueda y la web se prueban en un navegador real (modo navegador de Vitest con Playwright), con axe-core para la accesibilidad; la rueda, además, con entrada real de ratón y táctil. La web compilada tiene tests de extremo a extremo con `@playwright/test`: rutas, contenido sin JavaScript y funcionamiento sin conexión ([ADR-0024](docs/adr/0024-web.md)).
- **CI/CD**: GitHub Actions ([ADR-0011](docs/adr/0011-ci-cd.md)).
- **Entornos**: desarrollo en WSL 2, preproducción en el homelab y producción también en el homelab, pendiente de configurar ([informe](docs/investigacion/2026-11-alojamiento-produccion.md), [ADR-0012](docs/adr/0012-entornos.md), [ADR-0026](docs/adr/0026-preproduccion-homelab.md)). Cómo se despliega y cómo se vuelve atrás, en [docs/08](docs/08-despliegue.md).
- **Ramas**: el trabajo entra en `preprod` con un PR (_squash_), y cada push a `preprod` despliega en preproducción si pasa la CI. `preprod` llega a `main` con un PR fusionado con un commit de merge; `main` desplegará en producción. Las dos ramas están protegidas. El repositorio es público, con los PR limitados a los colaboradores.

## Estructura objetivo

El monorepo está montado. `domain` ya tiene el contrato del catálogo (esquema, `parseCatalog`, agregado `Catalog` y reglas derivadas) y la búsqueda de las pinturas parecidas, `catalog-builder` genera `catalog.json` `color-wheel` tiene los cálculos de la rueda y el componente, y `apps/web` integra la rueda y las pinturas parecidas ([docs/07](docs/07-web.md)). La separación en paquetes, la organización interna por módulos y los patrones están en el [ADR-0018](docs/adr/0018-organizacion-codigo-patrones.md).

- `packages/color-wheel`: la rueda completa, solo con colores y sin pinturas: los modelos RYB y digital, las armonías, el esquema de miniatura (culori, y spectral.js para las mezclas) y el dibujo con la plantilla giratoria y sus controles. Es un componente completo y agnóstico del framework, que se inicializa sobre un contenedor y se entrega compilado a JS con sus tipos. No depende de `domain`. Se diseña como publicable, pero no se publica en npm ([ADR-0020](docs/adr/0020-rueda-paquete-independiente.md), [docs/05](docs/05-rueda-de-color.md)).
- `packages/domain`: TS puro, con el modelo del catálogo, su validación (Zod) y la búsqueda de la pintura más parecida con el Delta E (culori) ([docs/06](docs/06-pinturas-parecidas.md)). Sin dependencias de React ni del navegador.
- `packages/catalog-builder`: script Node que importa las fuentes, las normaliza (culori para el punto medio de los degradados) y genera `catalog.json`. Arquitectura hexagonal en sus bordes (disco y red).
- `apps/web`: React, solo presentación. La lógica vive en el dominio y la rueda en `color-wheel`. Cada página de cada idioma se prerenderiza en el build, y el navegador la toma ([docs/07](docs/07-web.md), [ADR-0024](docs/adr/0024-web.md)).
- `docs/`: especificaciones, y `docs/adr/` con los ADR.
- Futuro, en la fase 6 ([ADR-0017](docs/adr/0017-arquitectura-objetivo-backend.md)):
  - `apps/api`: backend REST con base de datos, que expone la instantánea pública del catálogo.
  - `apps/admin`: frontal de mantenimiento del catálogo.
  - `packages/importers`: la importación de fuentes, extraída de `catalog-builder`.

## Catálogo

- `catalog.json` lo genera el builder, se versiona en el repositorio y es determinista (sin marcas de tiempo).
- Va en el precaché de Workbox: el service worker solo lo vuelve a descargar cuando cambia su revisión.
- Se carga con `fetch` y se valida al cargarlo. No se importa en el bundle.
- `build-catalog` comprueba la estabilidad de IDs frente al `catalog.json` de la última etiqueta `release/AAAA-MM-DD` y las lápidas de `data/tombstones.json` ([docs/03](docs/03-identificadores.md) §6-7, [ADR-0025](docs/adr/0025-estabilidad-ids-etiqueta-publicacion.md)).
- El detalle está en [docs/02-esquema-catalog-json.md](docs/02-esquema-catalog-json.md).

## Reglas de dominio

- **Equivalencias oficiales**: aristas dirigidas (origen → destino) con una fuente del fabricante obligatoria. No se infieren ni las inversas ni las transitivas.
- **Equivalencias calculadas**: CIEDE2000 en el cliente. No se guardan en el JSON. Se agrupan por marca, con una etiqueta de calidad por tramos de ΔE y sin umbral que oculte resultados. Por defecto solo son candidatas las pinturas opacas no metálicas ([docs/06](docs/06-pinturas-parecidas.md), [ADR-0022](docs/adr/0022-busqueda-pinturas-parecidas.md)).
- **Color aproximado**: un hex es aproximado si la pintura es metálica, si su tipo es lavado, tinta, veladura, contrast o técnica, o si el hex es de origen comunitario. Se calcula en el dominio; en el JSON solo se guardan el origen y la fuente del hex. No se ofrecen equivalencias calculadas con colores aproximados sin avisar.
- **Origen del color**: un único hex por pintura, con su origen (`measured`, `manufacturer` o `community`) y su fuente. Los degradados oficiales de Citadel se reducen a su punto medio en CIELAB ([ADR-0014](docs/adr/0014-origen-seleccion-color.md)). En el MVP cada pintura tiene una sola fuente de color ([ADR-0019](docs/adr/0019-alcance-minimo-mvp.md)).
- **Sustitución frente a equivalencia**: solo hay sustituta si la fuente del fabricante dice que X sustituye a Y. Las cartas de conversión son equivalencias oficiales.
- **Esquema de miniatura** ([ADR-0020](docs/adr/0020-rueda-paquete-independiente.md)): la base con su sombra y su luz, los otros dos colores de su tríada y su complementario, en ese orden.
  - Las mezclas simulan pigmentos (Kubelka-Munk), no luz.
  - Sombra: la base mezclada con su complementario.
  - Luz: la base mezclada con su vecino en la rueda, aclarado; hacia el amarillo si es cálida y hacia el azul si es fría.
  - Solo se muestra el color resultante y la pintura más cercana; la receta de la mezcla está en «Futuro».
- **Rueda**: continua, con un anillo de tono y un triángulo de blanco y negro, así que la base puede ser cualquier color. Las armonías giran el tono con los ángulos fijos de la rueda de 12 tonos y conservan las proporciones de blanco y negro de la base. Calcula en modelo RYB (el de la pintura física) o digital (RGB/HSL), a elección del usuario. La web busca, para cada color, la pintura real más parecida, filtrando por las marcas activas. El detalle está en [docs/05](docs/05-rueda-de-color.md).
- **Pintura**:
  - Tipo según su función: base, capa, estándar (opaca sin distinción base/capa), lavado, tinta, veladura, contrast (función de una capa, de cualquier marca), técnica o pincel seco ([ADR-0013](docs/adr/0013-clasificacion-pinturas.md)).
  - Metálica, como atributo independiente del tipo.
  - Estado: activa o descatalogada. Si está descatalogada, con su sustituta y la fuente del fabricante, si las hay.
- **IDs**: slugs jerárquicos (`brand/range/paint`) que se generan una vez y nunca se recalculan. El código no los descompone.

El modelo completo está en [docs/01-modelo-dominio.md](docs/01-modelo-dominio.md) y los IDs en [docs/03-identificadores.md](docs/03-identificadores.md).

## Alcance

El alcance mínimo y lo aplazado están razonados en el [ADR-0019](docs/adr/0019-alcance-minimo-mvp.md).

- **MVP**: la rueda y, para cada uno de sus colores, las pinturas más parecidas de cada marca, con funcionamiento offline.
  - **Armonías**: complementario, complementario dividido, análogos, análogos con acento, tríada, tétrada rectangular, cuadrado y monocromático, además del esquema de miniatura.
  - **Equivalencias**: solo las calculadas. Las oficiales están aplazadas a la fase 5.
  - **Web**: en los 13 idiomas de la rueda, con el catalán, el euskera y el gallego ([ADR-0027](docs/adr/0027-lenguas-cooficiales-espana.md)), con selector de idioma y de tema (sistema, claro u oscuro), y con las preferencias (marcas, filtros, vista, tema, idioma y rueda) guardadas en el navegador. En la fase 6 pasan a la cuenta del usuario.
- **Marcas y líneas del MVP**, solo las vigentes:
  - Warhammer Colour, antes Citadel: Base, Layer, Shade, Contrast, Technical y Dry.
  - Vallejo: Model Color y Game Color, con sus subfamilias e incluido Xpress Color.
  - Army Painter: Warpaints Fanatic y Speedpaint 2.0.
  - AK: 3rd Gen y Quick Gen.
  - Fuera del catálogo: productos sin color (mediums, barnices, diluyentes).
- **Futuro** (no implementar sin pedirlo): mi colección, recetas, lista de la compra, cuentagotas sobre foto, sugerencia de lavados, mezclas, ángulos ajustables en la plantilla de la rueda, tutorial guiado de la rueda (cuando el MVP esté completo y haya usuarios reales), icono de ayuda de la rueda personalizable por la web, Tone Pro, líneas de aerógrafo, Spray, Speedpaint 1.0, búsqueda por código antiguo y una página estática por pintura con sus equivalentes en las otras marcas, para el SEO.
- **Búsqueda por nombre**, cuando se haga: sin distinguir mayúsculas, apóstrofos ni acentos y por fragmentos (`tigers skin` encuentra «Tiger's Eye Skin»). Después, tolerante a faltas de ortografía (`boney` encuentra «Bony»). Con eso sobran los alias que hoy cubren erratas, como «Nurgles Rot», «Tigers Eye Skin» y «Boney Spikes».
- Si una propuesta se sale del MVP, indícalo antes de implementarla.

## Estado y hoja de ruta

1. **Arquitectura y modelo de datos**: cerrada. Ver docs/01-03 y los ADR 0001-0008.
2. **Montar el monorepo y la toolchain**, según los ADR 0009-0011: hecho.
3. **Investigación de fuentes de datos**: cerrada. Ver el [informe](docs/investigacion/2026-11-fuentes-datos.md), docs/04 y los ADR 0013-0016.
4. **Builder, importadores y prototipo de la rueda**: cerrada, con el alcance del [ADR-0019](docs/adr/0019-alcance-minimo-mvp.md). Etapas:
   1. Contrato del catálogo en `domain`: hecho.
   2. Builder mínimo según docs/04, con el paso 4 de la CI: hecho.
   3. Datos: hecho, una marca por iteración, cada una desde una sola fuente. Citadel: desde la tabla de SimoGecko con hex `community`, porque citadelcolour.com (hoy paint.warhammer.com) no publica los hex. The Army Painter: desde DonnervS con hex `community`; Warpaints Fanatic es una sola gama (lavados, metálicos y efectos se distinguen por el tipo y el atributo metálico). AK Interactive: desde DonnervS con hex `community`; 3Gen Acrylics es una sola gama con todas las etiquetas de AK (STANDARD, AFV, FIGURES…) salvo AIR, que es de aerógrafo; Quick Gen tiene 79 colores, comprobado en la web de AK. Vallejo: desde DonnervS con hex `community`, contrastado con las cartas oficiales CC329 (Model Color) y CC266 (Game Color y Xpress Color); Model Color y Game Color son una gama cada una, con sus subgrupos (lavados, tintas, metálicos, fluorescentes y Special FX) distinguidos por el tipo, y Xpress Color, con Intense, es una gama propia.
   4. Color: el paquete `color-wheel` con los dos modelos de rueda, las armonías, el esquema de miniatura, y el componente completo con su dibujo, su plantilla giratoria y sus controles (hecho), y en `domain` la búsqueda de la pintura más parecida con el ΔE, según docs/06 (hecho).
   5. Web ([docs/07](docs/07-web.md), [ADR-0024](docs/adr/0024-web.md)): hecho. La rueda integrada, las pinturas más parecidas a cada color en pestañas, con los filtros, la vista por marca o sin distinguir marca y el aviso de color aproximado; la carga del catálogo; 13 idiomas, tema y preferencias; créditos y fuentes con las licencias de terceros; prerenderizado con SEO, y PWA instalable y sin conexión.

   Al curar los datos hay que verificar:
   - La retirada de Contrast en 2026: GW no la confirma ([informe](docs/investigacion/2026-11-retirada-contrast.md), con las 24 pinturas). Solo se marcan como `discontinued` con un documento del fabricante.

   Los importadores se escriben como funciones puras (fuente → filas), sin acceso a disco dentro de la lógica, para poder reutilizarlos en la fase 6.

5. **Catálogo completo**, aplazado del MVP ([ADR-0019](docs/adr/0019-alcance-minimo-mvp.md)):
   - Equivalencias oficiales y sustituciones, incluida la carta de GW de 2012 si existe una copia fiel ([ADR-0015](docs/adr/0015-fuentes-trazabilidad-licencias.md)).
   - Líneas descatalogadas: las antiguas de Citadel (Citadel Colour, Foundation, Washes de 2008, tintas, Glaze y Edge) y los Warpaints originales.
   - Datos curados en dos capas, con transcripciones literales, claves por documento y exclusiones.
   - Varios candidatos de color por pintura, con prioridad `measured` > `manufacturer` > `community` y elección manual.
   - Desactivación de fuentes con su resumen de cambios, y el script `archive-sources` (Wayback Machine y SHA-256).

6. **Backend, administración del catálogo y sesiones de usuario**, la última fase ([ADR-0017](docs/adr/0017-arquitectura-objetivo-backend.md)). Incluye:
   - Una API REST con base de datos y una web de administración del catálogo, con el frontal y el backend separados.
   - Una instantánea pública del catálogo, pedida por versión de esquema, para que la PWA actualice su catálogo local sin volver a desplegarse. De la API, la PWA solo consume esa instantánea y los endpoints de usuario. La API de administración solo la usa `apps/admin`.
   - Cuentas, sesiones y roles (usuario y administrador), gestionados desde `apps/admin`, con los datos del usuario sincronizados entre dispositivos y offline primero.
   - La referencia de la API, con Scalar como candidato, a partir de su especificación OpenAPI. Se decide al elegir el framework de `apps/api`, porque de él depende cómo se obtiene el OpenAPI.

Pendiente fuera de la hoja de ruta:

- Configurar producción en el homelab, con la misma forma que la preproducción, y escribir su ADR ([informe](docs/investigacion/2026-11-alojamiento-produccion.md)). Cada publicación en producción crea la etiqueta `release/AAAA-MM-DD`, que protege sus IDs ([ADR-0025](docs/adr/0025-estabilidad-ids-etiqueta-publicacion.md)). Cada entorno define `SITE_ORIGIN` al compilar la web y configura su servidor para servir cada página también sin la `/` final, sin redirigir, para redirigir con un 301 `/<ruta>/index.html` a `/<ruta>/` y para responder a las direcciones desconocidas con `404.html` (el del idioma de la dirección, si lo hay) y el estado 404 ([docs/07](docs/07-web.md) §12). La configuración del servidor, en `apps/web/deploy/`, es común a los entornos ([docs/08](docs/08-despliegue.md)).
- Al pasar a producción, publicar con la CI la referencia de los paquetes que genera TypeDoc, que hasta entonces solo se genera en local.
- Antes de cualquier despliegue público, revisar las fuentes con licencia `unknown` o `terms-of-use`.
- Antes de cualquier despliegue público, revisar los textos de la web en catalán, euskera, gallego, francés, alemán, italiano, portugués, ruso, chino, japonés y coreano, que nadie ha revisado.

## Documentación

- **Fuente de verdad**: el repositorio. Las especificaciones están en `docs/` y los ADR en `docs/adr/` (un fichero por ADR; el README tiene el índice y las normas).
- **Este documento** recoge las decisiones vigentes. El proyecto de claude.ai lo carga desde GitHub junto con docs/01-04.
- **Informes de investigación**: en `docs/investigacion/`, fechados e inmutables. Las normas están en su [README](docs/investigacion/README.md).
- **Especificaciones y ADR**: las especificaciones describen lo vigente; los ADR, por qué se decidió. Un ADR aceptado no se reescribe: se sustituye por otro nuevo.
- **Referencia de la API** de `color-wheel` y `domain`: la generan TypeDoc y los comentarios TSDoc del código, en inglés. `pnpm docs:api` la genera en local y la CI comprueba que se genera sin errores. Las especificaciones describen el comportamiento y enlazan a ella, sin repetir firmas ni tipos ([ADR-0023](docs/adr/0023-documentacion-tecnica.md)).
- **READMEs**, en castellano. El de la raíz explica qué es el proyecto, cómo se instala y los comandos. El de cada paquete explica qué hace, con un ejemplo mínimo y los enlaces a su especificación y a la referencia.

## Interfaz

- **Accesibilidad**: HTML semántico y WCAG 2.2 nivel AA. Todo se maneja con ratón, teclado y pantalla táctil, y el táctil tiene que ser preciso.
- **Mobile first**: se diseña primero para el móvil, y en escritorio tiene que funcionar y verse igual de bien.
- **Adaptable de verdad**: un único marcado que se ajusta con CSS. Nada de elementos distintos para móvil y escritorio.
- **UX/UI cuidadas** en cada pantalla.
- **Muy buen SEO en todas las páginas y en todos los idiomas**: los metadatos, los textos fijos y el contenido llegan en el HTML, sin JavaScript. Solo la rueda y lo interactivo lo necesitan.

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
