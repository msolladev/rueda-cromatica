# ADR-0007: Versionado y distribución del catálogo

- **Estado:** aceptada
- **Fecha:** 2026-10-31

## Contexto

La app es una PWA offline sin servidor. El catálogo solo debe descargarse cuando cambia, y la app y el catálogo se despliegan juntos.

## Decisión

- `meta.schemaVersion` es un entero. Sube cuando un cliente anterior no podría leer el fichero correctamente. El cliente solo acepta su versión y no hay migraciones en el cliente.
- `meta.dataVersion` es el SHA-256 del contenido canónico. Sirve para trazabilidad, no para la caché.
- `catalog.json` va en el precaché de Workbox, y la revisión por hash del manifiesto decide cuándo se descarga.
- El build es determinista y no incluye marcas de tiempo.
- El catálogo se carga con `fetch`, no se importa en el bundle.

## Alternativas descartadas

- **SemVer para el esquema**: minor y patch no aportan nada, porque el cliente solo necesita saber si puede leer el fichero o no.
- **`generatedAt` en el fichero**: cambiaría la revisión en cada build y forzaría una descarga en cada despliegue.
- **Runtime caching stale-while-revalidate**: solo es útil si el catálogo se actualiza sin redesplegar, y no es el caso.
- **Importar el JSON en el bundle**: engorda el JS y mezcla la caché del código con la de los datos.

## Consecuencias

- Hace falta un test de determinismo en el builder.
- Si en el futuro un backend publica catálogos sin redesplegar la app, habrá que revisar esta ADR.
