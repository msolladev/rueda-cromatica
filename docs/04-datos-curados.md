# Datos curados de `catalog-builder`

Este documento especifica los datos que mantiene el proyecto y cómo el builder genera `catalog.json` a partir de ellos. Las decisiones están en los ADR [0013](adr/0013-clasificacion-pinturas.md), [0014](adr/0014-origen-seleccion-color.md), [0015](adr/0015-fuentes-trazabilidad-licencias.md), [0019](adr/0019-alcance-minimo-mvp.md), [0030](adr/0030-datos-curados-dos-capas.md) y [0031](adr/0031-varios-candidatos-color.md).

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

- El builder escribe además `packages/catalog-builder/reports/color-discrepancies.json` (§6, paso 8), que no es un dato curado: se genera.
- Los ficheros se leen en orden alfabético, para que la salida sea determinista.
- El nombre de cada fichero de `sources/` y `brands/` coincide con el ID de su fuente o de su marca.

## 3. `sources/<source-id>.json`

Una fuente por fichero, con cuatro claves:

| Clave           | Contenido                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `source`        | la fuente tal como va a `catalog.json`, con las reglas de [docs/02](02-esquema-catalog-json.md) §3                           |
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
   1. Los candidatos son el `hex` o el `gradient` de cada fila, con el origen de su fuente, y su `measuredHex` si la fuente está en `measured`.
   2. Un `gradient` se reduce a su punto medio en CIELAB con blanco D65, calculado con culori, y se recorta canal a canal si cae fuera de sRGB.
   3. El hex se normaliza a minúsculas.
   4. Se ordenan por origen, `measured` > `manufacturer` > `community`, y dentro de cada origen por el orden de su lista en `color-policy.json`.
   5. Se quitan los descartados, y gana el primero que queda, o el de `colorChoice` si lo hay. Sin candidatos, el color es `null`.
   6. El build falla, con la ruta de la ficha, si:
      - un descarte o una elección nombran un candidato que la pintura no tiene, o que da otro hex. El mensaje cita la fila de la fuente con el hex nuevo y, para una elección, el candidato que se publicaría sin ella ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 4);
      - un candidato se descarta dos veces, o se elige y se descarta a la vez;
      - la elección coincide con lo que ya elige la prioridad.
4. **Ensamblado**: junta las fuentes, marcas, gamas y pinturas, sin las claves ni las notas, y las ordena como exige docs/02 §1. Las equivalencias van vacías hasta el paso 4 de la fase 5.
5. **`meta`**: `schemaVersion` es `SUPPORTED_SCHEMA_VERSION`, y `dataVersion` se calcula según docs/02 §4.
6. **Validación final** con `parseCatalog`. Cada problema se sitúa en el fichero y la ruta donde está el dato.
7. **Estabilidad de IDs** frente a la última publicación y a las lápidas ([docs/03](03-identificadores.md) §7).
8. **Escritura** determinista de `apps/web/public/catalog.json` (docs/02 §1) y del informe de discrepancias, `packages/catalog-builder/reports/color-discrepancies.json`. Los dos están excluidos de Prettier, porque su formato lo fija el builder, y `--check` comprueba los dos.

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

El script de cada importador lee la fuente en el commit fijado en su `url`, transcribe y concilia. Después reemplaza las filas del fichero de la fuente, conserva su `source` y sus ignoradas, añade las pinturas propuestas al fichero de su marca y muestra las diferencias y lo pendiente. No cambia nunca una pintura que ya existe: lo decide Miguel a la vista del informe (§8). Después hay que ejecutar `pnpm format` y `build-catalog`, y revisar el diff, con el del informe de discrepancias. `import-simogecko` importa las dos tablas de SimoGecko, cada una en su fichero.

### Añadir una fuente nueva

1. Crear `sources/<source-id>.json` con su `source`, sus filas, `ignoredGroups` e `ignoredKeys`, y, si aporta colores, añadirla a su lista de `color-policy.json`.
2. Si la fuente se va a volver a importar, escribir su importador en `src/importers/`: la transcripción y las reglas de sus grupos, con sus tests, y su script en `src/cli/`.
3. Cubrir cada fila: con la clave en una pintura existente, con una pintura nueva o ignorándola por su grupo o por su clave, con un motivo de `ignore-reasons.json`.
4. Ejecutar `build-catalog`, que falla mientras quede alguna fila sin cubrir.

## 8. Reglas de curación

1. **Renombrado**: un mismo código en dos documentos del fabricante, con nombres distintos, prueba que es el mismo producto. Se conserva el ID, el nombre anterior pasa a `aliases` y la pintura lleva una clave para cada documento. Las fuentes de terceros sirven como pista, no como prueba, así que los importadores no cambian el nombre de una pintura. Si cambia el código pero no el nombre y el fabricante no lo aclara, se trata como el mismo producto: se actualiza `manufacturerCode` y se deja una `note`.
2. **Nombre oficial**: la pintura lleva el nombre del fabricante aunque la fuente escriba otro. La transcripción conserva el de la fuente y la `note` de la pintura cita el documento que da el oficial.
3. **Clasificación**: cuando el tipo o el acabado metálico de una pintura no coinciden con los de su grupo en la fuente, la `note` cita el documento del fabricante que los da. Por ejemplo, los metálicos de Model Color salen de las posiciones 195-204 de la carta CC329-R00.
4. **Revisiones**: una revisión nueva de un documento conserva el `SourceId`. Se actualizan `url` y `retrievedAt` y se reemplazan sus filas.
5. **Fuentes de GitHub**: la `url` fija el commit del que se extrajeron los datos.
6. **Exclusiones**: las filas fuera del alcance del MVP se ignoran por su grupo o por su clave, con su motivo. Los productos sin color se ignoran con el motivo `auxiliary`.
