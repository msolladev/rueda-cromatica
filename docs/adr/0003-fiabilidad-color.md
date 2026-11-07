# ADR-0003: Fiabilidad del color, con el origen guardado y "aproximado" derivado

- **Estado:** sustituida por ADR-0014
- **Fecha:** 2026-10-31

## Contexto

El hex de las metálicas, los lavados, las contrast y las técnicas no representa bien el resultado sobre la miniatura. Además, los hex de origen comunitario suelen sacarse a ojo de muestras o de fotos. Hay que avisar al usuario sin perder la trazabilidad del dato.

## Decisión

- Cada color guarda `hex`, `origin` (`manufacturer` | `measured` | `community`) y `sourceId`.
- Que un color sea "aproximado" no se guarda: lo calcula `domain`. Lo es si se cumple al menos una de estas condiciones:
  - la pintura es `metallic`,
  - su `type` es `wash`, `contrast` o `technical`,
  - el `origin` del color es `community`.
- Si ninguna fuente aporta un hex, `color` es `null`.
- Cada pintura tiene un único color.

## Alternativas descartadas

- **Booleano en el JSON**: se pierde el origen, y cambiar la regla obligaría a regenerar el catálogo.
- **Niveles de confianza (alta/media/baja)**: son subjetivos y no permiten saber de dónde sale el dato.
- **Varios colores por pintura, uno por fuente**: sería más fiel, pero complica la rueda y el Delta E. YAGNI en el MVP.

## Consecuencias

- Cambiar la regla no requiere tocar los datos.
- Amplía la regla del documento del proyecto, que solo contemplaba metálicas, lavados y contrast: ahora también incluye las técnicas y los hex de origen comunitario.
- La prioridad entre orígenes para elegir el único hex de cada pintura queda para la fase 2.
