# Datos curados de `catalog-builder`

Este documento especifica los datos que mantiene el proyecto y a partir de los cuales el builder genera `catalog.json`. Las decisiones están en los ADR [0013](adr/0013-clasificacion-pinturas.md), [0014](adr/0014-origen-seleccion-color.md), [0015](adr/0015-fuentes-trazabilidad-licencias.md) y [0016](adr/0016-datos-curados-json.md).

## 1. Principios

- **Dos capas.**
  - **Lo que dice cada fuente**: transcripción literal, que se puede comprobar contra el original.
  - **La interpretación propia**: IDs, tipos, estados y claves.
- **JSON validado con Zod** en `catalog-builder` y formateado con Prettier. Las notas van en campos `note`.
- **`null` explícito** y arrays siempre presentes, como en `catalog.json`.
- **Nada implícito**: ni tipos heredados de la gama ni valores por defecto ocultos.
- **El builder falla en lugar de adivinar.** Ante una clave sin resolver, una clave ambigua o una fuente sin licencia, el build falla y no se escribe nada.

## 2. Estructura

```
packages/catalog-builder/data/
  sources/<source-id>.json
  brands/<brand-id>.json
  color-policy.json
  tombstones.json
```

Los ficheros se leen en orden alfabético, para que la salida sea determinista.

## 3. `sources/<source-id>.json`

> Ejemplo ficticio: las marcas, nombres, códigos y colores son inventados.

```json
{
  "source": {
    "id": "acme-conversion-chart",
    "kind": "manufacturer",
    "title": "Acme conversion chart",
    "publisher": "Acme Paints",
    "url": "https://example.com/acme-chart.pdf",
    "archiveUrl": null,
    "license": "terms-of-use",
    "licenseUrl": "https://example.com/terms",
    "attribution": null,
    "revision": "rev02",
    "retrievedAt": "2026-11-07",
    "file": { "name": "acme-chart-rev02.pdf", "sha256": "…" },
    "copyUrl": null,
    "enabled": true,
    "note": null
  },
  "paints": [
    {
      "key": "AC-001",
      "name": "Deep Red",
      "code": "AC-001",
      "hex": "#8A1C1C",
      "gradient": null,
      "measuredHex": null,
      "note": null
    }
  ],
  "equivalences": [
    { "from": "AC-001", "to": "Crimson", "marks": ["*"], "note": null }
  ],
  "replacements": [],
  "ignored": [
    {
      "section": "equivalences",
      "key": "AC-900",
      "reason": "Línea Air fuera del MVP"
    }
  ]
}
```

### `source`

| Campo                | Tipo           | Reglas                                                                                                                    |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | `SourceId`     | slug. Identifica el documento, no la revisión. Coincide con el nombre del fichero.                                        |
| `kind`               | enum           | `manufacturer` \| `third-party`. Indica el autor del contenido, no quién aloja la copia.                                  |
| `title`, `publisher` | string         | no vacíos                                                                                                                 |
| `url`                | string \| null | URL oficial `http://` o `https://`, aunque ya no funcione. `null` solo en fuentes impresas.                               |
| `archiveUrl`         | string \| null | `https://web.archive.org/…`. Si `url` es `null`, tiene que ser `null`. Lo rellena `archive-sources`.                      |
| `license`            | string         | identificador SPDX, `terms-of-use`, `unknown` o `none`                                                                    |
| `licenseUrl`         | string \| null | URL de la licencia o de los términos de uso                                                                               |
| `attribution`        | string \| null | texto de atribución que exige la licencia                                                                                 |
| `revision`           | string \| null | revisión del documento (p. ej., `rev05`) o commit del repositorio del que se extrajo                                      |
| `retrievedAt`        | `IsoDate`      | fecha de consulta o de descarga                                                                                           |
| `file`               | objeto \| null | `name` y `sha256` del fichero descargado de la URL oficial, guardado fuera del repositorio. Lo rellena `archive-sources`. |
| `copyUrl`            | string \| null | copia fiel de terceros, si se usó una (§7.3)                                                                              |
| `enabled`            | boolean        | `false` desactiva la fuente (§6)                                                                                          |
| `note`               | string \| null |                                                                                                                           |

A `catalog.json` solo pasan `id`, `kind`, `title`, `publisher`, `url`, `archiveUrl`, `retrievedAt`, `license` y `attribution`. El resto se queda en los datos curados.

### Filas

Cada sección contiene la transcripción literal de lo que dice la fuente. Una fuente puede tener cualquier combinación de secciones, y las vacías se dejan como `[]`.

| Sección        | Campos                                                                                                                                         | Uso                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `paints`       | `key`, `name`, `code` (string \| null), `hex` (string \| null), `gradient` (`{ dark, light }` \| null), `measuredHex` (string \| null), `note` | existencia, nombre y código según la fuente, y candidatos de color |
| `equivalences` | `from`, `to` (claves), `marks` (string[]), `note`                                                                                              | equivalencias oficiales dirigidas `from → to`                      |
| `replacements` | `paint`, `replacement` (claves), `note`                                                                                                        | solo si la fuente dice que X sustituye a Y (§7.2)                  |
| `ignored`      | `section`, `key`, `reason`                                                                                                                     | filas que se excluyen a propósito                                  |

- `key` es la forma en que la fuente identifica la pintura: un código, un nombre o una posición en la carta. Se copia tal cual, erratas incluidas.
- `hex` y los extremos de `gradient` se copian tal cual, en mayúsculas o minúsculas según la fuente. El builder los normaliza a minúsculas.
- `measuredHex` es una medición instrumental que la fuente publica aparte de su `hex`, como hace DonnervS. Su origen siempre es `measured`.
- `marks` guarda las anotaciones literales de la fuente, como el asterisco de las coincidencias aproximadas de la CC073. El catálogo no las usa.
- Una fila de `paints` sin `hex` ni `gradient` aporta identidad, nombre o código, pero no color.

## 4. `brands/<brand-id>.json`

```json
{
  "brand": { "id": "acme", "name": "Acme Paints", "aliases": [] },
  "ranges": [
    { "id": "acme/core", "name": "Acme Core", "status": "active", "note": null }
  ],
  "paints": [
    {
      "id": "acme/core/deep-red",
      "rangeId": "acme/core",
      "name": "Deep Red",
      "aliases": [],
      "manufacturerCode": "AC-001",
      "type": "standard",
      "metallic": false,
      "status": { "kind": "active" },
      "keys": { "acme-conversion-chart": "AC-001" },
      "colorChoice": null,
      "note": null
    }
  ]
}
```

- `brand`, `ranges` y los campos de `paints` comunes con `catalog.json` siguen las reglas de [02-esquema-catalog-json.md](02-esquema-catalog-json.md).
- `id` es el ID congelado ([03-identificadores.md](03-identificadores.md)). El builder nunca lo recalcula.
- `type` se asigna según la clasificación del fabricante ([ADR-0013](adr/0013-clasificacion-pinturas.md)).
- `status.replacement`, cuando no es `null`, lleva `paintId` y `sourceId`, y tiene que corresponder a una fila de la sección `replacements` de esa fuente.
- `keys` asigna a cada `SourceId` la clave con la que esa fuente reconoce la pintura. Una pintura puede tener una clave en cualquier número de fuentes.
- `colorChoice` (`{ sourceId, note }` \| null) fuerza el candidato de color de una fuente. La nota es obligatoria.
- `note` recoge las decisiones de curación; por ejemplo, «se trata como el mismo producto» (docs/03 §5).

## 5. `color-policy.json` y `tombstones.json`

```json
{
  "originOrder": ["measured", "manufacturer", "community"],
  "sourceOrder": {
    "measured": [],
    "manufacturer": ["acme-conversion-chart"],
    "community": []
  },
  "sourceOrigins": { "acme-conversion-chart": "manufacturer" }
}
```

- `sourceOrigins` asigna el `ColorOrigin` de los campos `hex` y `gradient` de cada fuente. `measuredHex` siempre es `measured` ([ADR-0014](adr/0014-origen-seleccion-color.md)):
  - `measured`: medición con un instrumento sobre una muestra pintada.
  - `manufacturer`: hex publicado por el fabricante.
  - `community`: cualquier otro valor, incluidos los de fotos y los obtenidos por scraping.
- Toda fuente que aporte `hex` o `gradient` tiene que aparecer en `sourceOrigins` y en el `sourceOrder` de ese origen. Si aporta `measuredHex`, también tiene que aparecer en `sourceOrder.measured`.

```json
[
  {
    "id": "acme/core/typo-red",
    "entity": "paint",
    "reason": "Alta errónea",
    "retiredAt": "2026-11-07"
  }
]
```

`entity` es `brand`, `range`, `paint` o `source`. Un ID retirado no se reutiliza jamás (docs/03 §6).

## 6. Proceso del builder

1. **Carga y validación** de todos los ficheros con Zod.
2. **Filtro de fuentes**: se descartan las fuentes con `enabled: false`. El build falla si una fuente activa con `license: none` aporta filas.
3. **Índice de claves**: `(sourceId, key) → PaintId`, construido a partir de `keys`. Si una clave apunta a dos pinturas, el build falla.
4. **Resolución de filas**: cada fila de `paints`, `equivalences` y `replacements` se resuelve con el índice. Si una clave no se resuelve y no está en `ignored`, el build falla. Una entrada de `ignored` que no corresponde a ninguna fila también es un error, para evitar exclusiones obsoletas.
5. **Color** de cada pintura:
   1. Los candidatos son los `hex`, `gradient` y `measuredHex` de las filas resueltas, cada uno con su origen.
   2. Si hay `colorChoice`, gana el candidato de esa fuente.
   3. Si no, se aplica `originOrder` y, dentro de cada origen, `sourceOrder`.
   4. Un `gradient` se reduce a su punto medio en CIELAB, calculado con culori a partir de los dos extremos, y se redondea a hex sRGB.
   5. Si no hay candidatos, el color es `null`.
6. **Equivalencias**: cada fila resuelta de `equivalences` genera una `OfficialEquivalence` con el `sourceId` de su fuente.
7. **Validación final** con el `parseCatalog` de `domain` y comprobación de la estabilidad de los IDs (docs/03 §7).
8. **Escritura** determinista de `catalog.json` (docs/02 §1).

### Desactivar una fuente

Para desactivar una fuente basta con poner `enabled: false` en su fichero y regenerar el catálogo:

- Los colores pasan al siguiente candidato o a `null`.
- Las equivalencias y las sustituciones de esa fuente desaparecen.
- Una pintura cuyo `status.replacement` cite esa fuente hace fallar el build. Hay que poner su `replacement` a `null` a mano.
- Los IDs no cambian.

El builder muestra un resumen de los cambios: pinturas que se quedan sin color, que cambian de color y aristas eliminadas.

## 7. Reglas de curación

1. **Renombrado**: un mismo código en dos documentos del fabricante, con nombres distintos, prueba que es el mismo producto. Se conserva el ID, el nombre anterior pasa a `aliases` y la pintura lleva una clave para cada documento. Las reseñas de terceros sirven como pista, no como prueba. Si cambia el código pero no el nombre y el fabricante no lo aclara, se trata como el mismo producto: se actualiza `manufacturerCode` y se deja una `note`.
2. **Sustitución frente a equivalencia**: una fila va en `replacements` solo si la fuente dice expresamente que X sustituye a Y. Las cartas de conversión, como la de GW de 2012 o la de Warpaints → Fanatic, van en `equivalences`.
3. **Copias de terceros**: una fuente de `kind: manufacturer` alojada por un tercero solo es válida si la copia es fiel, es decir, el fichero o la imagen original. En ese caso se rellena `copyUrl`. Una retranscripción no vale.
4. **Revisiones**: una revisión nueva de un documento conserva el `SourceId`. Se actualizan `revision`, `url`, `retrievedAt` y `file`, y se reemplazan sus filas.
5. **Fuentes de GitHub**: `revision` guarda el commit del que se extrajeron los datos.
6. **Exclusiones del MVP**: las filas que apuntan a líneas fuera del alcance van en `ignored` con su motivo. Los productos sin color no se dan de alta.

## 8. Script `archive-sources`

Se ejecuta a demanda con `pnpm --filter @rueda-cromatica/catalog-builder archive-sources`, nunca en el build ni en la CI. Usa el `fetch` de Node, sin dependencias.

- **Archivado**: para cada fuente con `url` y sin `archiveUrl`, consulta si ya existe una captura en la Wayback Machine. Si no existe y la URL responde, solicita una con Save Page Now. Después escribe `archiveUrl` en el fichero de la fuente.
- **Descarga**: para cada fuente con `url` y sin `file`, descarga el fichero oficial a la carpeta indicada en la variable de entorno `RUEDA_SOURCES_DIR`, fuera del repositorio. Después anota `file.name` y `file.sha256`.
- **Reejecución**: se puede ejecutar varias veces sin efectos duplicados, porque solo procesa lo que falta. Los fallos (sitios que bloquean el archivado, errores temporales o URL caídas sin captura) se muestran en la salida y se dejan como estaban, para que se reintenten en la siguiente ejecución.
