# Registro de decisiones de arquitectura (ADR)

Cada fichero recoge una decisión relevante: su contexto, la decisión tomada, las alternativas descartadas y sus consecuencias.

## Índice

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-identificadores-slug-congelado.md) | Identificadores de pintura legibles y congelados | aceptada |
| [0002](0002-validacion-catalogo-zod.md) | Validación del catálogo con Zod en `domain` | aceptada |
| [0003](0003-fiabilidad-color.md) | Fiabilidad del color, con el origen guardado y "aproximado" derivado | aceptada |
| [0004](0004-equivalencias-dirigidas.md) | Equivalencias oficiales como relaciones dirigidas | aceptada |
| [0005](0005-sustitucion-en-estado.md) | Sustitución como parte del estado de la pintura | aceptada |
| [0006](0006-formato-catalogo.md) | Formato del catálogo normalizado, plano y determinista | aceptada |
| [0007](0007-versionado-distribucion.md) | Versionado y distribución del catálogo | aceptada |
| [0008](0008-clasificacion-pinturas.md) | Clasificación por gama comercial, tipo funcional y acabado metálico | aceptada |

## Normas

- **Nombre del fichero**: `NNNN-titulo-en-kebab-case.md`, con numeración correlativa que no se reutiliza nunca.
- **Inmutabilidad**: un ADR aceptado no se reescribe. Si una decisión cambia, se crea un ADR nuevo y el antiguo pasa a `sustituida por ADR-NNNN`.
- **Estados posibles**: `propuesta`, `aceptada`, `rechazada`, `sustituida por ADR-NNNN`.
- **Índice**: cada ADR nuevo se añade a la tabla anterior en el mismo commit en que se crea.

## Plantilla

```markdown
# ADR-NNNN: Título

- **Estado:** propuesta
- **Fecha:** AAAA-MM-DD

## Contexto
## Decisión
## Alternativas descartadas
## Consecuencias
```
