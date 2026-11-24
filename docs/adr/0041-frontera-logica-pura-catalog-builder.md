# ADR-0041: La frontera de la lógica pura de `catalog-builder`

- **Estado:** aceptada
- **Fecha:** 2026-11-24

## Contexto

El [ADR-0037](0037-catalogo-en-base-de-datos.md) deja `catalog-builder` como paquete puro, que usará `apps/api`, y lleva a `apps/api` lo que habla con el exterior. Además, al migrar, se borran `data/`, `src/cli/` y `src/curated/`. En el código había tres problemas:

- **Lógica pura dentro de `src/cli/`**: la lista de ficheros de cada fuente, la orquestación de una importación (proponer claves, conciliar) y las reglas de claves de cada carta. `apps/api` tendría que copiarlas.
- **El modelo de los datos curados**, con sus esquemas, sus tipos y sus comprobaciones, estaba en `src/curated/files.ts`, junto con lo que solo tiene sentido en un fichero (que su nombre coincida con su ID). `importers/` y `pipeline/` dependían de una carpeta que se borra, y `buildCatalog` recibía los ficheros sin validar.
- **Nada impedía** que un módulo puro importara `node:fs` o llamara a `fetch`.

## Decisión

- **Lo puro es todo `src/` salvo `src/cli/`**. `src/cli/` lee y escribe `data/`, descarga, lee los PDF con pdf.js, consulta git, formatea con Prettier e imprime.
- **`src/model/`** tiene el modelo de los datos curados: sus esquemas, sus tipos y las comprobaciones de cada contenido, como que una pintura tenga una sola clave por fuente. No sabe dónde se guardan los datos. **`src/curated/`** solo lee los ficheros de `data/`: comprueba que su nombre coincide con su ID, sitúa cada problema en su fichero y desaparece con `data/`. `buildCatalog` recibe los datos ya validados.
- **`src/importers/registry.ts`** da, para cada fuente que se vuelve a importar, cómo llegan sus ficheros (como texto o como el texto de un PDF), su transcripción y sus reglas. Los ficheros llegan ya leídos, así que no hace falta un puerto ([ADR-0018](0018-organizacion-codigo-patrones.md)). **`src/importers/import-source.ts`** hace una importación y devuelve la fuente y las marcas que cambian, para quien las guarde. Las reglas de claves de cada carta van en el módulo de su carta.
- **La API pública** es `src/index.ts`, en el `exports` del paquete. La CLI solo usa lo que exporta, como hará `apps/api`, así que el índice basta para sustituirla.
- **ESLint vigila la frontera**, con sus reglas propias y sin dependencias nuevas:
  - en lo puro, salvo los tests, `no-restricted-imports` prohíbe todos los módulos de Node, sacados de `builtinModules`, menos `node:crypto`, que solo calcula los SHA-256. También prohíbe `pdfjs-dist`, `prettier` y `src/cli/`. `no-restricted-globals` prohíbe `fetch` y `process`, y `no-console` impide imprimir;
  - en `src/cli/`, `no-restricted-imports` solo deja importar del paquete `src/index.ts`.
- **`writeDataFile` formatea con Prettier** y la configuración del repositorio, así que no hace falta `pnpm format` después de importar. Prettier y pdf.js son dependencias de desarrollo: solo los usa la CLI, y `apps/api` no los arrastra.

## Alternativas descartadas

- **`src/curated/` como modelo, con la lectura de los ficheros en `src/cli/`**: no hace falta una carpeta nueva, pero contradice el ADR-0037, porque `src/curated/` sobreviviría a la migración. Además, `src/cli/` tendría lógica pura con tests a la que no llega la regla.
- **Dejar la separación del modelo para la sesión de la base de datos**: el paquete puro seguiría dependiendo de una carpeta que se borra, y esa sesión tendría que hacer también este trabajo.
- **Un puerto para leer los PDF**: la lógica puede recibir el texto del PDF ya leído, así que el puerto sería ceremonia.
- **`eslint-plugin-boundaries` o `import-x/no-restricted-paths`**: declaran capas y se leen mejor si hay muchas, pero son una dependencia más para una sola frontera, y siguen necesitando `no-restricted-globals`.
- **`dependency-cruiser`**: analiza todo el grafo, pero es otra herramienta y otro paso de la CI, y no ve los globales.

## Consecuencias

- Corrige en parte el [ADR-0018](0018-organizacion-codigo-patrones.md): añade `src/model/` a la estructura de `catalog-builder`, y `src/cli/` usa el paquete a través de su `index.ts`. `adapters/` sigue sin hacer falta.
- Las reglas detienen los errores, no a quien quiera saltárselas a propósito (por ejemplo, con `globalThis.fetch`).
- Una fuente nueva que se vuelve a importar necesita su entrada en `registry.ts`, y su script en `src/cli/` solo nombra las fuentes que importa.
