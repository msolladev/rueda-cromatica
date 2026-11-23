# Datos curados de `catalog-builder`

Este documento especifica los datos que mantiene el proyecto y cómo el builder genera `catalog.json` a partir de ellos. Las decisiones están en los ADR [0013](adr/0013-clasificacion-pinturas.md), [0014](adr/0014-origen-seleccion-color.md), [0015](adr/0015-fuentes-trazabilidad-licencias.md), [0019](adr/0019-alcance-minimo-mvp.md), [0030](adr/0030-datos-curados-dos-capas.md), [0031](adr/0031-varios-candidatos-color.md), [0032](adr/0032-desactivacion-fuentes-archivado.md), [0033](adr/0033-equivalencias-oficiales-lineas-vigentes.md), [0034](adr/0034-warpaints-originales-sustituciones.md) y [0035](adr/0035-lineas-antiguas-citadel.md).

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

Una fuente por fichero, con ocho claves:

| Clave           | Contenido                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `source`        | la fuente tal como va a `catalog.json`, con las reglas de [docs/02](02-esquema-catalog-json.md) §3                           |
| `disabled`      | `null`, o `{ note }` si la fuente está desactivada, con el motivo en la nota (§6, «Desactivar una fuente»)                   |
| `files`         | los ficheros que ha descargado `archive-sources` (§9), cada uno con su `url`, su `name` y su `sha256`. Vacío hasta entonces  |
| `paints`        | las filas de la fuente, todas y en su orden, copiadas de forma literal                                                       |
| `equivalences`  | en una carta de equivalencias, sus parejas de filas (§3.1); vacío en las demás fuentes                                       |
| `replacements`  | las sustituciones que afirma un documento del fabricante (§3.2); vacío en las demás fuentes                                  |
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

| Fuente                              | Clave                               | Ejemplo                           |
| ----------------------------------- | ----------------------------------- | --------------------------------- |
| `donnervs-miniature-paints`         | el código del fabricante            | `72.120`                          |
| `simogecko-citadel-colours`         | el tipo y el nombre                 | `technical/Nurgles Rot`           |
| `simogecko-citadel-colours-sampled` | el nombre                           | `Macragge Blue`                   |
| `arcturus5404-miniature-paints`     | el grupo y el nombre                | `Warpaints/Matt Black`            |
| las cartas de equivalencias (§3.1)  | el código, o la columna y el nombre | `72.051`, `Citadel/Abbadon Black` |
| los documentos de GW (§3.3)         | el código, o el nombre              | `61-32`, `Necron Abyss`           |

SimoGecko no tiene códigos, y su tabla oficial repite nombres entre tipos (Abaddon Black es `base` y `spray`), así que en ella el nombre solo no basta. Arcturus deja sin código muchas filas y repite nombres entre grupos, así que su clave es el grupo y el nombre; una fila que repite grupo y nombre, como las dos de Kommando Khaki de su tabla de Citadel, lleva detrás su número de aparición (`Foundation (discontinued)/Kommando Khaki (2)`). La tabla muestreada solo tiene Base y Layer, sin tipo y sin nombres repetidos.

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

### 3.1. Cartas de equivalencias

Las cartas de conversión de los fabricantes, en PDF, con el reparto del [ADR-0033](adr/0033-equivalencias-oficiales-lineas-vigentes.md): entran las equivalencias entre líneas vigentes, y las de líneas descatalogadas llegan en el paso 5 de la fase 5.

| Fuente                                         | Carta                                                  | Qué relaciona                                                                   |
| ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `vallejo-cc266`                                | CC266 de Vallejo                                       | Game Color con Game Air, Hobby Paint y Citadel; Wash y Xpress Color con Citadel |
| `the-army-painter-fanatic-conversion-chart`    | Warpaints Fanatic Conversion Chart de The Army Painter | Fanatic con los Warpaints originales, Warpaints Air y Citadel                   |
| `ak-interactive-3gen-equivalence-table`        | Tabla de equivalencias de AK (`EQUIVALENCIAS2023`)     | 3rd Gen con Model Color, Game Color, Citadel actual y Citadel antiguo           |
| `the-army-painter-warpaints-conversion-chart`  | Conversion Chart de The Army Painter (2020)            | Los Warpaints originales con Citadel (`GM`) y Vallejo (`AV`)                    |
| `games-workshop-citadel-conversion-chart-2012` | Citadel Conversion Chart de Games Workshop (2012)      | Citadel Colour, Foundation y Washes con la gama de Citadel de 2012              |

- **`paints`** nombra cada pintura una vez, en el orden en que aparece, aunque salga en varias filas. Su `group` es la columna o la línea de la carta. Su clave es el código tal como lo escribe la carta, si lo da (`72.051`, `AK11029`), con la columna delante si es un código de otra marca sin su prefijo (`Vallejo MC/951`); si no, la columna y el nombre literal (`Citadel/Abbadon Black`, `GW/Fulgrim Pink`, `WP/Matt White`), porque un mismo nombre puede estar en varias columnas. Una fila sin nombre en la carta, como las de AK, lleva `name` vacío. Ninguna lleva color.
- **`equivalences`**: las parejas `{ from, to, note }` de claves de `paints`, en el orden y la dirección de la carta. Una casilla con dos códigos, como «049/047», son dos parejas con la nota «Casilla «049/047».». Una casilla vacía no da ninguna. Una pareja no puede unir una fila consigo misma ni repetirse.
- **Lo que no entra se ignora** como en cualquier fuente: por grupo (Game Air y Warpaints Air con `airbrush`, Hobby Paint con `out-of-scope-line`) o por clave (Dawnstone, que es Layer y Dry, con `ambiguous`; un Model Color retirado con `not-in-current-chart`; una errata que repite una pintura que la carta ya escribe bien, con `duplicate-row`).
- **Una errata** se resuelve con la clave literal en la ficha, cuya `note` cita la carta («CC266 escribe «Abbadon Black».»), sin añadir un alias.
- **La carta de 2012** es la página 120 de la White Dwarf 388, una imagen sin texto: está transcrita a mano, sin importador ([ADR-0035](adr/0035-lineas-antiguas-citadel.md)). Sus columnas son `Old Citadel Colour` y `New paint range`, con las claves `Old/…` y `New/…`, y conserva el apóstrofo tipográfico («Gehenna’s Gold»). Un test coteja sus pinturas antiguas con los documentos de §3.3, que tienen texto.
- **La carta de 2020** es una imagen sin texto: está transcrita a mano, sin importador ([ADR-0034](adr/0034-warpaints-originales-sustituciones.md)). Un fragmento de una casilla doble que es el nombre completo de otra casilla de su columna («Agrax/ Reikland») se transcribe con ese nombre, porque una pintura tiene una sola clave por fuente, y la nota de la pareja guarda la casilla literal. Un test coteja sus Warpaints con la carta de Fanatic y su clasificación con los recuentos del set completo de The Army Painter.

Un ejemplo real, la fila de 72.051 Black de CC266:

```json
"paints": [
  { "key": "72.051", "group": "Game Color", "name": "Black", "code": "72.051", "hex": null, "gradient": null, "measuredHex": null, "finish": null, "colourless": false },
  { "key": "76.051", "group": "Game Air", "name": "Black", "code": "76.051", "hex": null, "gradient": null, "measuredHex": null, "finish": null, "colourless": false },
  { "key": "Citadel/Abbadon Black", "group": "Citadel", "name": "Abbadon Black", "code": null, "hex": null, "gradient": null, "measuredHex": null, "finish": null, "colourless": false }
],
"equivalences": [
  { "from": "72.051", "to": "76.051", "note": null },
  { "from": "72.051", "to": "Citadel/Abbadon Black", "note": null }
]
```

`72.051` es la clave de `vallejo/game-color/black`, `Citadel/Abbadon Black` la de `citadel/base/abaddon-black` y el grupo Game Air está ignorado, así que la carta publica `vallejo/game-color/black → citadel/base/abaddon-black` y nada más.

### 3.2. Sustituciones

Un documento del fabricante que dice que una pintura sustituye a otra ([ADR-0005](adr/0005-sustitucion-en-estado.md)) lista en `replacements` las parejas `{ from, to, note }`: la clave de la fila de la pintura descatalogada y la de la que la sustituye, como en `equivalences`. Una carta de conversión da equivalencias, no sustituciones. Solo un documento de tipo `manufacturer` puede tenerlas, y nombra como mucho una sustituta por pintura. Hoy ninguna fuente tiene sustituciones: la carta de GW de 2012 es de conversión, y la página de los Washes de 2008 sustituye la línea de las tintas, no pinta a pinta ([ADR-0035](adr/0035-lineas-antiguas-citadel.md)).

### 3.3. Documentos de Games Workshop de las líneas antiguas

Prueban qué pinturas tenía cada línea antigua de Citadel ([ADR-0035](adr/0035-lineas-antiguas-citadel.md)). Ninguno da color.

| Fuente                                      | Documento                                               | Qué prueba                                               |
| ------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| `games-workshop-paints-inks-checklist-2004` | Paints & Inks Range Checklist (2004), PDF con texto     | Citadel Colour: 65 pinturas y tintas con su código 61-xx |
| `games-workshop-foundation-paints-2008`     | What Are Citadel Foundation Paints? (2008), página web  | Las 18 Foundation                                        |
| `games-workshop-citadel-washes-2008`        | Using the New Citadel Washes (2008), página 4 de la web | Los 8 Washes                                             |

- **Su original ya no existe**: cada uno se lee de una captura de la Wayback Machine cuyo SHA-1 coincide con el que da la API CDX, la misma que guarda su `archiveUrl`. `src/cli/source-files.ts` lista la captura en bruto (`<fecha>id_`) y el nombre de su fichero, porque una página termina en `/`. La carta de 2012 (§3.1) se lee igual.
- **Lo que no entra**: el barniz y el bote vacío de la hoja de control, con `auxiliary`.
- **Lo que su grupo no distingue**: la hoja de control no separa las tintas ni las metálicas, así que se corrigen en la ficha con una nota que cita su versión de bolsillo, que las agrupa en «INKS» y «METALLICS» (§8).

## 4. `brands/<brand-id>.json`

Un objeto con tres claves: `brand` (la marca), `ranges` (sus gamas) y `paints` (sus pinturas curadas).

- `brand` y `ranges` siguen las reglas de [docs/02](02-esquema-catalog-json.md) §3. El `brandId` de cada gama es el de la marca del fichero.
- Cada pintura tiene los campos de la pintura de `catalog.json` salvo `color`, que el builder elige entre los candidatos de sus fuentes (§6), y la sustituta, que el builder toma de las fuentes (§3.2), más cuatro campos:
  - `keys`: la lista de sus claves, una por fuente como mucho y al menos una ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 6). Cada clave es `{ sourceId, key }`. Es una lista y no un objeto por fuente porque `JSON.parse` sobrescribe sin avisar las claves duplicadas (docs/02 §1).
  - `colorChoice` (objeto \| null): la elección manual de un candidato que la prioridad no elegiría, con `sourceId`, `origin`, `hex` y una `note` obligatoria.
  - `rejectedColors`: los candidatos descartados, cada uno con `sourceId`, `origin`, `hex`, `reasonId` (un motivo de `ignore-reasons.json`) y `note` (string \| null).
  - `note` (string \| null): las demás decisiones de curación, como la carta que prueba que una pintura es metálica o la página del fabricante que da el nombre oficial.
- **Un candidato** se identifica por su fuente y su origen: una fila da como mucho un hex por origen, su `hex` o `gradient` y su `measuredHex`. El `hex` de una elección o de un descarte es el que daba el candidato al revisarlo, en la forma publicada (`#rrggbb` en minúsculas, y el punto medio si es un degradado). Si el candidato cambia, el build falla para revisarlo ([ADR-0031](adr/0031-varios-candidatos-color.md)).
- **Descartar o elegir**: un descarte quita un candidato y deja que la prioridad elija entre los demás, así que una fuente mejor que llegue después gana sola. Una elección fija uno aunque la prioridad diga otro. Para corregir un color mal tomado se descarta; solo se elige cuando el bueno no es el siguiente por prioridad.
- `id` es el ID congelado ([docs/03](03-identificadores.md)). El builder nunca lo recalcula.
- El `rangeId` de cada pintura es una gama del mismo fichero.
- `type` y `metallic` siguen la clasificación del fabricante ([ADR-0013](adr/0013-clasificacion-pinturas.md)).
- `status` es `{ "kind": "active" }` o `{ "kind": "discontinued", "replacementChoice": null }`. Solo se marca descatalogada con un documento del fabricante; el de una línea entera, como el blog de The Army Painter que retira los Warpaints originales, está en el ADR de esa línea ([ADR-0034](adr/0034-warpaints-originales-sustituciones.md)). `replacementChoice` es `null` o `{ sourceId, note }`, el documento cuya sustituta se publica cuando dos documentos nombran sustitutas distintas ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 1).

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
- **`color-policy.json`**: tres listas de fuentes, `measured`, `manufacturer` y `community`, en orden de preferencia dentro de su origen ([ADR-0014](adr/0014-origen-seleccion-color.md)). Hoy, DonnervS en `measured`, y en `community` DonnervS, las dos tablas de SimoGecko, la muestreada por delante de la oficial ([ADR-0031](adr/0031-varios-candidatos-color.md)), y Arcturus la última, que solo aporta los Warpaints originales y las líneas antiguas de Citadel ([ADR-0034](adr/0034-warpaints-originales-sustituciones.md), [ADR-0035](adr/0035-lineas-antiguas-citadel.md)).
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
   - una ignorada o un descarte citan un motivo que no existe, o un motivo no lo usa nadie;
   - una pareja de `equivalences` cita una clave que no está en su fuente, o se repite;
   - una pareja de `replacements` cita una clave que no está en su fuente, su fuente no es de tipo `manufacturer`, o la fuente nombra dos sustitutas para la misma fila.
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
4. **Ensamblado**: junta las fuentes activas, las marcas, las gamas y las pinturas, sin las claves ni las notas, y las ordena como exige docs/02 §1. Cada pareja de una fuente activa cuyas dos filas son claves de pinturas es una equivalencia oficial `from → to` con esa fuente; si una de las dos está ignorada, la pareja no llega al catálogo. No se infieren ni las inversas ni las transitivas ([ADR-0004](adr/0004-equivalencias-dirigidas.md)).
   - **Sustituta** de cada pintura descatalogada: cada pareja de `replacements` de una fuente activa cuyas dos filas son claves de pinturas es lo que afirma esa fuente. Si los documentos coinciden, se publica el primero por ID; si nombran sustitutas distintas, la de `replacementChoice`. El build falla, con la ruta de la ficha, si un documento sustituye una pintura activa, si los documentos se contradicen sin elección, si la elección sobra o si cita un documento que no nombra ninguna, también por estar desactivado (decisión 4 del ADR-0019), con la sustituta que se publicaría sin ella.
5. **`meta`**: `schemaVersion` es `SUPPORTED_SCHEMA_VERSION`, y `dataVersion` se calcula según docs/02 §4.
6. **Validación final** con `parseCatalog`. Cada problema se sitúa en el fichero y la ruta donde está el dato.
7. **Estabilidad de IDs** frente a la última publicación y a las lápidas, con las fuentes desactivadas ([docs/03](03-identificadores.md) §7).
8. **Escritura** determinista de `apps/web/public/catalog.json` (docs/02 §1), del informe de discrepancias y del resumen de las fuentes desactivadas, en `packages/catalog-builder/reports/`. Los tres están excluidos de Prettier, porque su formato lo fija el builder, y `--check` comprueba los tres.

### Desactivar una fuente

Se pone en su fichero `"disabled": { "note": "…" }`, con el motivo, y se regenera el catálogo ([ADR-0015](adr/0015-fuentes-trazabilidad-licencias.md), [ADR-0032](adr/0032-desactivacion-fuentes-archivado.md)). El fichero se queda en `data/sources/`, con sus filas y sus ignoradas, y se sigue validando como los demás.

- La fuente sale de `sources` en `catalog.json`, y su ID no hace fallar el test de estabilidad (docs/03 §7). No lleva lápida: al reactivarla, vuelve.
- Sus filas no dan candidatos, así que cada pintura pasa a su siguiente candidato o se queda sin color. Una pintura sin color sigue en el catálogo, con su ID; no entra en las pinturas parecidas, pero sí en el buscador (docs/06 §9, docs/07 §15).
- Un descarte o una elección de esa fuente hacen fallar el build, con el candidato que se publicaría sin ellos ([ADR-0019](adr/0019-alcance-minimo-mvp.md), decisión 4). Si con eso un motivo se queda sin uso, también hay que quitarlo.
- Sus equivalencias oficiales y sus sustituciones desaparecen.

Para reactivarla, se vuelve a poner `"disabled": null`.

### Resumen de las fuentes desactivadas

El builder calcula el color de cada pintura dos veces, con todas las fuentes y sin las desactivadas, y escribe en `disabled-sources.json` lo que cambia: `disabledSources`, los IDs de las fuentes desactivadas; `equivalences`, las equivalencias oficiales que publicarían, en el orden de `catalog.json`; `colors`, cada pintura cuyo color no es el mismo, con `paintId`, `published` (el color publicado, o `null`), `ifEnabled` (el que tendría con todas las fuentes) y `deltaE2000`, con 2 decimales, o `null` si falta uno de los dos, y `replacements`, cada pintura cuya sustituta no es la misma, con `paintId`, `published` e `ifEnabled`. Va en el orden de las pinturas de `catalog.json`. No compara con ningún catálogo anterior, así que no se mezcla con otros cambios de los datos y se queda igual mientras la fuente siga desactivada. La salida del builder da el número de pinturas que cambian y las que se quedan sin color. El resumen nunca hace fallar el build. Lo que sí lo hace fallar es un dato que sería un error con todas las fuentes activas, como cualquier otro error, con el prefijo «With the disabled sources enabled».

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

El script de cada importador lee los ficheros de la fuente en el commit fijado en su `url`, o en su captura si el original ya no existe (§3.3), transcribe y concilia. La lista de ficheros de cada fuente está en `src/cli/source-files.ts` y es la misma que descarga `archive-sources` (§9). Después reemplaza las filas del fichero de la fuente, conserva su `source` y sus ignoradas, añade las pinturas propuestas al fichero de su marca y muestra las diferencias y lo pendiente. No cambia nunca una pintura que ya existe: lo decide Miguel a la vista del informe (§8). Después hay que ejecutar `pnpm format` y `build-catalog`, y revisar el diff, con el del informe de discrepancias. `import-simogecko` importa las dos tablas de SimoGecko, cada una en su fichero. `import-arcturus` importa las tablas de The Army Painter y de Citadel de Arcturus y solo propone pinturas de los grupos de los Warpaints originales; una pintura del grupo cuyo tipo no es el del grupo, como las metálicas y los efectos de «Warpaints», se corrige en su ficha con una nota (§8). De su tabla de Citadel solo se toman los colores de las pinturas antiguas, que proponen los documentos de GW. `import-games-workshop` importa los tres documentos de GW de §3.3 y propone sus pinturas en la gama de cada línea; las tintas y las metálicas de la hoja de control se corrigen en su ficha. Un importador también propone descatalogada la pintura de una gama descatalogada.

### Cartas de equivalencias

`import-charts` transcribe las tres cartas de §3.1 desde la `url` de cada una, que es su PDF ([ADR-0033](adr/0033-equivalencias-oficiales-lineas-vigentes.md)):

- **Transcribir**: `src/cli/pdf.ts` lee el texto del PDF con su posición, con [pdf.js](https://github.com/mozilla/pdf.js), y una función pura por carta, en `src/importers/`, lo convierte en filas y parejas con la regla de columnas de esa carta. Falla si sobra algún texto de la tabla o si las cabeceras cambian, y los tests fijan el número de filas de cada tabla.
- **Conciliar**: una carta nunca propone pinturas. A cada fila nueva, ni clave ni ignorada, le añade su clave en la única pintura con su código o con su nombre (o un alias), letra por letra salvo el apóstrofo tipográfico, que cuenta como el recto. Lo demás (una errata, un nombre de dos pinturas, una pintura que no está en el catálogo) queda pendiente, para escribir la clave a mano o ignorar la fila. Solo añade claves: no cambia ningún otro campo de las fichas.

Las cartas de Warpaints de 2020 y de GW de 2012 no están en `import-charts`: son imágenes y se transcribieron a mano (§3.1).

Una revisión nueva de una carta se toma cambiando su `url` y `retrievedAt`, poniendo `archiveUrl` a `null` y ejecutando `import-charts` y `archive-sources`.

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
   - en una fuente cuyo original ya no existe, como los documentos de GW, la captura en bruto que lista `src/cli/source-files.ts` (§3.3);
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
