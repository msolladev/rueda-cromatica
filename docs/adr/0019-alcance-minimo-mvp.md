# ADR-0019: Alcance mínimo del MVP

- **Estado:** aceptada; corregida en parte por [ADR-0030](0030-datos-curados-dos-capas.md)
- **Fecha:** 2026-11-12
- **Sustituye a:** [ADR-0016](0016-datos-curados-json.md)
- **Aplaza en parte:** [ADR-0001](0001-identificadores-slug-congelado.md), [ADR-0014](0014-origen-seleccion-color.md) y [ADR-0015](0015-fuentes-trazabilidad-licencias.md)

## Contexto

Al empezar el builder (fase 4, etapa 2), el diseño de los datos curados de los ADR 0014-0016 y de [docs/04](https://github.com/msolladev/rueda-cromatica/blob/df060b3/docs/04-datos-curados.md) resultó demasiado complejo para el MVP:

- Transcripciones literales de cada documento, con claves escritas a mano para cruzar cada pintura con cada fuente: miles de claves para unas 1.500 pinturas.
- Varios candidatos de color por pintura, con orden de preferencia y elección manual, cuando en la práctica casi todas las pinturas tendrán un solo hex (ADR-0014).
- Exclusiones, desactivación de fuentes, resumen de cambios y archivado automático.

Todo eso sirve para un catálogo completo y auditable, no para validar la app. Lo que el MVP necesita es más simple: una rueda que calcule las armonías y, para cada color, las pinturas reales más parecidas de cada marca.

## Decisión

### Alcance del MVP

- **Rueda** con dos modelos de color, RYB (el de la pintura física) y digital (RGB/HSL), elegibles con un selector.
- **Armonías**: complementario, complementario dividido, análogos, análogos con acento, tríada, tétrada rectangular, cuadrado y monocromático, además del esquema de miniatura (base, sombra, luz y acento).
- **Pinturas para cada color**: las más parecidas de cada marca, con equivalencias **calculadas** (CIEDE2000). No hay equivalencias oficiales.
- **Datos**: Warhammer Colour (Citadel), Vallejo, Army Painter y AK, **solo con las líneas vigentes**.

### Datos de `catalog-builder`

- Los datos se guardan **ya en la forma de `catalog.json`**: un fichero con las fuentes y un fichero por marca con sus gamas y pinturas. Se validan con los esquemas de `domain`, sin un esquema propio. El detalle está en [docs/04](../04-datos-curados.md).
- **El builder** junta los ficheros, los ordena, valida el resultado con `parseCatalog` y escribe `apps/web/public/catalog.json`. Ese fichero se excluye de Prettier, porque su formato lo fija el builder.
- **Los importadores** son un paso aparte que se ejecuta a demanda: leen una fuente y actualizan el fichero de su marca. Conservan el ID de las pinturas que ya existen y proponen uno para las nuevas. La revisión de los cambios es el diff de git.
- **Cada pintura tiene un solo hex**, con su origen y su fuente. Un degradado se reduce al importar a su punto medio en CIELAB con blanco D65; si cae fuera de sRGB, se recorta canal a canal.

### Lo que se aplaza

Queda para la fase 5, inmediatamente después del MVP. El backend ([ADR-0017](0017-arquitectura-objetivo-backend.md)) pasa a ser la fase 6, la última:

- Equivalencias oficiales y sustituciones, y con ellas la carta de GW de 2012.
- Líneas descatalogadas.
- Transcripciones literales, claves por documento y exclusiones ([ADR-0016](0016-datos-curados-json.md)).
- Varios candidatos de color por pintura, con prioridad entre orígenes y elección manual ([ADR-0014](0014-origen-seleccion-color.md)).
- Desactivación de fuentes y su resumen de cambios, archivado en la Wayback Machine, descarga con SHA-256 y copias de terceros ([ADR-0015](0015-fuentes-trazabilidad-licencias.md)).
- Lápidas y test de estabilidad de IDs ([ADR-0001](0001-identificadores-slug-congelado.md)). Mientras no haya una versión publicada, ningún usuario guarda IDs, así que se pueden corregir libremente. Ambos se implementan antes de la primera publicación.

Las decisiones de diseño tomadas para esa fase, al recorrer docs/04 antes de implementarlo, se conservan para retomarlas:

1. La sustitución sale de la transcripción del documento del fabricante. La ficha de la pintura solo elige cuando dos documentos se contradicen; si no elige, el build falla.
2. El origen del color de un documento es la lista de preferencia en la que aparece, sin un segundo apartado que lo repita.
3. Una exclusión excluye todas las filas donde aparece la clave, en cualquier lado de la relación. Si la clave excluida ya tiene ficha, el build falla porque la exclusión ha quedado obsoleta.
4. Una elección manual que no se puede cumplir (el documento elegido está desactivado o no aporta ese dato) hace fallar el build con un mensaje que propone el siguiente candidato y enlaza a su fichero.
5. Un documento desactivado sale del catálogo, y el test de estabilidad lo acepta mientras su fichero siga en los datos curados.
6. Toda ficha necesita al menos una clave en algún documento.

## Alternativas descartadas

- **Mantener el diseño de docs/04 completo**: retrasa la rueda, que es lo que hay que validar, con una maquinaria que el MVP casi no usa.
- **Una versión intermedia, con cruce automático por nombre y claves solo en las excepciones**: sigue siendo más complejo de lo que el MVP necesita.
- **Descartar lo aplazado en lugar de aplazarlo**: se perderían decisiones ya razonadas que volverán a hacer falta.

## Consecuencias

- El contrato de `catalog.json` ([docs/02](../02-esquema-catalog-json.md)) no cambia: las equivalencias van vacías y todas las pinturas están activas.
- Sin transcripción literal, la comprobación de un dato contra su fuente se hace con la URL del documento y el historial de git.
- En la organización del builder del [ADR-0018](0018-organizacion-codigo-patrones.md), `curated/` solo lee y comprueba los ficheros de datos, sin esquemas propios, porque usa los de `domain`. Las referencias de ese ADR a docs/04 §2-6 corresponden a la versión del historial; las de la versión actual son §2 y §3.
- La fase que recupere lo aplazado necesitará un ADR nuevo que sustituya a este en lo que corresponda, y una versión nueva de docs/04.
