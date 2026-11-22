# ADR-0030: Datos curados en dos capas

- **Estado:** aceptada
- **Fecha:** 2026-11-22
- **Corrige en parte:** [ADR-0019](0019-alcance-minimo-mvp.md)

## Contexto

El [ADR-0016](0016-datos-curados-json.md) diseñó los datos curados en dos capas: transcripciones literales por fuente y fichas por marca con las claves que cruzan cada pintura con cada fuente. El [ADR-0019](0019-alcance-minimo-mvp.md) lo sustituyó para el MVP por datos guardados ya con la forma de `catalog.json`. Aplazó las dos capas a la fase 5 por el coste de escribir miles de claves a mano y conservó seis decisiones de diseño para retomarlas.

Con una sola capa, la interpretación de cada fuente vive en el código de su importador, que sobrescribe las fichas en cada importación. Las erratas, los nombres limpiados, las filas descartadas o el color medido que se descarta de AK11057 Vampiric Flesh no quedan en los datos. Los pasos siguientes de la fase 5 se apoyan en las dos capas: varios candidatos de color, desactivación de fuentes, equivalencias oficiales de cartas que no pertenecen a ninguna ficha y líneas descatalogadas.

La web está publicada y los IDs están congelados ([ADR-0025](0025-estabilidad-ids-etiqueta-publicacion.md)), así que la migración no puede cambiar ni retirar ninguno.

## Decisión

### Dos capas en JSON, ahora

- `sources/<source-id>.json`: la fuente como va al catálogo, todas sus filas transcritas de forma literal y sus filas ignoradas.
- `brands/<brand-id>.json`: la marca, sus gamas y sus fichas, sin color y con sus claves y una nota.
- `ignore-reasons.json`: los motivos de las ignoradas.
- `color-policy.json`: las fuentes de cada origen del color, en orden de preferencia.

Es la separación habitual entre una capa de entrada con los datos tal como llegan y una tabla de correspondencias entre los identificadores externos y los propios. En la fase 6 son tres tablas (filas por fuente, pinturas y claves), así que la migración del [ADR-0017](0017-arquitectura-objetivo-backend.md) es una copia directa. El detalle está en [docs/04](../04-datos-curados.md).

### Qué se transcribe

- **Todas las filas** de cada fuente, con los campos que tienen sentido para el catálogo: clave, grupo, nombre, código, hex o degradado (los dos extremos), hex medido, acabado y la marca de «sin color». Se descartan el EAN, los tamaños de bote, las descripciones y el RGB.
- **Las ignoradas, en dos niveles**: por grupo de la fuente (el `set` de DonnervS o el tipo de SimoGecko) y por clave, para una fila suelta dentro de un grupo que entra.
- **Los motivos, en una colección aparte**: cada ignorada cita el ID de su motivo y lleva una nota opcional para el detalle propio de ese caso. Cambiar el texto de un motivo no toca ninguna ignorada.
- **Las cartas de Vallejo CC329 y CC266 no se transcriben en este paso**: no tienen hex, y lo que aportan son las equivalencias del paso 4. Lo que se sacaba de ellas para clasificar pinturas pasa a ser interpretación: el tipo y el acabado metálico van en la ficha y la carta se cita en su nota.

### Las claves

- **Explícitas, en la ficha, escritas por el importador**: una lista de pares (fuente, clave), una por fuente como mucho. El importador ya emparejaba cada fila con su ficha, así que escribe la clave él mismo y solo se escriben a mano las excepciones. La migración ha generado las 1393 claves actuales.
- **El valor lo pone la fuente**: el código del fabricante en DonnervS (`72.120`) y el tipo y el nombre literal en SimoGecko (`technical/Nurgles Rot`), que no tiene códigos y repite nombres entre tipos.

### Los importadores

- **Transcribir**: una función pura que devuelve las filas literales de la fuente. Es la parte que la fase 6 lleva a `packages/importers`.
- **Conciliar**: una función pura que propone una ficha para cada fila nueva y devuelve las diferencias de nombre y código de las filas que cambian en la revisión, como datos estructurados. No cambia nunca una ficha existente: una fuente de terceros es una pista, no una prueba (regla de renombrado del ADR-0016). Que las diferencias sean datos deja abierta una opción futura de aplicarlas si las fuentes cambian a menudo.
- Los ajustes por pintura que vivían en el código (tipos, metálicos, erratas, slugs elegidos a mano y colores medidos descartados) pasan a las fichas. En el código queda la regla de cada grupo para proponer fichas nuevas.

### Las seis decisiones del ADR-0019

Las seis siguen vigentes, con estas precisiones:

- **Decisión 2** (el origen de un documento es la lista en la que aparece): el hex y los degradados toman el origen de la lista `manufacturer` o `community`, y una fuente solo está en una de las dos. El hex medido es siempre `measured` y solo se usa si la fuente está además en la lista `measured`. DonnervS no está en ella hasta el paso 2.
- **Decisión 3** (una exclusión vale en cualquier lado de la relación y falla si la clave tiene ficha): se aplica también a las ignoradas por grupo.
- **Decisión 5** (un documento desactivado sale del catálogo y el test de estabilidad lo acepta mientras su fichero siga): la referencia es la etiqueta `release/` del ADR-0025, así que el test necesitará conocer las fuentes desactivadas.

Mientras no se implemente el paso 2, una pintura con más de un candidato de color hace fallar el build.

## Alternativas descartadas

- **Cambiar el orden de las fases** y llevar las dos capas directamente a la base de datos: antepone la fase 6 entera al catálogo completo, y sin `apps/admin` la curación pierde la revisión por el diff de git.
- **Seguir con una capa** y añadir lo que pida cada paso: las cartas de equivalencias no pertenecen a ninguna ficha, y mezcla lo que dice la fuente con lo interpretado.
- **Copiar el fichero original de cada fuente**: no sirve para las cartas en PDF, exige un lector por formato y arrastra campos que no se usan.
- **Ignorar cada fila por separado**: unas 2000 entradas casi idénticas.
- **Transcribir solo las líneas del MVP**: la transcripción deja de ser el documento completo, y ampliar el alcance obliga a volver a importar.
- **Claves implícitas por regla**: dos mecanismos para lo mismo, y corregir el nombre o el código de una ficha cambia en silencio con qué fila se cruza.
- **Un fichero de correspondencias por fuente**: reparte la información de cada pintura entre muchos ficheros.
- **Que el importador actualice las fichas**: una fuente de terceros corregiría sola los datos curados, y con varias fuentes por pintura se pisarían.

## Consecuencias

- La sección «Datos de `catalog-builder`» del ADR-0019 deja de aplicarse: los datos ya no tienen la forma de `catalog.json` y `catalog-builder` tiene esquemas propios. Las transcripciones literales, las claves y las exclusiones que aplazó quedan implementadas.
- Las referencias del [ADR-0018](0018-organizacion-codigo-patrones.md) a docs/04 §2-6 vuelven a corresponder a la versión actual.
- `catalog.json` no cambia: el generado después de la migración es idéntico byte a byte al anterior.
- Las transcripciones ocupan unos 0,8 MB. AK Interactive tiene 120 versiones AIR dentro de su grupo 3Gen, ignoradas una por una por su clave.
- `import-donnervs` transcribe de una vez los tres ficheros de DonnervS (AK, Army Painter y Vallejo), porque son una sola fuente.
