# Registro de decisiones de arquitectura (ADR)

Cada fichero recoge una decisión relevante: su contexto, la decisión tomada, las alternativas descartadas y sus consecuencias.

## Índice

| ADR                                            | Decisión                                                             | Estado                                    |
| ---------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| [0001](0001-identificadores-slug-congelado.md) | Identificadores de pintura legibles y congelados                     | aceptada; aplazada en parte por ADR-0019  |
| [0002](0002-validacion-catalogo-zod.md)        | Validación del catálogo con Zod en `domain`                          | aceptada                                  |
| [0003](0003-fiabilidad-color.md)               | Fiabilidad del color, con el origen guardado y "aproximado" derivado | sustituida por ADR-0014                   |
| [0004](0004-equivalencias-dirigidas.md)        | Equivalencias oficiales como relaciones dirigidas                    | aceptada                                  |
| [0005](0005-sustitucion-en-estado.md)          | Sustitución como parte del estado de la pintura                      | aceptada                                  |
| [0006](0006-formato-catalogo.md)               | Formato del catálogo normalizado, plano y determinista               | aceptada                                  |
| [0007](0007-versionado-distribucion.md)        | Versionado y distribución del catálogo                               | aceptada                                  |
| [0008](0008-clasificacion-pinturas.md)         | Clasificación por gama comercial, tipo funcional y acabado metálico  | sustituida por ADR-0013                   |
| [0009](0009-toolchain-pnpm-node.md)            | Toolchain con pnpm y versiones fijadas de forma exacta               | aceptada                                  |
| [0010](0010-lint-formato.md)                   | Lint con ESLint y formato con Prettier                               | aceptada                                  |
| [0011](0011-ci-cd.md)                          | CI/CD con GitHub Actions                                             | aceptada                                  |
| [0012](0012-entornos.md)                       | Entornos de desarrollo, preproducción y producción                   | aceptada                                  |
| [0013](0013-clasificacion-pinturas.md)         | Clasificación de pinturas: gamas, tipos y acabado                    | aceptada                                  |
| [0014](0014-origen-seleccion-color.md)         | Origen y selección del color                                         | aceptada; aplazada en parte por ADR-0019  |
| [0015](0015-fuentes-trazabilidad-licencias.md) | Fuentes: trazabilidad, licencias y desactivación                     | aceptada; aplazada en parte por ADR-0019  |
| [0016](0016-datos-curados-json.md)             | Datos curados en JSON de dos capas                                   | sustituida por ADR-0019                   |
| [0017](0017-arquitectura-objetivo-backend.md)  | Arquitectura objetivo con backend                                    | aceptada                                  |
| [0018](0018-organizacion-codigo-patrones.md)   | Organización del código y patrones                                   | aceptada                                  |
| [0019](0019-alcance-minimo-mvp.md)             | Alcance mínimo del MVP                                               | aceptada                                  |
| [0020](0020-rueda-paquete-independiente.md)    | La rueda de color como paquete independiente                         | aceptada; corregida en parte por ADR-0021 |
| [0021](0021-cambio-modelo-conserva-color.md)   | El cambio de modelo conserva el color base                           | aceptada                                  |
| [0022](0022-busqueda-pinturas-parecidas.md)    | Búsqueda de las pinturas parecidas                                   | aceptada                                  |

## Normas

- **Nombre del fichero**: `NNNN-titulo-en-kebab-case.md`, con numeración correlativa que no se reutiliza nunca.
- **Inmutabilidad**: un ADR aceptado no se reescribe. Si una decisión cambia, se crea un ADR nuevo y el antiguo pasa a `sustituida por ADR-NNNN`.
- **Nombres del código**: los nombres del código que cita un ADR aceptado (paquetes, rutas, identificadores) se actualizan cuando cambian sin que cambie la decisión. El contenido de la decisión no se toca, y el cambio queda en el historial de git.
- **Estados posibles**: `propuesta`, `aceptada`, `rechazada`, `sustituida por ADR-NNNN` `aceptada; aplazada en parte por ADR-NNNN` y `aceptada; corregida en parte por ADR-NNNN`. Los dos últimos indican que la decisión sigue vigente, pero que parte de ella no se aplica hasta una fase posterior o la cambia un ADR posterior, que dice qué parte.
- **Índice**: cada ADR nuevo se añade a la tabla anterior en el mismo commit en que se crea.
- **Numeración de fases**: los ADR 0001-0008 usan la numeración de la hoja de ruta anterior a 2026-11. Su «fase 2» es la actual fase 3 (investigación de fuentes de datos) y su «fase 3», la actual fase 4 (builder, importadores y prototipo de la rueda). Además, los ADR 0017 y 0018 llaman «fase 5» a la del backend, que desde el ADR-0019 es la fase 6; la fase 5 es ahora la del catálogo completo.
- **Módulos de la rueda**: el ADR-0018 sitúa `color`, `harmony` y `scheme` en `domain`; desde el ADR-0020 están en el paquete `color-wheel`.

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
