# API

Este documento especifica `apps/api`: la API REST que guardará el catálogo curado, sus publicaciones, las cuentas y las preferencias ([ADR-0037](adr/0037-catalogo-en-base-de-datos.md), [ADR-0039](adr/0039-cuentas-sesiones-datos-usuario.md)). Describe las reglas comunes a todas las rutas y lo que existe hoy. Las rutas, con sus parámetros y sus respuestas, están en la referencia (§5). Por qué se decidió así está en el [ADR-0038](adr/0038-stack-backend.md), el [ADR-0040](adr/0040-despliegue-fase-6.md) y el [ADR-0042](adr/0042-esqueleto-api.md).

## 1. Qué es y qué no es

- **Una aplicación de NestJS 12 sobre Express**, en TypeScript compilado, que habla con PostgreSQL mediante Prisma 7.
- **Solo la capa de la API**: las rutas, los permisos, la base de datos y la red. La lógica del catálogo sigue en `domain` y en `catalog-builder`, como funciones puras que la API llama ([ADR-0018](adr/0018-organizacion-codigo-patrones.md), [ADR-0041](adr/0041-frontera-logica-pura-catalog-builder.md)).
- **Su código se organiza en dos carpetas**:
  - `src/core/`: lo que necesita cualquier API para funcionar, haga lo que haga: la configuración, la base de datos, la comprobación de que responde, la validación de las respuestas y la referencia;
  - `src/features/`: un módulo de NestJS por funcionalidad del producto, como el catálogo, las preferencias o la administración, cada uno con sus controladores y sus servicios.
- **Todavía no tiene funcionalidad de negocio.** El catálogo llega en la sesión 3 de la fase 6, y la autenticación en la 5.

## 2. Rutas

- **Todas empiezan por `/api` y por su versión**, siempre explícita: `/api/v1/…`. No hay ninguna ruta sin versión que signifique «la última», así que `/api/health` responde 404. Cada controlador declara su versión.
- **Tres grupos**, por quién puede usarlos ([ADR-0038](adr/0038-stack-backend.md)):
  - `/api/v1/catalog`: cualquiera, sin sesión;
  - `/api/v1/me/…`: un usuario con sesión, solo sus datos;
  - `/api/v1/admin/…`: una sesión con el rol de administrador.
- **La versión del esquema del catálogo es un parámetro**, `schemaVersion`, no parte de la ruta.
- **Fuera de los grupos**, dos rutas técnicas sin sesión:
  - `GET /api/v1/health`: responde 200 si la API funciona y su base de datos responde a una consulta, y 503 si no. La usan las comprobaciones del despliegue.
  - la referencia (§5).
- **La API sirve detrás del Nginx de cada frontal**, bajo su `/api` ([ADR-0040](adr/0040-despliegue-fase-6.md)), así que no necesita CORS.
- **Su configuración llega por variables de entorno**, que se validan al arrancar. Si falta una o no es válida, la API no arranca, y el mensaje dice cuál:
  - `DATABASE_URL`, obligatoria: la PostgreSQL a la que se conecta;
  - `HOST` y `PORT`: dónde escucha, por defecto `127.0.0.1:3000`;
  - `REFERENCE_HOSTS`: los hosts que sirven la referencia (§5).

## 3. Validación y errores

- **Cada parámetro se valida con un esquema de Zod**, que también da su tipo y su descripción en la especificación OpenAPI. Una petición que no lo cumple recibe un 400, con los mensajes de lo que falla.
- **Cada respuesta se valida con su esquema** antes de enviarse. Si no lo cumple, es un fallo de la API, que responde 500, nunca una respuesta distinta de la que documenta la especificación.
- **Los errores** siguen el formato de NestJS: un JSON con `statusCode`, `message` y `error`.

## 4. Fechas

- **Viajan siempre como un instante en UTC**, en el formato exacto de `toISOString()`, con milisegundos y la zona `Z`: `2027-03-01T09:00:00.000Z`. La API rechaza cualquier otro, como `2027-03-01T09:00:00Z` o `2027-03-01T10:00:00.000+01:00`.
- **El esquema es `instantSchema`, de `domain`**, el mismo para la API y para la web (consultar la [referencia](https://colorwheel.msolla.dev/reference/)). En la especificación OpenAPI aparece como `format: date-time`.
- **En PostgreSQL se guardan como `timestamptz`**: cada fecha del esquema de Prisma se declara `DateTime @db.Timestamptz(3)`, porque Prisma usa por defecto `timestamp`, sin zona.
- **Se muestran en la zona horaria y el idioma de quien las ve**, con `Intl.DateTimeFormat`.

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
- **El despliegue aplica las migraciones** con `prisma migrate deploy` antes de arrancar la API nueva (sesión 4).
- **Cada migración funciona también con la versión anterior de la API**, porque la vuelta atrás automática devuelve la imagen, pero no la base de datos: primero se amplía (una columna nueva) y, en un despliegue posterior, cuando ya nadie la usa, se recorta (se quita la vieja) ([ADR-0040](adr/0040-despliegue-fase-6.md)).
- **En desarrollo**, la PostgreSQL 18.7 oficial con Docker Compose (`apps/api/compose.yaml`), solo accesible desde la propia máquina, con sus datos en un volumen. La base de datos `chromatic_wheel` es la de desarrollo, y `.env.development` tiene su URL.

## 7. Tests

- **Unitarios** (`*.test.ts`): los servicios y los controladores, con dobles de prueba de lo que necesitan y sin base de datos.
- **De integración** (`*.integration.test.ts`): la API entera, configurada como en `main.ts` y arrancada en el proceso del test, con peticiones HTTP reales y su PostgreSQL. Prueban el prefijo y la versión de las rutas, la validación de las peticiones y las respuestas, los instantes en UTC, la base de datos y la referencia.
- **La base de datos de los tests**, `chromatic_wheel_test`, está en la misma PostgreSQL que la de desarrollo, con su URL en `.env.test`. Antes de cada ejecución se borra, se vuelve a crear y se migra con `prisma migrate deploy`, como en el despliegue. Solo se borra una base de datos cuyo nombre acabe en `_test`.
- **Después de migrarla, se compara con `schema.prisma`**: un cambio del esquema sin su migración hace fallar los tests.
- **En la CI**, la acción `verify` arranca el mismo `compose.yaml` antes de los tests ([ADR-0042](adr/0042-esqueleto-api.md)).
