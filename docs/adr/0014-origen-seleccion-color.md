# ADR-0014: Origen y selección del color

- **Estado:** aceptada
- **Fecha:** 2026-11-07
- **Sustituye a:** [ADR-0003](0003-fiabilidad-color.md)

## Contexto

El ADR-0003 fijó un único color por pintura y dejó pendiente la prioridad entre orígenes. Según el [informe de fuentes de datos](../investigacion/2026-11-fuentes-datos.md):

- Ningún fabricante del MVP publica valores medidos.
- Los hex de Citadel son muestras digitales de marketing, que en metálicos, Shade, Contrast y Technical se dan como degradados.
- Las fuentes discrepan entre sí.
- A 2026-11-07, la única fuente de mediciones (DonnervS) solo tiene una pintura.

## Decisión

- Cada pintura tiene un único `color` en `catalog.json`, con `hex`, `origin` y `sourceId`, o `null`. Todos los candidatos se guardan en los datos curados, cada uno con su fuente.
- **Orígenes**:
  - `measured`: medición con un instrumento sobre una muestra pintada.
  - `manufacturer`: hex publicado por el fabricante.
  - `community`: cualquier otro, incluidos los hex sacados de fotos y por scraping.
- **Prioridad**: `measured` > `manufacturer` > `community`. Dentro de un mismo origen se aplica el orden de fuentes declarado en los datos curados. Se admite una elección manual por pintura, siempre con una nota.
- **Degradados**: el builder publica el punto medio en CIELAB de los dos extremos literales, calculado de forma determinista con culori. El origen sigue siendo `manufacturer`, y los datos curados guardan los dos extremos.
- **Color aproximado** (derivado en `domain`): un color es aproximado si la pintura es `metallic`, si su `type` ∈ {`wash`, `ink`, `glaze`, `contrast`, `technical`} o si su `origin` es `community`.

## Alternativas descartadas

- **Varios colores por pintura en el catálogo**: complicaría la rueda y el ΔE (YAGNI).
- **Prioridad `manufacturer` > `measured`**: antepondría un color de marketing a una medición.
- **Un extremo del degradado tal cual**: desviaría siempre el ΔE hacia lo oscuro o hacia lo claro.
- **Ignorar los degradados**: dejaría sin color a muchas pinturas.

## Consecuencias

- El color de una pintura antes de una reformulación solo queda en los datos curados.
- En la práctica, el MVP tendrá hex `manufacturer` en Citadel y `community` en el resto de marcas.
- La regla de color aproximado se puede cambiar sin regenerar los datos.
