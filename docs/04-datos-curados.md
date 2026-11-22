# Datos curados de `catalog-builder`

Este documento especifica los datos que mantiene el proyecto y cómo el builder genera `catalog.json` a partir de ellos. Las decisiones están en los ADR [0013](adr/0013-clasificacion-pinturas.md), [0014](adr/0014-origen-seleccion-color.md), [0015](adr/0015-fuentes-trazabilidad-licencias.md), [0019](adr/0019-alcance-minimo-mvp.md), [0030](adr/0030-datos-curados-dos-capas.md), [0031](adr/0031-varios-candidatos-color.md) y [0032](adr/0032-desactivacion-fuentes-archivado.md).

## 1. Principios

- **Dos capas**:
  - **Lo que dice cada fuente**: la transcripción literal de todas sus filas, erratas incluidas, que se puede comprobar contra el original.
  - **La interpretación propia**: IDs, nombres oficiales, tipos, estados, notas y las claves que cruzan cada pintura con cada fuente.
- **JSON validado con Zod** en `catalog-builder` y formateado con Prettier. Los esquemas son estrictos: un campo desconocido es un error. Las notas van en campos `note`.
- **`null` explícito** y arrays siempre presentes, como en `catalog.json`.
- **Nada implícito**: ni tipos heredados de la gama ni cruces por regla. Cada fila de una fuente acaba en una pintura o ignorada con su motivo.
- **El builder falla en lugar de adivinar** y no escribe nada si algo no cuadra.
- **La revisión es el diff de git**: los cambios en los datos se revisan antes del commit.

## 2. Estructura

```
packages/catalog-builder/data/
  sources/<source-id>.json
  brands/<brand-id>.json
  ignore-reasons.json
  color-policy.json
  tombstones.json
```

- El builder escribe además, en `packages/catalog-builder/reports/`, el informe de discrepancias de color (`color-discrepancies.json`) y el resumen de las fuentes desactivadas (`disabled-sources.json`) (§6, paso 8). No son datos curados: se generan.
- Los ficheros se leen en orden alfabético, para que la salida sea determinista.
- El nombre de cada fichero de `sources/` y `brands/` coincide con el ID de su fuente o de su marca.

## 3. `sources/<source-id>.json`

Una fuente por fichero, con seis claves:

| Clave           | Contenido                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `source`        | la fuente tal como va a `catalog.json`, con las reglas de [docs/02](02-esquema-catalog-json.md) §3                           |
| `disabled`      | `null`, o `{ note }` si la fuente está desactivada, con el motivo en la nota (§6, «Desactivar una fuente»)                   |
| `files`         | los ficheros que ha descargado `archive-sources` (§9), cada uno con su `url`, su `name` y su `sha256`. Vacío hasta entonces  |
| `paints`        | las filas de la fuente, todas y en su orden, copiadas de forma literal                                                       |
| `ignoredGroups` | los grupos de la fuente que no entran en el catálogo: `group`, `reasonId` y `note` (string \| null)                          |
| `ignoredKeys`   | las filas sueltas que no entran en el catálogo, dentro de un grupo que sí entra: `key`, `reasonId` y `note` (string \| null) |

Cada fila de `paints`:

| Campo         | Tipo                      | Contenido                                                                                                                                                          |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `key`         | string                    | cómo identifica la fuente la pintura. Única dentro de la fuente                                                                                                    |
| `group`       | string                    | la agrupación de la propia fuente: el `set` de DonnervS, la columna de tipo de la tabla oficial de SimoGecko o el título de la tabla muestreada, que no tiene tipo |
| `name`        | string                    | el nombre tal como lo escribe la fuente, aunque esté vacío                                                                                                         |
| `code`        | string \| null            | el código del fabricante, si la fuente lo da                                                                                                                       |
| `hex`         | string \| null            | `#rrggbb` en mayúsculas o minúsculas, según la fuente                                                                                                              |
| `gradient`    | `{ dark, light }` \| null | los dos extremos de un degradado. Una fila tiene `hex` o `gradient`, no los dos                                                                                    |
| `measuredHex` | string \| null            | una medición con colorímetro que la fuente publica aparte de su `hex`                                                                                              |
| `finish`      | string \| null            | el acabado tal como lo nombra la fuente (`metal`, `gloss`…)                                                                                                        |
| `colourless`  | boolean                   | si la fuente marca el producto como sin color                                                                                                                      |

Lo que la fuente publica y el catálogo no usa (EAN, tamaños de bote, descripciones, RGB) no se transcribe.

El `archiveUrl` de `source` es una captura de su `url`, `https://web.archive.org/web/<fecha>/<url>`, o `null`. Si la `url` cambia, por ejemplo a una revisión nueva, el build falla hasta que se vuelve a `null` y se ejecuta `archive-sources`. La revisión de una fuente de GitHub es el commit de su `url`, así que no tiene campo propio.

La clave de cada fuente actual:

| Fuente                              | Clave                    | Ejemplo                 |
| ----------------------------------- | ------------------------ | ----------------------- |
| `donnervs-miniature-paints`         | el código del fabricante | `72.120`                |
| `simogecko-citadel-colours`         | el tipo y el nombre      | `technical/Nurgles Rot` |
| `simogecko-citadel-colours-sampled` | el nombre                | `Macragge Blue`         |

SimoGecko no tiene códigos, y su tabla oficial repite nombres entre tipos (Abaddon Black es `base` y `spray`), así que en ella el nombre solo no basta. La tabla muestreada solo tiene Base y Layer, sin tipo y sin nombres repetidos.

Un ejemplo real, la fila de Abyssal Turquoise en DonnervS:

```json
{
  "key": "72.120",
  "group": "Game Color",
  "name": "Abyssal Turquoise",
  "code": "72.120",
  "hex": "#1B3E54",
  "gradient": null,
  "measuredHex": null,
  "finish": null,
  "colourless": false
}
```

## 4. `brands/<brand-id>.json`

Un objeto con tres claves: `brand` (la marca), `ranges` (sus gamas) y `paints` (sus pinturas curadas).

- `brand` y `ranges` siguen las reglas de [docs/02](02-esquema-catalog-json.md) §3. El `brandId` de cada gama es el de la marca del fichero.
- Cada pintura tiene los campos de la pintura de `catalog.json` salvo `color`, que el builder elige entre los candidatos de sus fuentes (§6), y cuatro más:
  - `keys`: la lista de sus claves, una por fuente como mucho y al menos una ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 6). Cada clave es `{ sourceId, key }`. Es una lista y no un objeto por fuente porque `JSON.parse` sobrescribe sin avisar las claves duplicadas (docs/02 §1).
  - `colorChoice` (objeto \| null): la elección manual de un candidato que la prioridad no elegiría, con `sourceId`, `origin`, `hex` y una `note` obligatoria.
  - `rejectedColors`: los candidatos descartados, cada uno con `sourceId`, `origin`, `hex`, `reasonId` (un motivo de `ignore-reasons.json`) y `note` (string \| null).
  - `note` (string \| null): las demás decisiones de curación, como la carta que prueba que una pintura es metálica o la página del fabricante que da el nombre oficial.
- **Un candidato** se identifica por su fuente y su origen: una fila da como mucho un hex por origen, su `hex` o `gradient` y su `measuredHex`. El `hex` de una elección o de un descarte es el que daba el candidato al revisarlo, en la forma publicada (`#rrggbb` en minúsculas, y el punto medio si es un degradado). Si el candidato cambia, el build falla para revisarlo ([ADR-0031](adr/0031-varios-candidatos-color.md)).
- **Descartar o elegir**: un descarte quita un candidato y deja que la prioridad elija entre los demás, así que una fuente mejor que llegue después gana sola. Una elección fija uno aunque la prioridad diga otro. Para corregir un color mal tomado se descarta; solo se elige cuando el bueno no es el siguiente por prioridad.
- `id` es el ID congelado ([docs/03](03-identificadores.md)). El builder nunca lo recalcula.
- El `rangeId` de cada pintura es una gama del mismo fichero.
- `type` y `metallic` siguen la clasificación del fabricante ([ADR-0013](adr/0013-clasificacion-pinturas.md)).

Un ejemplo real, Nurgle's Rot, cuya clave conserva la errata de SimoGecko:

```json
{
  "id": "citadel/technical/nurgles-rot",
  "rangeId": "citadel/technical",
  "name": "Nurgle's Rot",
  "aliases": ["Nurgles Rot"],
  "manufacturerCode": null,
  "type": "technical",
  "metallic": false,
  "status": { "kind": "active" },
  "keys": [
    { "sourceId": "simogecko-citadel-colours", "key": "technical/Nurgles Rot" }
  ],
  "colorChoice": null,
  "rejectedColors": [],
  "note": "Nombre oficial según https://www.warhammer.com/en-GB/shop/Technical-Nurgles-Rot-2019; SimoGecko escribe «Nurgles Rot»."
}
```

Un descarte real, el de Corax White, cuyo color en la tabla muestreada sale gris por la foto. Sin él gana la tabla muestreada; con él, la oficial:

```json
"rejectedColors": [
  {
    "sourceId": "simogecko-citadel-colours-sampled",
    "origin": "community",
    "hex": "#b6bbc0",
    "reasonId": "photo-artifact",
    "note": "Un blanco que la foto da gris claro; la tabla oficial da #FFFFFF."
  }
]
```

## 5. `ignore-reasons.json`, `color-policy.json` y `tombstones.json`

- **`ignore-reasons.json`**: los motivos de las filas ignoradas y de los candidatos de color descartados, cada uno con su `id` (un slug) y su `text`. Cada ignorada y cada descarte citan uno con `reasonId`, y su `note` recoge el detalle propio de ese caso. Por ejemplo, 73.300 Sepia Wash se ignora con `not-in-current-chart` y la nota «Carta CC266-Rev03 (2025).». El `text` es una explicación de curación, en castellano, y no se traduce: si algún día se publican los motivos, irá a `catalog.json` el ID y cada interfaz lo traducirá en sus ficheros de idioma, como hace la web con los tipos de pintura. Mientras no se publiquen, los IDs se pueden renombrar; desde que se publiquen, quedan congelados como los demás IDs.
- **`color-policy.json`**: tres listas de fuentes, `measured`, `manufacturer` y `community`, en orden de preferencia dentro de su origen ([ADR-0014](adr/0014-origen-seleccion-color.md)). Hoy, DonnervS en `measured`, y en `community` DonnervS y las dos tablas de SimoGecko, la muestreada por delante de la oficial ([ADR-0031](adr/0031-varios-candidatos-color.md)).
  - El `hex` y el `gradient` de una fuente toman el origen de la lista en la que aparece, `manufacturer` o `community`, y la fuente solo puede estar en una de las dos ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 2).
  - El `measuredHex` siempre es `measured`, y solo se usa si la fuente está además en `measured`.
  - Toda fuente que aporte `hex` o `gradient` tiene que estar en `manufacturer` o en `community`.
- **`tombstones.json`**: los IDs retirados por errores de alta, con su motivo, en sus cuatro colecciones ([docs/03](03-identificadores.md) §6).

## 6. Proceso del builder

Se ejecuta a demanda, cada vez que cambian los datos. `catalog.json` se versiona en el repositorio, y la CI lo vuelve a generar y falla si no coincide con el versionado o si rompe la estabilidad de IDs (paso 4 del [ADR-0011](adr/0011-ci-cd.md)).

1. **Carga y validación** de cada fichero con su esquema y las reglas de §2-5.
2. **Resolución de claves**: cruza cada fila de cada fuente con las pinturas a través de sus claves. El build falla si:
   - una fila no es la clave de ninguna pintura y no está ignorada, ni por su grupo ni por su clave;
   - una fila está ignorada y además es la clave de una pintura, porque la exclusión ha quedado obsoleta ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 3);
   - una clave se repite dentro de una fuente, o apunta a más de una pintura;
   - una pintura cita una fuente que no existe o una clave que no está en su fuente;
   - una ignorada no corresponde a ninguna fila, o ignora una clave que ya ignora su grupo;
   - una ignorada o un descarte citan un motivo que no existe, o un motivo no lo usa nadie.
3. **Color** de cada pintura, a partir de las filas de sus claves ([ADR-0031](adr/0031-varios-candidatos-color.md)):
   1. Los candidatos son el `hex` o el `gradient` de cada fila de una fuente activa, con el origen de su fuente, y su `measuredHex` si la fuente está en `measured`.
   2. Un `gradient` se reduce a su punto medio en CIELAB con blanco D65, calculado con culori, y se recorta canal a canal si cae fuera de sRGB.
   3. El hex se normaliza a minúsculas.
   4. Se ordenan por origen, `measured` > `manufacturer` > `community`, y dentro de cada origen por el orden de su lista en `color-policy.json`.
   5. Se quitan los descartados, y gana el primero que queda, o el de `colorChoice` si lo hay. Sin candidatos, el color es `null`.
   6. El build falla, con la ruta de la ficha, si:
      - un descarte o una elección nombran un candidato que la pintura no tiene, porque su fuente está desactivada o ya no lo da, o que da otro hex. El mensaje cita la fila de la fuente con el hex nuevo y, para una elección, el candidato que se publicaría sin ella ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 4);
      - un candidato se descarta dos veces, o se elige y se descarta a la vez;
      - la elección coincide con lo que ya elige la prioridad.
4. **Ensamblado**: junta las fuentes activas, las marcas, las gamas y las pinturas, sin las claves ni las notas, y las ordena como exige docs/02 §1. Las equivalencias van vacías hasta el paso 4 de la fase 5.
5. **`meta`**: `schemaVersion` es `SUPPORTED_SCHEMA_VERSION`, y `dataVersion` se calcula según docs/02 §4.
6. **Validación final** con `parseCatalog`. Cada problema se sitúa en el fichero y la ruta donde está el dato.
7. **Estabilidad de IDs** frente a la última publicación y a las lápidas, con las fuentes desactivadas ([docs/03](03-identificadores.md) §7).
8. **Escritura** determinista de `apps/web/public/catalog.json` (docs/02 §1), del informe de discrepancias y del resumen de las fuentes desactivadas, en `packages/catalog-builder/reports/`. Los tres están excluidos de Prettier, porque su formato lo fija el builder, y `--check` comprueba los tres.

### Desactivar una fuente

Se pone en su fichero `"disabled": { "note": "…" }`, con el motivo, y se regenera el catálogo ([ADR-0015](adr/0015-fuentes-trazabilidad-licencias.md), [ADR-0032](adr/0032-desactivacion-fuentes-archivado.md)). El fichero se queda en `data/sources/`, con sus filas y sus ignoradas, y se sigue validando como los demás.

- La fuente sale de `sources` en `catalog.json`, y su ID no hace fallar el test de estabilidad (docs/03 §7). No lleva lápida: al reactivarla, vuelve.
- Sus filas no dan candidatos, así que cada pintura pasa a su siguiente candidato o se queda sin color. Una pintura sin color sigue en el catálogo, con su ID, pero no entra en las pinturas parecidas ni en el buscador (docs/06).
- Un descarte o una elección de esa fuente hacen fallar el build, con el candidato que se publicaría sin ellos ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 4). Si con eso un motivo se queda sin uso, también hay que quitarlo.
- Desde el paso 4 de la fase 5, sus equivalencias oficiales y sus sustituciones desaparecen.

Para reactivarla, se vuelve a poner `"disabled": null`.

### Resumen de las fuentes desactivadas

El builder calcula el color de cada pintura dos veces, con todas las fuentes y sin las desactivadas, y escribe en `disabled-sources.json` lo que cambia: `disabledSources`, los IDs de las fuentes desactivadas, y `colors`, cada pintura cuyo color no es el mismo, con `paintId`, `published` (el color publicado, o `null`), `ifEnabled` (el que tendría con todas las fuentes) y `deltaE2000`, con 2 decimales, o `null` si falta uno de los dos. Va en el orden de las pinturas de `catalog.json`. No compara con ningún catálogo anterior, así que no se mezcla con otros cambios de los datos y se queda igual mientras la fuente siga desactivada. La salida del builder da el número de pinturas que cambian y las que se quedan sin color. El resumen nunca hace fallar el build. Lo que sí lo hace fallar es un dato que sería un error con todas las fuentes activas, como cualquier otro error, con el prefijo «With the disabled sources enabled».

Por ejemplo, con la tabla muestreada de SimoGecko desactivada, Moot Green tendría `published` `#3daf44` (la tabla oficial), `ifEnabled` `#5d9a32` y un ΔE de 7,72.

### Informe de discrepancias

Lista cada pintura cuyo color publicado y algún candidato que pierde, sin descartar, están a un ΔE2000 mayor que 5, el límite a partir del cual docs/06 §3 deja de llamarlos parecidos (`nearest-available`). Cada entrada lleva `paintId`, `published` y `other` (cada uno con `hex`, `origin` y `sourceId`) y `deltaE2000`, con 2 decimales. Va en el orden de las pinturas de `catalog.json` y, dentro de cada pintura, por prioridad. No hace fallar el build: sirve para revisar en el diff de git qué abre o cierra cada reimportación, y para decidir descartes o elecciones. Una discrepancia aceptada, en la que gana el color bueno, se queda en el informe.

## 7. Importadores

Se ejecutan a demanda, nunca en el build ni en la CI. Cada importador corresponde a una fuente y tiene dos partes puras, sin acceso a disco ni a red, que se reutilizarán en `packages/importers` en la fase 6 ([ADR-0017](adr/0017-arquitectura-objetivo-backend.md)):

- **Transcribir**: recibe el contenido de la fuente ya leído y devuelve sus filas literales (§3). No interpreta nada.
- **Conciliar**: recibe la transcripción nueva y los datos curados, y devuelve:
  - para cada fila nueva, que no es clave de ninguna pintura ni está ignorada, una pintura propuesta con su clave, un ID propuesto según [docs/03](03-identificadores.md) §3, su gama y su tipo. Los toma de la regla del grupo de la fila, que está en el código del importador;
  - las diferencias de nombre o de código entre las filas que han cambiado en esta revisión y sus pinturas, como datos estructurados (pintura, campo, valor de la fuente y valor curado);
  - lo que el builder seguirá rechazando, como las claves que ya no están en la fuente.

  Falla si una fila nueva no tiene regla para su grupo o si su ID propuesto ya existe. En esos casos, la pintura se da de alta a mano, con un sufijo si colisiona, o la fila se ignora. Una fuente que nunca propone fichas, como la tabla muestreada de SimoGecko, no tiene reglas: sus filas nuevas quedan pendientes, para añadir a mano su clave a la ficha que corresponda.

El script de cada importador lee los ficheros de la fuente en el commit fijado en su `url`, transcribe y concilia. La lista de ficheros de cada fuente está en `src/cli/source-files.ts` y es la misma que descarga `archive-sources` (§9). Después reemplaza las filas del fichero de la fuente, conserva su `source` y sus ignoradas, añade las pinturas propuestas al fichero de su marca y muestra las diferencias y lo pendiente. No cambia nunca una pintura que ya existe: lo decide Miguel a la vista del informe (§8). Después hay que ejecutar `pnpm format` y `build-catalog`, y revisar el diff, con el del informe de discrepancias. `import-simogecko` importa las dos tablas de SimoGecko, cada una en su fichero.

### Añadir una fuente nueva

1. Crear `sources/<source-id>.json` con su `source`, `"disabled": null`, `"files": []`, sus filas, `ignoredGroups` e `ignoredKeys`, y, si aporta colores, añadirla a su lista de `color-policy.json`.
2. Si la fuente se va a volver a importar, escribir su importador en `src/importers/`: la transcripción y las reglas de sus grupos, con sus tests, y su script en `src/cli/`. Si su `url` es una carpeta de GitHub, listar sus ficheros en `src/cli/source-files.ts`.
3. Cubrir cada fila: con la clave en una pintura existente, con una pintura nueva o ignorándola por su grupo o por su clave, con un motivo de `ignore-reasons.json`.
4. Ejecutar `build-catalog`, que falla mientras quede alguna fila sin cubrir.

## 8. Reglas de curación

1. **Renombrado**: un mismo código en dos documentos del fabricante, con nombres distintos, prueba que es el mismo producto. Se conserva el ID, el nombre anterior pasa a `aliases` y la pintura lleva una clave para cada documento. Las fuentes de terceros sirven como pista, no como prueba, así que los importadores no cambian el nombre de una pintura. Si cambia el código pero no el nombre y el fabricante no lo aclara, se trata como el mismo producto: se actualiza `manufacturerCode` y se deja una `note`.
2. **Nombre oficial**: la pintura lleva el nombre del fabricante aunque la fuente escriba otro. La transcripción conserva el de la fuente y la `note` de la pintura cita el documento que da el oficial.
3. **Clasificación**: cuando el tipo o el acabado metálico de una pintura no coinciden con los de su grupo en la fuente, la `note` cita el documento del fabricante que los da. Por ejemplo, los metálicos de Model Color salen de las posiciones 195-204 de la carta CC329-R00.
4. **Revisiones**: una revisión nueva de un documento conserva el `SourceId`. Se actualizan `url` y `retrievedAt`, se pone `archiveUrl` a `null`, se reemplazan sus filas y se ejecuta `archive-sources`, que cambia los ficheros descargados.
5. **Fuentes de GitHub**: la `url` fija el commit del que se extrajeron los datos.
6. **Exclusiones**: las filas fuera del alcance del MVP se ignoran por su grupo o por su clave, con su motivo. Los productos sin color se ignoran con el motivo `auxiliary`.

## 9. Script `archive-sources`

Archiva cada fuente en la Wayback Machine y descarga sus ficheros con su SHA-256 ([ADR-0015](adr/0015-fuentes-trazabilidad-licencias.md), [ADR-0032](adr/0032-desactivacion-fuentes-archivado.md)). Se ejecuta a demanda, nunca en el build ni en la CI, y solo usa el `fetch` de Node:

```sh
CATALOG_SOURCES_DIR=<carpeta> pnpm --filter @chromatic-wheel/catalog-builder archive-sources
```

Para cada fuente con `url`:

1. **Captura**, si no tiene `archiveUrl`:
   - busca con la API CDX la última captura de la URL exacta con respuesta 200, sin claves;
   - si no hay ninguna, la solicita con Save Page Now 2 y consulta su estado hasta que termina, durante 2 minutos como mucho;
   - anota `https://web.archive.org/web/<fecha>/<url>` en `archiveUrl`.
2. **Descarga** de los ficheros que todavía no están en `files`, en `<carpeta>/<source-id>/<nombre>`:
   - en una página de un fichero de GitHub, su fichero en bruto (`raw.githubusercontent.com`);
   - en una carpeta de GitHub, los ficheros en bruto que lee su importador, como los tres de DonnervS;
   - en cualquier otra fuente, como un PDF del fabricante, la propia `url`.

   Anota la `url`, el `name` y el `sha256` de cada uno, y quita de `files` los que la fuente ya no tiene.

3. **Escritura** del fichero de la fuente, solo si algo ha cambiado. Después hay que ejecutar `pnpm format` y `build-catalog`, y revisar el diff.

- **Reejecución**: solo hace lo que falta, así que se ejecuta otra vez hasta que no falte nada, sin efectos duplicados. Una captura solicitada que no termina a tiempo la encuentra la siguiente ejecución con la API CDX.
- **Ritmo**: una petición a la Wayback Machine cada 5 segundos como mucho, sondeos incluidos. Internet Archive no publica sus límites; sus usuarios hablan de entre 30 y 60 peticiones por minuto, y Save Page Now 2 admite 12 capturas por minuto.
- **Reintentos**: lo que puede ser pasajero (sin respuesta, un 5xx o un 429) se reintenta dos veces, a los 30 y a los 60 segundos, o cuando diga su `Retry-After` si no pasa de 2 minutos. Una respuesta 4xx o un error de Save Page Now (un sitio que bloquea el archivado, el límite diario de una URL) no se reintenta.
- **Si la Wayback Machine deja de responder** después de los reintentos, no se le pide nada más en esa ejecución, porque insistir es lo que hace que bloquee la IP durante una hora. Las descargas siguen.
- **Fallos**: se muestran al momento y otra vez al final, por fuente, con su causa. Lo que falla se queda vacío en el fichero de la fuente, sin impedir el resto, y el script termina con error.
- **Carpeta de descargas**: `CATALOG_SOURCES_DIR`, fuera del repositorio. Solo hace falta si hay algo que descargar.
- **Claves de archive.org**: solo para solicitar capturas. Son las claves S3 de una cuenta gratuita de archive.org, en `https://archive.org/account/s3.php`, y van en `~/.config/internetarchive/ia.ini`, el fichero de la herramienta oficial `ia`, con permisos `600`:

  ```ini
  [s3]
  access = …
  secret = …
  ```

  El script no lo lee si otros usuarios del sistema pueden hacerlo. Las claves nunca van en variables de entorno ni en el repositorio.
