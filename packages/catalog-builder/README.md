# @chromatic-wheel/catalog-builder

Herramienta de línea de comandos que genera `apps/web/public/catalog.json`, el catálogo de pinturas que carga la web. No es una librería: no la importa ningún otro paquete.

- **El builder** lee los datos que mantiene el proyecto, en `data/` (las fuentes y un fichero por marca), los valida con los esquemas de `domain` y escribe el catálogo de forma determinista. Falla en lugar de adivinar, y no escribe nada si algo no cuadra. La CI lo vuelve a generar y falla si no coincide con el versionado.
- **La estabilidad de IDs**: el builder compara los IDs con los del catálogo de la última publicación (la etiqueta de git `release/AAAA-MM-DD` más reciente) y con las lápidas de `data/tombstones.json`. Un ID publicado no puede desaparecer salvo que se retire con una lápida, y un ID retirado no puede volver. Mientras no haya ninguna publicación, solo se comprueban las lápidas.
- **Los importadores** traen las pinturas de una fuente externa (la tabla de SimoGecko para Citadel y los datos de DonnervS para el resto de marcas) y actualizan el fichero de la marca en `data/brands/`. Se ejecutan a demanda, y el cambio se revisa en el diff de git antes del commit.

Los comandos están en el [README de la raíz](../../README.md#comandos).

## Documentación

- Especificación: [docs/04](../../docs/04-datos-curados.md), con el formato del catálogo en [docs/02](../../docs/02-esquema-catalog-json.md) y la estabilidad de IDs en [docs/03](../../docs/03-identificadores.md) §6-7.
