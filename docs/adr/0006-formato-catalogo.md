# ADR-0006: Formato del catálogo normalizado, plano y determinista

- **Estado:** aceptada
- **Fecha:** 2026-10-31

## Contexto
El catálogo se versiona en git, se revisa mediante diffs y se carga entero en el cliente. Las equivalencias cruzan marcas.

## Decisión
- Colecciones planas (`sources`, `brands`, `ranges`, `paints`, `equivalences`) en forma de arrays ordenados, con referencias por ID.
- `Source` es una entidad propia.
- `null` explícito para la ausencia de valor.
- Salida determinista y con formato legible.

## Alternativas descartadas
- **Anidado marca → gama → pintura**: las referencias cruzadas resultan incómodas y los diffs son ruidosos.
- **Objetos indexados por ID**: `JSON.parse` descarta sin avisar las claves duplicadas.
- **Minificado en el repositorio**: los diffs serían ilegibles, y la compresión HTTP ya compensa el tamaño.

## Consecuencias
- La forma del JSON no garantiza la integridad referencial, así que hay que validarla.
- Los índices se construyen al cargar el catálogo.
