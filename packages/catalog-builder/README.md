# @chromatic-wheel/catalog-builder

Herramienta de línea de comandos que genera `apps/web/public/catalog.json`, el catálogo de pinturas que carga la web. No es una librería: no la importa ningún otro paquete.

- **El builder** lee los datos que mantiene el proyecto, en `data/`, en dos capas: lo que dice cada fuente, transcrito de forma literal en `data/sources/`, y las pinturas curadas de cada marca en `data/brands/`, con las claves que las cruzan con las filas de cada fuente. Comprueba que cada fila tenga su pintura o esté ignorada con su motivo, elige el color de cada pintura entre los candidatos de sus fuentes y escribe el catálogo de forma determinista. Falla en lugar de adivinar, y no escribe nada si algo no cuadra. La CI lo vuelve a generar y falla si no coincide con el versionado.
- **El color**: gana el mejor candidato por origen (`measured` > `manufacturer` > `community`) y, dentro de cada origen, por el orden de `data/color-policy.json`. Cada ficha puede descartar candidatos, con un motivo, o elegir uno a mano, con una nota. Los dos fijan el hex que se revisó, y el build falla si la fuente lo cambia. Además, el builder escribe `reports/color-discrepancies.json` con las pinturas en las que el color publicado y otro candidato están a un ΔE mayor que 5, para revisarlas en el diff.
- **La estabilidad de IDs**: el builder compara los IDs con los del catálogo de la última publicación (la etiqueta de git `release/` más reciente, [docs/03](../../docs/03-identificadores.md) §7) y con las lápidas de `data/tombstones.json`. Un ID publicado no puede desaparecer salvo que se retire con una lápida, y un ID retirado no puede volver. Mientras no haya ninguna publicación, solo se comprueban las lápidas.
- **Los importadores** transcriben una fuente externa (las dos tablas de SimoGecko para Citadel, la oficial y la muestreada, y los datos de DonnervS para el resto de marcas) en su fichero de `data/sources/`, proponen una pintura para cada fila nueva y listan lo que hay que decidir a mano. Nunca cambian una pintura que ya existe. Se ejecutan a demanda, y el cambio se revisa en el diff de git antes del commit.

Los comandos están en el [README de la raíz](../../README.md#comandos).

## Documentación

- Especificación: [docs/04](../../docs/04-datos-curados.md), con el formato del catálogo en [docs/02](../../docs/02-esquema-catalog-json.md) y la estabilidad de IDs en [docs/03](../../docs/03-identificadores.md) §6-7.
