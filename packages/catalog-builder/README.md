# @chromatic-wheel/catalog-builder

Herramienta de línea de comandos que genera `apps/web/public/catalog.json`, el catálogo de pinturas que carga la web. No es una librería: no la importa ningún otro paquete.

- **El builder** lee los datos que mantiene el proyecto, en `data/` (las fuentes y un fichero por marca), los valida con los esquemas de `domain` y escribe el catálogo de forma determinista. Falla en lugar de adivinar, y no escribe nada si algo no cuadra. La CI lo vuelve a generar y falla si no coincide con el versionado.
- **Los importadores** traen las pinturas de una fuente externa (la tabla de SimoGecko para Citadel y los datos de DonnervS para el resto de marcas) y actualizan el fichero de la marca en `data/brands/`. Se ejecutan a demanda, y el cambio se revisa en el diff de git antes del commit.

Los comandos están en el [README de la raíz](../../README.md#comandos).

## Documentación

- Especificación: [docs/04](../../docs/04-datos-curados.md), con el formato del catálogo en [docs/02](../../docs/02-esquema-catalog-json.md).
