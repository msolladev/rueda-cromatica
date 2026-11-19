# ADR-0025: Estabilidad de IDs frente a la etiqueta de publicación

- **Estado:** aceptada
- **Fecha:** 2026-11-19

## Contexto

El [ADR-0001](0001-identificadores-slug-congelado.md) congela los IDs y confía su estabilidad a un test del builder y a una lista de lápidas. El [ADR-0019](0019-alcance-minimo-mvp.md) pide implementarlos antes de la primera publicación. docs/03 §7 decía que la referencia era «el `catalog.json` versionado, es decir, el último publicado», pero `build-catalog` sobrescribe ese fichero, y `main` se despliega en preproducción sin que nadie guarde sus IDs ([ADR-0011](0011-ci-cd.md)). El fichero versionado no es lo publicado.

## Decisión

- **Referencia**: el `catalog.json` de la etiqueta de git `release/AAAA-MM-DD` más reciente. Cada publicación en producción crea su etiqueta: a mano hasta que exista el CD a producción, y después la crea ese CD. Las etiquetas de `release/` que no siguen el formato hacen fallar el builder, así que el orden alfabético es el cronológico.
- **Antes de la primera etiqueta** no se compara nada y los IDs se corrigen libremente. Las lápidas se comprueban siempre.
- **Lápidas**: `packages/catalog-builder/data/tombstones.json`, con las cuatro colecciones del catálogo y, en cada entrada, el ID y el motivo. La fecha y el commit los da git.
- **Ejecución**: dentro de `build-catalog`, también con `--check`, antes de escribir o comparar nada. Por eso corre en el paso 4 de la CI, que trae el historial completo y las etiquetas. Un clon superficial hace fallar el builder en lugar de dejar pasar la comprobación sin comparar.

## Alternativas descartadas

- **El `catalog.json` de `main`**: protegería los IDs de preproducción, que aún se pueden corregir, y necesitaría un interruptor de «ya publicado» fácil de olvidar.
- **Una instantánea versionada de los IDs publicados**: duplica datos que ya están en la versión publicada, y si se olvida actualizarla, la protección se queda desfasada sin aviso.
- **Un test de Vitest o un paso de CI propio**: el builder seguiría escribiendo un catálogo inestable sin quejarse, y el fallo llegaría más tarde.
- **Solo el ID en cada lápida**: el motivo es lo único que no está en otro sitio, y es lo que busca quien se encuentra el fallo.

## Consecuencias

- `build-catalog` necesita git y un clon completo.
- Publicar en producción incluye crear la etiqueta. Si no se crea, los IDs de esa publicación quedan sin proteger.
- Como mucho, hay una publicación por día. Si hiciera falta más, se cambiaría el formato con un ADR nuevo.
- Las lápidas no llevan el ID que sustituye al retirado. Si la colección del usuario de la fase 6 necesita migrar referencias, se añadirá entonces.
