# ADR-0010: Lint con ESLint y formato con Prettier

- **Estado:** aceptada
- **Fecha:** 2026-11-07

## Contexto
Es un proyecto de aprendizaje con TypeScript strict. Se quieren detectar errores que el compilador deja pasar (promesas sin `await`, condiciones siempre verdaderas, `any` que se cuelan) y tener un formato uniforme sin discusiones.

## Decisión
- **ESLint 10** con *flat config*, en un único `eslint.config` en la raíz del monorepo. Cada paquete tiene su bloque: las reglas de React solo en `apps/web` y los globales de Node solo en `catalog-builder`.
- **typescript-eslint** con `strictTypeChecked` y lint con tipos (`projectService`).
- **Prettier** para el formato, con la configuración mínima. `eslint-config-prettier` va en último lugar para desactivar las reglas de estilo de ESLint.
- **Scripts**: `lint`, `format` y `format:check`. La CI ejecuta `lint` y `format:check`.

## Alternativas descartadas
- **Biome**: más rápido y es una sola herramienta, pero tiene menos reglas basadas en tipos que typescript-eslint.
- **`recommendedTypeChecked`**: es menos exigente, y deja pasar patrones que en un proyecto de aprendizaje conviene corregir.
- **`eslint-plugin-prettier`**: ejecutar Prettier como regla de ESLint es más lento y llena el lint de avisos de formato.
- **Una configuración por paquete**: duplica la configuración común.

## Consecuencias
- Al principio habrá más avisos; se corrigen, no se desactivan sin justificarlo.
- Al instalar hay que comprobar que los plugins de React son compatibles con ESLint 10.
- Los hooks de pre-commit quedan fuera de esta decisión: el control lo hace la CI.
