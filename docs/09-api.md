# API

Este documento especifica `apps/api`: la API REST que guardará el catálogo curado, sus publicaciones, las cuentas y las preferencias ([ADR-0037](adr/0037-catalogo-en-base-de-datos.md), [ADR-0039](adr/0039-cuentas-sesiones-datos-usuario.md)). Describe las reglas comunes a todas las rutas y lo que existe hoy. Las rutas, con sus parámetros y sus respuestas, están en la referencia (§5). Por qué se decidió así está en el [ADR-0038](adr/0038-stack-backend.md), el [ADR-0040](adr/0040-despliegue-fase-6.md), el [ADR-0042](adr/0042-esqueleto-api.md) y el [ADR-0043](adr/0043-catalogo-en-postgresql.md).

## 1. Qué es y qué no es

- **Una aplicación de NestJS 12 sobre Express**, en TypeScript compilado, que habla con PostgreSQL mediante Prisma 7.
- **Solo la capa de la API**: las rutas, los permisos, la base de datos y la red. La lógica del catálogo sigue en `domain` y en `catalog-builder`, como funciones puras que la API llama ([ADR-0018](adr/0018-organizacion-codigo-patrones.md), [ADR-0041](adr/0041-frontera-logica-pura-catalog-builder.md)).
- **Su código se organiza en dos carpetas**:
  - `src/core/`: lo que necesita cualquier API para funcionar, haga lo que haga: la configuración, la base de datos, la comprobación de que responde, la validación de las respuestas y la referencia;
  - `src/features/`: un módulo de NestJS por funcionalidad del producto, como el catálogo, las preferencias o la administración, cada uno con sus controladores y sus servicios.
- **Hoy tiene el catálogo** (§8): su borrador, sus publicaciones y la ruta que sirve el publicado. Los cambios pendientes y «Publicar» llegan en la sesión 7 de la fase 6, y la autenticación en la 5.
- **`src/cli/`** tiene los comandos que se ejecutan a demanda: hoy, la carga del catálogo y su paquete (§8.3), y la comprobación de una copia restaurada ([docs/08](08-despliegue.md) §8.1). Los que usan la base de datos arrancan NestJS sin su servidor HTTP.

## 2. Rutas

- **Todas empiezan por `/api` y por su versión**, siempre explícita: `/api/v1/…`. No hay ninguna ruta sin versión que signifique «la última», así que `/api/health` responde 404. Cada controlador declara su versión.
- **Tres grupos**, por quién puede usarlos ([ADR-0038](adr/0038-stack-backend.md)):
  - `/api/v1/catalog`: cualquiera, sin sesión (§8);
  - `/api/v1/me/…`: un usuario con sesión, solo sus datos;
  - `/api/v1/admin/…`: una sesión con el rol de administrador.
- **La versión del esquema del catálogo es un parámetro**, `schemaVersion`, no parte de la ruta.
- **Fuera de los grupos**, dos rutas técnicas sin sesión:
  - `GET /api/v1/health`: responde 200 si la API funciona y su base de datos responde a una consulta, y 503 si no. La usan las comprobaciones del despliegue.
  - la referencia (§5).
- **La API sirve detrás del Nginx de cada frontal**, bajo su `/api` ([ADR-0040](adr/0040-despliegue-fase-6.md)), así que no necesita CORS. Ese Nginx le pasa el `Host` original, comprime sus respuestas y limita las peticiones de cada visitante: 10 por segundo de media, con ráfagas de 20, y después 429 ([docs/08](08-despliegue.md) §3.1).
- **Su configuración llega por variables de entorno**, que se validan al arrancar. Si falta una o no es válida, la API no arranca, y el mensaje dice cuál:
  - `DATABASE_URL`, obligatoria: la PostgreSQL a la que se conecta;
  - `DATABASE_PASSWORD_FILE`: un fichero con la contraseña de esa PostgreSQL, que completa `DATABASE_URL`. En los entornos, la contraseña no va en la URL, sino en el mismo fichero secreto que lee PostgreSQL ([docs/08](08-despliegue.md) §3). La usan también las migraciones;
  - `HOST` y `PORT`: dónde escucha, por defecto `127.0.0.1:3000`;
  - `REFERENCE_HOSTS`: los hosts que sirven la referencia (§5).

## 3. Validación y errores

- **Cada parámetro se valida con un esquema de Zod**, que también da su tipo y su descripción en la especificación OpenAPI. Una petición que no lo cumple recibe un 400, con los mensajes de lo que falla.
- **Cada respuesta se valida con su esquema** antes de enviarse. Si no lo cumple, es un fallo de la API, que responde 500, nunca una respuesta distinta de la que documenta la especificación.
- **Un documento guardado que se sirve tal cual**, como el catálogo publicado, se valida al guardarlo, no al servirlo: validarlo con `Returns` lo volvería a escribir, con otros bytes. Su ruta lo documenta con `Documents`, que lleva el mismo esquema a OpenAPI sin validar la respuesta, y un test comprueba que lo que sirve cumple ese esquema.
- **Los errores** siguen el formato de NestJS: un JSON con `statusCode`, `message` y `error`.

## 4. Fechas

- **Viajan siempre como un instante en UTC**, en el formato exacto de `toISOString()`, con milisegundos y la zona `Z`: `2027-03-01T09:00:00.000Z`. La API rechaza cualquier otro, como `2027-03-01T09:00:00Z` o `2027-03-01T10:00:00.000+01:00`.
- **El esquema es `instantSchema`, de `domain`**, el mismo para la API y para la web (consultar la [referencia](https://colorwheel.msolla.dev/reference/)). En la especificación OpenAPI aparece como `format: date-time`.
- **En PostgreSQL se guardan como `timestamptz`**: cada fecha del esquema de Prisma se declara `DateTime @db.Timestamptz(3)`, porque Prisma usa por defecto `timestamp`, sin zona.
- **Se muestran en la zona horaria y el idioma de quien las ve**, con `Intl.DateTimeFormat`.
- **Un día del calendario, sin hora**, como el día en que se tomó una fuente (`retrievedAt`), no es un instante: se guarda como `date` (`DateTime @db.Date`) y viaja como `YYYY-MM-DD`, igual que en `catalog.json`.

## 5. Referencia y especificación OpenAPI

- **La especificación OpenAPI** se genera desde los esquemas de las rutas al arrancar la API, y se sirve en `/api/v1/openapi.json`.
- **La referencia** es la página de Scalar para esa especificación, en `/api/v1/reference`: la de producción, en `https://colorwheel.msolla.dev/api/v1/reference`, y la de desarrollo, en `http://localhost:3000/api/v1/reference`. Cada versión de la API tiene la suya.
- **Solo se sirve en los hosts de `REFERENCE_HOSTS`**, los de la web: la página ejecuta código de terceros y nunca comparte el origen de `apps/admin`, donde está la sesión del administrador. En cualquier otro host, sus rutas responden 404. Sin la variable, no la sirve ningún host.
- **Scalar viene de su paquete**, con la versión fijada, servido por la propia API. La página no carga nada de otros orígenes: ni CDN, ni fuentes, ni telemetría.
- **Cabeceras**: una política de seguridad (CSP) que solo permite sus scripts y peticiones al mismo origen, `X-Robots-Tag: noindex` y una caché que se revalida en cada visita.
- **La referencia de `color-wheel` y `domain`** es otra, la de TypeDoc, en `/reference/` de la web ([ADR-0023](adr/0023-documentacion-tecnica.md)).

## 6. Base de datos y migraciones

- **El esquema** está en `apps/api/prisma/schema.prisma`. Prisma genera desde él un cliente con sus tipos en `src/generated/prisma/`, fuera de git, al instalar, al comprobar los tipos, al probar y al compilar.
- **Cada cambio de estructura es una migración en SQL**, en `prisma/migrations/`, que se revisa en el PR. Se crea con `db:migrate` (`prisma migrate dev`) contra la base de datos de desarrollo.
- **El despliegue aplica las migraciones** con `prisma migrate deploy`, con la imagen de la API nueva, antes de arrancarla ([docs/08](08-despliegue.md) §2). Por eso la CLI de Prisma es una dependencia de producción.
- **Cada migración funciona también con la versión anterior de la API**, porque la vuelta atrás automática devuelve la imagen, pero no la base de datos: primero se amplía (una columna nueva) y, en un despliegue posterior, cuando ya nadie la usa, se recorta (se quita la vieja) ([ADR-0040](adr/0040-despliegue-fase-6.md)).
- **Cada tabla tiene una clave primaria `bigint` interna**, `id`, que nunca sale de la base de datos ni aparece en una ruta. Lo que tiene un ID propio lo guarda en una columna única: el del catálogo en `catalog_id` (`citadel/base/abaddon-black`), y el de un motivo, en `slug`. Lo que no lo tiene y se nombra en las rutas, como una publicación, lleva además `uuid`, un UUID v4 aleatorio. Las filas que dependen de otra se nombran por ella y por su clave natural ([ADR-0043](adr/0043-catalogo-en-postgresql.md)).
- **La base de datos solo garantiza identidad y pertenencia**: las claves únicas y las FK. Una FK solo une datos del mismo escritor, o algo que no puede desaparecer; las reglas de los datos se quedan en el código que los genera.
- **Las listas guardan su orden** en una columna `position`.
- **Las inserciones de muchas filas van por tandas de 1000**, una tras otra: PostgreSQL admite 32 767 parámetros por instrucción, y por encima Prisma enviaría varias a la vez por la misma conexión.
- **En desarrollo**, la PostgreSQL 18.7 oficial con Docker Compose (`apps/api/compose.yaml`), solo accesible desde la propia máquina, con sus datos en un volumen. Los entornos heredan ese mismo servicio (`deploy/compose.yaml`), sin su puerto ni sus credenciales, así que la imagen está fijada en un solo sitio. La base de datos `chromatic_wheel` es la de desarrollo, y `.env.development` tiene su URL.

## 7. Tests

- **Unitarios** (`*.test.ts`): los servicios y los controladores, con dobles de prueba de lo que necesitan y sin base de datos.
- **De integración** (`*.integration.test.ts`): la API entera, configurada como en `main.ts` y arrancada en el proceso del test, con peticiones HTTP reales y su PostgreSQL. Prueban el prefijo y la versión de las rutas, la validación de las peticiones y las respuestas, los instantes en UTC, la base de datos y la referencia.
- **La base de datos de los tests**, `chromatic_wheel_test`, está en la misma PostgreSQL que la de desarrollo, con su URL en `.env.test`. Antes de cada ejecución se borra, se vuelve a crear y se migra con `prisma migrate deploy`, como en el despliegue. Solo se borra una base de datos cuyo nombre acabe en `_test`.
- **Después de migrarla, se compara con `schema.prisma`**: un cambio del esquema sin su migración hace fallar los tests.
- **Los ficheros de integración se ejecutan de uno en uno**, porque comparten la base de datos y algunos escriben en ella. Cada uno prepara lo que necesita, y lo común está en `test/`: arrancar la API (`app.ts`) y cargar `data/` y la última etiqueta, sin publicaciones (`catalog.ts`, §8).
- **En la CI**, la acción `verify` arranca el mismo `compose.yaml` antes de los tests ([ADR-0042](adr/0042-esqueleto-api.md)).

## 8. Catálogo

El catálogo curado, sus publicaciones y la ruta del publicado ([ADR-0037](adr/0037-catalogo-en-base-de-datos.md), [ADR-0043](adr/0043-catalogo-en-postgresql.md)), en `src/features/catalog/`. Hasta la migración de la sesión 9, la fuente de verdad sigue siendo `packages/catalog-builder/data/` ([docs/04](04-datos-curados.md)), y la base de datos se carga desde ella.

### 8.1. El borrador

- **Las tablas del borrador** tienen las mismas capas que `data/`, con un campo por columna: lo que dice cada fuente (`sources`, `source_files`, `source_rows`, `source_equivalences` y `source_replacements`), las fichas de cada marca (`brands`, `ranges`, `paints`, `paint_keys` y `rejected_colors`) y las reglas (`ignore_reasons`, `ignored_groups`, `ignored_keys`, `color_policy` y `tombstones`). Cada tabla corresponde a una parte de un fichero de docs/04 §3-5.
- **Las claves de una ficha y las filas ignoradas no apuntan a la fila de la fuente**: una importación puede quitarla, y no puede cambiar una ficha. `catalog-builder` informa entonces de la clave o la ignorada obsoleta, como hoy en `build-catalog`. Las parejas de una carta sí apuntan a sus filas, porque las escribe la misma importación.
- **Un único servicio escribe el borrador**, `DraftService`, para que el historial de la sesión 7 se escriba en la misma transacción que cada cambio.
- **El borrador se lee con la forma de los ficheros de `data/`**, con sus nombres, y `catalog-builder` lo valida con los mismos lectores que `build-catalog`, así que cada problema se sitúa en el fichero y la ruta donde está hoy el dato.
- **El catálogo se genera desde el borrador** con `buildCatalog`, y sus IDs se comprueban contra la última publicación (docs/03 §7). Un test de integración carga `data/` y comprueba que el catálogo y los dos informes generados así son idénticos, byte a byte, a los que versiona `build-catalog`.

### 8.2. Las publicaciones

- **Cada publicación no se modifica nunca.** `publications` guarda su `uuid`, su fecha, la etiqueta `release/` de la que salió, si es la primera, y una copia del borrador tal como estaba al publicar. `publication_catalogs` guarda el texto exacto de su `catalog.json` en cada versión del esquema, con su `dataVersion`.
- **Lo pendiente es lo que el borrador tiene distinto de la copia de la última publicación** (sesión 7).
- **La primera publicación** es el `catalog.json` de la última etiqueta `release/`, con la fecha de su commit y sin copia del borrador, porque el `data/` de esa etiqueta tenía un formato anterior.

### 8.3. La carga desde `data/`

```sh
pnpm --filter @chromatic-wheel/api catalog:load
```

- Lee `data/` y el `catalog.json` de la última etiqueta `release/` con `@chromatic-wheel/catalog-builder/data`, y valida cada fichero como `build-catalog`.
- Sustituye el borrador entero, en una sola transacción, y guarda la primera publicación si todavía no hay ninguna. Las publicaciones no se tocan nunca, así que se puede repetir.
- Usa la base de datos de `.env.development`. Necesita el historial y las etiquetas de git, como `build-catalog`.
- **En los entornos**, que no tienen ni el repositorio ni su historial, la carga se hace en dos pasos ([docs/08](08-despliegue.md) §2):
  - la CI escribe el **paquete del catálogo** con `pnpm --filter @chromatic-wheel/api catalog:pack <fichero>`: los ficheros de `data/` y el `catalog.json` de la última etiqueta, ya leídos, en un único JSON, con la fecha de la etiqueta como un instante en UTC;
  - cada despliegue lo carga con la imagen nueva de la API, después de las migraciones: `node dist/cli/load-catalog.js --from <fichero>`. Comprueba la forma del paquete y valida cada fichero como sin él.
- Desaparece con `data/` en la sesión 9, igual que el paquete.

### 8.4. `GET /api/v1/catalog?schemaVersion=1`

- **El catálogo de la última publicación**, en la versión del esquema que pide `schemaVersion`, obligatorio, exactamente como se publicó. Lo descarga el build de la web, y cualquiera puede leerlo, sin sesión.
- **404** si no hay nada publicado, o si la última publicación no tiene esa versión. Nunca sirve una publicación anterior, que estaría desfasada.
- **Caché**: `Cache-Control: public, no-cache` y un `ETag` con su `dataVersion`. Se puede guardar, pero se revalida antes de cada uso, y responde 304 mientras no cambia.
- **El límite de peticiones y la compresión** los pone el Nginx de cada entorno, para toda la API (§2). Con la compresión, el `ETag` llega débil (`W/"…"`), y la API lo sigue reconociendo y responde 304.
