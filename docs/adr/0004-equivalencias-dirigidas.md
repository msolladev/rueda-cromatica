# ADR-0004: Equivalencias oficiales como relaciones dirigidas

- **Estado:** aceptada
- **Fecha:** 2026-10-31

## Contexto
Las tablas de los fabricantes dicen "para la pintura X de otra marca, usa nuestra Y". Esas afirmaciones no son simétricas ni transitivas:
- Que A→B y B→C no implica que A→C.
- Que una marca publique X→Y no implica que la marca de Y publique Y→X.

## Decisión
- `OfficialEquivalence` es una arista dirigida `from → to`, con un `sourceId` obligatorio que apunta a una fuente de tipo `manufacturer`.
- No se infieren ni las inversas ni las transitivas.
- La interfaz puede mostrar las equivalencias entrantes, indicando siempre la dirección y la fuente.
- Las equivalencias calculadas (CIEDE2000) se obtienen en el cliente y no se persisten.

## Alternativas descartadas
- **Grupos de equivalencia**: imponen una transitividad que no existe.
- **Relación simétrica**: atribuye a una marca una afirmación que no ha hecho.
- **Guardar las calculadas**: son un dato derivado y se desincronizarían de los colores.

## Consecuencias
- Varias fuentes pueden respaldar la misma arista; la terna `(from, to, sourceId)` es única.
- Las tablas de terceros quedan fuera por ahora. Si se incluyen en la fase 2, se revisará el nombre y el significado de la entidad.
