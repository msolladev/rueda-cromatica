# ADR-0005: Sustitución como parte del estado de la pintura

- **Estado:** aceptada
- **Fecha:** 2026-10-31

## Contexto
Una pintura descatalogada puede tener una sustituta oficial. Es una relación distinta de la equivalencia: pertenece al ciclo de vida de la pintura, no a su color.

## Decisión
- `PaintStatus` es una unión discriminada.
- `discontinued` lleva una `replacement` (`paintId` más `sourceId` de un fabricante) o `null`.
- Se permiten cadenas de sustitución, pero no ciclos.
- `resolveReplacement` sigue la cadena hasta el final.

## Alternativas descartadas
- **Equivalencia de tipo "sustitución"**: mezcla conceptos y permite estados imposibles, como una pintura activa con sustituta.
- **Campo `replacedBy` independiente del estado**: permite el mismo estado imposible y no exige fuente.

## Consecuencias
- Los estados imposibles no se pueden representar.
- Una sustituta que no tenga fuente del fabricante no se modela como tal: se cubre con las equivalencias calculadas.
