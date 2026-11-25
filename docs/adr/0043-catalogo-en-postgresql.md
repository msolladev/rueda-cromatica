# ADR-0043: El catálogo en PostgreSQL

- **Estado:** aceptada
- **Fecha:** 2026-11-25
- **Corrige en parte:** [ADR-0042](0042-esqueleto-api.md)

## Contexto

La sesión 3 de la fase 6 lleva el catálogo a la base de datos de `apps/api`, con las capas, los escritores y las publicaciones del [ADR-0037](0037-catalogo-en-base-de-datos.md). Los cambios pendientes, el historial y «Publicar» son de la sesión 7, pero las tablas tienen que dejarles sitio. Hasta la migración de la sesión 9, `data/`, la CLI y `catalog.json` siguen siendo la fuente de verdad.

Al diseñarlo aparecieron varias cosas que el ADR-0037 no resolvía:

- **La última etiqueta, `release/2026-11-22.3`, es anterior a la fase 5.** Su `data/` tiene el formato de una capa, que ya no se puede cargar, aunque su `catalog.json` sí.
- **`jsonb` no conserva un fichero byte a byte**: reordena las claves y quita los espacios.
- **Todas las fuentes tienen los mismos nueve campos por fila** ([docs/04](../04-datos-curados.md) §3): lo que cambia es el significado de la clave, no los campos.
- **`Returns` reescribe la respuesta** al validarla ([ADR-0042](0042-esqueleto-api.md)), y el catálogo tiene que salir con los bytes publicados.
- **PostgreSQL admite 32 767 parámetros por instrucción.** Por encima, Prisma parte una inserción y envía las partes a la vez por la misma conexión de la transacción, algo que `pg` declara obsoleto.

## Decisión

### Los pendientes son la diferencia con la última publicación

- **Las tablas son el borrador**, y se editan directamente. Los usuarios nunca las leen: la web se compila con el catálogo de la última publicación.
- **Cada publicación guarda además una copia del borrador** tal como estaba al publicar.
- **Lo pendiente es lo que el borrador tiene distinto de esa copia.** Descartar un pendiente es volver a escribir esa parte desde la copia, y la vista previa genera el catálogo desde el borrador y lo compara con el publicado.
- **Una importación** sustituye las filas de su fuente en una transacción. Las fichas que propone no se guardan: la conciliación es pura y se vuelve a calcular cada vez.

### El historial lo escribe la API

En la misma transacción que el cambio, desde un único punto de escritura del borrador (`DraftService`) y con tests que lo comprueban. Solo la API sabe quién es el administrador y si el cambio viene de una importación, y la comparación de antes y después es la misma que la de los pendientes. Si un cambio debe avisar a algo externo, como el despliegue que lanza «Publicar», se decidirá con un _transactional outbox_ en la sesión 7.

### Las tablas

- **Una columna por campo**, con una tabla por cada parte de `data/`: las fuentes, sus ficheros descargados, sus filas, sus parejas de equivalencia y de sustitución, sus grupos y filas ignorados, los motivos, la política de color, las marcas, las gamas, las fichas, sus claves, sus descartes de color y las lápidas. El degradado de una fila son dos columnas, y los alias, una lista de texto. El detalle está en `apps/api/prisma/schema.prisma` y en [docs/09](../09-api.md) §6.
- **Una clave primaria `bigint` interna en cada tabla**, que nunca sale de la base de datos. El ID del catálogo (`citadel/base/abaddon-black`) es una columna única, `catalog_id`, y es el identificador público: ya está en `catalog.json`, en las URL de la web y en el repositorio. Lo que no tiene ID propio y se nombrará en las rutas, como las publicaciones, lleva además una columna `uuid` con un UUID v4 aleatorio. Las filas que dependen de otra se nombran por su fuente o su ficha y su clave natural.
- **`position`** guarda el orden de cada lista, porque llega a los informes y a los mensajes.
- **La base de datos solo garantiza identidad y pertenencia.** Las reglas del catálogo se quedan en `catalog-builder`, que las comprueba en la vista previa y al publicar.
- **Una FK solo une datos del mismo escritor, o algo que no puede desaparecer.** Las claves de una ficha y las filas ignoradas no apuntan a la fila de la fuente: una importación puede quitarla, y no puede cambiar una ficha. `catalog-builder` informa entonces de la clave o la ignorada obsoleta, que impide publicar. Las parejas de una carta sí apuntan a sus filas, porque las escribe la misma importación.
- **Los valores fijos** (tipos, orígenes, licencias) son texto, validado con los esquemas de `domain`, sin `enum` de PostgreSQL.

### Cada publicación

- **`publications`**: el `id`, el `uuid`, la fecha (`timestamptz`), `release_tag` y la copia del borrador en `jsonb`.
- **`publication_catalogs`**: el texto exacto de su `catalog.json` en una columna `text`, con su `schema_version` y su `data_version`, una fila por versión del esquema. PostgreSQL comprime solo los textos grandes.
- **La primera publicación** es el catálogo de la última etiqueta `release/`, con la fecha de su commit, su `release_tag` y sin copia del borrador.
- **El autor** llega con los usuarios, en la sesión 5: una columna `author_id` con su FK, y una regla que exige `author_id` o `release_tag`.
- **Los IDs se comprueban contra la última publicación**, con las reglas de [docs/03](../03-identificadores.md) §7.

### La carga desde `data/`

- **Un comando de `apps/api`, `catalog:load`**, que arranca NestJS sin servidor HTTP y usa sus mismos servicios. Valida cada fichero como `build-catalog`, sustituye el borrador entero en una transacción y guarda la primera publicación solo si todavía no hay ninguna. Se puede repetir.
- **`catalog-builder` exporta la lectura de `data/` y de la última etiqueta** en una entrada aparte, `@chromatic-wheel/catalog-builder/data`, fuera de su lógica pura. Desaparece con `data/` en la sesión 9, como el comando.
- **El borrador se lee con la forma de los ficheros de `data/`**, y `catalog-builder` lo valida con los mismos lectores. Así, cada problema se sitúa donde hoy lo encuentra Miguel.
- **Las inserciones van por tandas de 1000 filas**, una tras otra.

### La lápida con la pintura que queda

La lápida de una pintura lleva `remainingPaintId`, el ID de la pintura que queda o `null`, ya en `tombstones.json` y en su tabla. `build-catalog` comprueba que esa pintura está en el catálogo. Hasta la sesión 9 la carga sustituye el borrador desde `data/`, así que un dato que solo existiera en la base de datos se perdería. Que la web lleve a esa pintura la elección del buscador necesita que las lápidas lleguen a `catalog.json`, y queda para cuando se implemente.

### `GET /api/v1/catalog?schemaVersion=1`

- **Sirve el texto guardado tal cual.** Se valida con `parseCatalog` al guardarlo, no al servirlo, y el decorador `Documents` lo documenta en OpenAPI sin validarlo.
- **Caché**: `Cache-Control: public, no-cache` y un `ETag` con el `dataVersion`, que identifica los bytes. Se puede guardar, pero se revalida siempre, así que el build que sigue a «Publicar» nunca recibe el catálogo anterior. Express responde 304 cuando `If-None-Match` coincide.
- **El límite de peticiones lo pone el Nginx de la VM** con `limit_req`, en la sesión 4, para toda la API. La compresión, también.
- **Responde 404** si no hay nada publicado o si la última publicación no tiene esa versión del esquema. Nunca sirve una publicación anterior.

## Alternativas descartadas

- **Guardar los pendientes como una lista de operaciones**: una reimportación serían miles de operaciones, y habría que resolver cómo se combinan las de una misma ficha.
- **Un borrador y un publicado por fila**, como Strapi: cada tabla tendría dos estados, y el publicado duplicaría la publicación.
- **El historial con disparadores de PostgreSQL**: no saben quién cambia ni por qué, registran filas y no fichas, y están en PL/pgSQL, fuera de `schema.prisma`.
- **Eventos dentro de la API**, o _event sourcing_: los primeros se ejecutan fuera de la transacción salvo que se llamen en el momento, y el segundo convierte cada reimportación en miles de eventos y obliga a reconstruir el estado.
- **Las filas de cada fuente, o los ficheros enteros, en `jsonb`**: `apps/admin` consulta, compara y registra las filas y las fichas de una en una.
- **El slug como clave primaria**: corregir el ID de una ficha sin publicar obligaría a cambiar todas las tablas que lo citan.
- **Un UUID también en el catálogo**: un segundo identificador para lo mismo, que no oculta nada.
- **UUID v7**: lleva dentro la fecha de creación, y su ventaja en los índices no se nota con tablas tan pequeñas.
- **Una FK de las claves y las ignoradas a las filas**: con `RESTRICT` la importación no se podría guardar; con `CASCADE`, cambiaría las fichas en silencio.
- **El catálogo publicado en `bytea` comprimido, en `jsonb` además del texto, o en un fichero**: duplican la compresión de PostgreSQL o el dato, o quedan fuera de sus copias.
- **El _seed_ de Prisma**: es un enganche a un comando, ya no se ejecuta solo en Prisma 7, y su sentido son los datos de ejemplo.
- **La carga en la CLI de `catalog-builder`, o en una migración SQL**: lo primero mete la base de datos en el paquete puro; lo segundo no se puede repetir.
- **`remainingPaintId` solo en la base de datos**: la carga lo borraría.
- **`@nestjs/throttler`**: una dependencia más, que limita cuando la petición ya ha llegado a Node. Los límites del inicio de sesión los trae Better Auth.
- **`max-age`**: el build podría recibir el catálogo anterior de una caché.
- **El `ETag` automático de Express**: calcula el hash de 860 KB en cada petición.
- **Validar el catálogo en cada petición**: repite la comprobación de un dato que no cambia.
- **Un usuario ficticio, o el autor como texto libre**, para la primera publicación.

## Consecuencias

- Corrige en parte el [ADR-0042](0042-esqueleto-api.md): una respuesta que sirve un documento guardado tal cual se valida al guardarlo, no al servirlo.
- `apps/api` depende de `@chromatic-wheel/catalog-builder`, y `catalog-builder` tiene una segunda entrada, `/data`. `writeDataFile` pasa a su propio fichero para que esa entrada no cargue Prettier, que es de desarrollo.
- `tombstones.json` cambia de esquema, pero no de contenido, porque está vacío. `catalog.json` no cambia.
- Hasta que haya una publicación con copia del borrador, todo el borrador es pendiente: nada de la fase 5 ha llegado a producción.
- Los tests de integración de la API cargan `data/` y comprueban que el catálogo y los dos informes generados desde la base de datos son idénticos, byte a byte, a los versionados. Necesitan el historial y las etiquetas de git, como `build-catalog`, y se ejecutan de uno en uno porque comparten la base de datos.
- La sesión 4 tiene que decidir cómo se lanza la carga en preproducción, donde no están ni el repositorio ni `data/`.
