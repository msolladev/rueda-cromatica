# ADR-0016: Datos curados en JSON de dos capas

- **Estado:** sustituida por ADR-0019
- **Fecha:** 2026-11-07

## Contexto

Los IDs se congelan en los datos curados, junto a la clave con la que cada fuente reconoce cada pintura ([03-identificadores.md](../03-identificadores.md)). Además, los datos curados tienen que guardar:

- Los extractos de las fuentes.
- Los candidatos de color.
- Las filas que se ignoran a propósito.
- Las notas de curación.

El informe (§3.5) recoge los precedentes de otros proyectos: Markdown que genera JSON, un JSON por marca y tablas Markdown.

## Decisión

- **Formato**: JSON, validado con Zod en `catalog-builder` y formateado con Prettier. Las notas van en campos `note`, no en comentarios.
- **Dos capas**:
  - `sources/<source-id>.json` contiene los metadatos de la fuente, sus filas transcritas de forma literal y las filas ignoradas con su motivo.
  - `brands/<brand-id>.json` contiene la marca, sus gamas y sus pinturas, con el ID congelado, el tipo explícito y las claves de cada fuente.
  - `color-policy.json` contiene el orden de fuentes por origen.
  - `tombstones.json` contiene los IDs retirados.
- El builder resuelve cada fila a través de las claves. Falla si una clave no se resuelve y no está ignorada, y también si una clave apunta a más de una pintura.
- **Reglas de curación**:
  - **Renombrado**: un mismo código en dos documentos del fabricante, con nombres distintos, prueba que es el mismo producto. Se conserva el ID y el nombre anterior pasa a `aliases`. Las reseñas de terceros sirven como pista, no como prueba.
  - **Sustitución frente a equivalencia**: hay `replacement` solo si la fuente del fabricante dice que X sustituye a Y. Las cartas de conversión, como la de GW de 2012 o la de Warpaints → Fanatic, generan equivalencias oficiales dirigidas.

El detalle está en [04-datos-curados.md](../04-datos-curados.md).

## Alternativas descartadas

- **YAML**: añade una dependencia y convierte en números los códigos como `72.010`, que pierden el cero final.
- **Markdown**: su análisis es frágil, y Prettier rellena las columnas de las tablas, así que los diffs se vuelven ruidosos.
- **CSV**: no sirve para datos anidados y necesita un parser.
- **TS con `satisfies`**: convierte los datos en código y ralentiza `tsc`.
- **El `paintId` dentro de cada fila de la fuente**: mezcla la transcripción con la interpretación y repite el mismo ID en todas las fuentes.
- **Contar las cartas de conversión como sustituciones**: no admite relaciones de uno a muchos y presenta como sucesión oficial lo que el fabricante solo presenta como un parecido.

## Consecuencias

- Editar a mano es algo más incómodo que con YAML. Zod 4 puede generar un JSON Schema para que el editor ofrezca autocompletado.
- En el MVP, `replacement` será casi siempre `null`.
