# ADR-0001: Identificadores de pintura legibles y congelados

- **Estado:** aceptada; aplazada en parte por ADR-0019
- **Fecha:** 2026-10-31

## Contexto

Los IDs de pintura se referencian desde las equivalencias, las sustituciones y, en el futuro, la colección del usuario. Tienen que ser estables, legibles e independientes del nombre comercial, porque los fabricantes renombran y descatalogan pinturas.

## Decisión

- El ID es un slug jerárquico `brand/range/paint`.
- Se genera una sola vez a partir del nombre, se guarda en los datos curados y nunca se recalcula.
- Es opaco para el código: nunca se descompone para obtener información.
- Su estabilidad la garantizan un test del builder y una lista de lápidas.

El detalle está en [03-identificadores.md](../03-identificadores.md).

## Alternativas descartadas

- **ULID**: daría la misma estabilidad, porque también habría que guardarlo y asociarlo a una clave natural, pero sería ilegible en el JSON, los diffs, los tests y los logs.
- **Código del fabricante**: no todas las gamas tienen un código por pintura verificable, sobre todo las descatalogadas.
- **Híbrido código/slug**: obligaría a mantener dos formatos de ID a la vez.
- **Slug recalculado en cada build**: cambiaría con cada renombrado y rompería las referencias.

## Consecuencias

- Tras un renombrado o un cambio de gama, el ID muestra el nombre o la gama antiguos. Se acepta porque el ID no se muestra en la interfaz.
- Exige disciplina con los datos curados, protegida por el test de estabilidad.
