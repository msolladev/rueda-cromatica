# ADR-0013: Clasificación de pinturas: gamas, tipos y acabado

- **Estado:** aceptada
- **Fecha:** 2026-11-07
- **Sustituye a:** [ADR-0008](0008-clasificacion-pinturas.md)

## Contexto

El ADR-0008 dejó pendientes los tipos que faltaban y la granularidad de las gamas. El [informe de fuentes de datos](../investigacion/2026-11-fuentes-datos.md) (§3.1 y §3.2) muestra que las líneas del MVP usan clasificaciones que el enum original no cubre: Citadel Dry, pinturas opacas sin distinción entre base y capa (Vallejo, Army Painter, AK y Citadel Colour anterior a 2012), tintas, veladuras y líneas de una capa de otras marcas. Además, Citadel pasa a llamarse Warhammer Colour en 2026, con el mismo producto.

## Decisión

- **Gamas**: una gama por línea de venta del fabricante.
  - Citadel actual: Base, Layer, Shade, Contrast, Technical y Dry.
  - Citadel antigua, como gamas `discontinued`: Citadel Colour (61-xx), Foundation (68-xx), Washes de 2008, tintas antiguas, Glaze y Edge. Las épocas anteriores a 2000 no se modelan.
  - Una pintura retirada de una línea vigente se queda en su gama como `discontinued`.
- **Cambio de nombre de la marca**: se conserva el ID `citadel`. `Brand.name` pasa a «Warhammer Colour» y `Brand.aliases` guarda «Citadel» y «Citadel Colour». `Brand` gana el campo `aliases`, con las mismas reglas que en `Paint`.
- **`PaintType`**: `base`, `layer`, `standard`, `wash`, `ink`, `glaze`, `contrast`, `technical` y `dry`.
  - `standard` es la pintura opaca de una marca que no distingue entre base y capa.
  - `contrast` es la función «pigmento y sombreado en una sola capa», con independencia de la marca: incluye Xpress Color, Speedpaint 2.0 y Quick Gen.
  - El tipo se asigna a partir de la clasificación del fabricante, nunca por criterio propio.
- `metallic: boolean` sigue siendo un atributo independiente del tipo.
- Los productos sin color (mediums, barnices, diluyentes y auxiliares) no entran en el catálogo.

## Alternativas descartadas

- **Asignar `base` o `layer` a las marcas que no los distinguen**: sería inventar una clasificación.
- **Incluir tintas y veladuras dentro de `wash`**: falsearía la futura sugerencia de lavados.
- **Añadir ya `air`, `spray` y `tone`**: no hay datos para ellos en el MVP.
- **Una sola gama para todo Citadel**: se pierde la línea comercial y aumentan las colisiones de slug.
- **Una marca nueva `warhammer`**: duplicaría pinturas y rompería la estabilidad de los IDs (ADR-0001).

## Consecuencias

- `isColorApproximate` incluye `ink` y `glaze` ([ADR-0014](0014-origen-seleccion-color.md)).
- Añadir líneas de aerógrafo, Spray o Tone Pro en el futuro obligará a añadir valores al enum y a subir `schemaVersion`.
- Como todavía no se ha publicado ningún catálogo, estos cambios forman parte de la `schemaVersion` 1.
