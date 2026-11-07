# Informes de investigación

Cada informe recoge el estado de unas fuentes o de un tema en una fecha concreta. No es una especificación ni una decisión:

- Las decisiones que se derivan de un informe van en [`docs/adr/`](../adr/README.md).
- La información vigente de cada fuente vive en los datos curados de `catalog-builder`.

## Índice

| Informe                             | Fecha      | Tema                                  | ADR derivados                                                                           |
| ----------------------------------- | ---------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| [2026-11](2026-11-fuentes-datos.md) | 2026-11-07 | Fuentes de datos de pinturas (fase 3) | [0013](../adr/0013-clasificacion-pinturas.md)-[0016](../adr/0016-datos-curados-json.md) |

## Normas

- **Nombre del fichero**: `AAAA-MM-tema-en-kebab-case.md`. Si coinciden dos informes del mismo tema en el mismo mes, se usa `AAAA-MM-DD-tema-en-kebab-case.md`. La fecha exacta va en la cabecera del informe.
- **Inmutabilidad**: un informe no se edita después de su commit. La única excepción es el formato automático de Prettier. Si una investigación se repite, se escribe un informe nuevo con otra fecha.
- **Datos no verificados**: se marcan como tales en el propio informe y no se usan sin comprobarlos antes.
- **Índice**: cada informe nuevo se añade a la tabla anterior en el mismo commit en que se crea. La columna de ADR derivados es la única que se actualiza después.
