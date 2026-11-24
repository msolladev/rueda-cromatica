# ADR-0042: El esqueleto de `apps/api`

- **Estado:** aceptada
- **Fecha:** 2026-11-24

## Contexto

La sesión 2 de la fase 6 monta `apps/api` sin funcionalidad de negocio, con el stack del [ADR-0038](0038-stack-backend.md) y la CI del [ADR-0040](0040-despliegue-fase-6.md). Al montarla aparecieron varias cosas que esos ADR no resolvían o que habían cambiado:

- **NestJS 12** salió el 2026-08-27 y es la versión actual. Sus paquetes son ESM, como el resto del monorepo, y la 11 queda como `legacy`. Además, NestJS 12 ya valida con cualquier esquema de Standard Schema, como los de Zod, y `@nestjs/swagger` 12 genera la especificación OpenAPI desde ellos.
- **`nestjs-zod` 5.6.0**, su última versión, solo admite NestJS 10 y 11. La petición de compatibilidad con la 12 sigue abierta desde agosto, sin fecha.
- **El paquete de Scalar para NestJS** descarga la interfaz de jsDelivr, sin versión, en cada visita.
- **El ADR-0018** deja para una decisión propia la organización del código de `apps/api`.
- **Vite 8**, que ya usa el monorepo, compila los decoradores de NestJS con sus metadatos de tipos, así que Vitest ya no necesita SWC.
- **La CI** tiene sus pasos en una acción compuesta, compartida por los PR y los despliegues, que no puede declarar contenedores de servicio de Actions.

Las versiones citadas son las publicadas en npm a 2026-11-24.

## Decisión

### NestJS 12, con su validación propia

- **NestJS 12, sin `nestjs-zod`.** Los esquemas de Zod se pasan a los decoradores de los parámetros (`@Body({ schema })`, `@Query({ schema })`), y `StandardSchemaValidationPipe` los valida en toda la API. El tipo del parámetro se escribe con `z.infer`.
- **Las respuestas también se validan**: el decorador propio `Returns` aplica a una ruta su esquema de respuesta, que valida lo que devuelve (`StandardSchemaSerializerInterceptor`) y lo documenta en OpenAPI. Una respuesta que no cumple su esquema es un error 500, nunca una respuesta distinta de la especificación.
- **La API es ESM**, como el resto del monorepo.

### La referencia

- **La sirve la propia API, dentro de su versión**: la página de Scalar en `/api/v1/reference` y la especificación en `/api/v1/openapi.json`. Así siempre corresponde a la API que responde, también tras una vuelta atrás.
- **Solo en los hosts de la variable `REFERENCE_HOSTS`**, los de la web. En cualquier otro, sus rutas responden 404. La página ejecuta código de terceros, y en el origen de `apps/admin` podría hacer peticiones con la sesión del administrador. Sin la variable, ningún host la sirve.
- **Scalar sale de `@scalar/api-reference`**, con su versión fijada y servida por la API, sin CDN, sin sus fuentes, sin telemetría y sin su agente. La página tiene su propia política de seguridad (CSP), que solo permite sus scripts y peticiones al mismo origen, y no se indexa.

### La compilación

- **`tsc`, con el CLI de NestJS**: `nest build` compila y comprueba los tipos en un solo paso, y `nest start --watch` reinicia la API en desarrollo. El `tsconfig` de la API activa los decoradores antiguos de TypeScript y sus metadatos, que no se pueden quitar al vuelo (`erasableSyntaxOnly` desactivado).
- **Sin SWC**: el build no lo necesita a esta escala, y los tests compilan los decoradores con Vite.

### La organización del código

- **`src/core/`**: lo que necesita cualquier API para funcionar, haga lo que haga: la configuración, la base de datos, la comprobación de que responde (`health`), la validación de las respuestas y la referencia.
- **`src/features/`**: un módulo de NestJS por funcionalidad del producto (`catalog/`, `me/`, `admin/`…), cada uno cuando llegue su sesión.
- **`src/setup.ts`**: el prefijo, el versionado, la validación y la referencia, en una sola función que usan `main.ts` y los tests.
- **Los tests**, junto al código, como en el resto del monorepo. `test/` solo tiene la preparación común de los de integración.
- **El cliente de Prisma** se genera en `src/generated/prisma/`, fuera de git.

### La base de datos

- **En desarrollo, la imagen oficial de PostgreSQL 18.7** con Docker Compose (`apps/api/compose.yaml`), con su versión y su digest fijados, sus datos en un volumen y el puerto abierto solo en `127.0.0.1`. La 19.0 es la primera de su versión, y Prisma 7 no dice con qué versiones está probado.
- **La CI arranca ese mismo `compose.yaml`** en la acción `verify`, en lugar de un contenedor de servicio de Actions. La imagen está en un solo fichero, que Dependabot actualiza, salvo las versiones mayores, que necesitan migrar los datos.
- **La URL de la base de datos** llega por `DATABASE_URL`: en desarrollo, desde `.env.development`, y en los tests, desde `.env.test`. Las dos apuntan a la PostgreSQL local, que no es accesible desde fuera, así que no son secretos. La CI y los entornos la fijan ellos mismos.

### Los tests

- **Dos proyectos de Vitest**: `unit`, sin base de datos, y `integration`, con la API entera arrancada en el proceso del test y las peticiones con `supertest`, contra su propia base de datos.
- **La base de datos de los tests** se borra, se vuelve a crear y se migra con `prisma migrate deploy` antes de cada ejecución. Solo se borra si su nombre acaba en `_test`.
- **Después de migrarla, se compara con `schema.prisma`**: un cambio del esquema sin su migración hace fallar los tests, también en la CI.

### Los instantes en UTC

- **En `domain`, en un módulo nuevo, `time/`**: `instantSchema`, que solo acepta el formato exacto de `toISOString()`, con milisegundos y la zona `Z` (`z.iso.datetime({ precision: 3 })`), y el tipo con marca `Instant`. La API lo usa desde esta sesión, y la web lo usará en la sesión 10 para las preferencias.

### La especificación

- **`docs/09-api.md`** describe las reglas comunes a todas las rutas y lo que existe hoy, y enlaza a la referencia para las rutas. Crece en cada sesión.

## Alternativas descartadas

- **NestJS 11 con `nestjs-zod`**: la API nacería sobre una versión `legacy`, en CommonJS y con Jest, distinta del resto del monorepo, y su migración dependería de un paquete sin fecha.
- **NestJS 12 forzando la dependencia de `nestjs-zod`**: nadie lo prueba, y su integración con Swagger depende de las partes internas de NestJS.
- **La referencia estática junto a la de TypeDoc**: la imagen de la web dependería del build de la API, y la referencia podría no coincidir con la API desplegada.
- **La referencia solo en desarrollo**: el ADR-0023 dice que se publica, y la API tiene rutas públicas.
- **Ocultar la referencia para no dar pistas de las rutas**: el repositorio es público, así que no oculta nada. La protección son los guards de cada ruta.
- **SWC**: más rápido, pero sin comprobar tipos, y con un compilador nativo que nadie más usa en el monorepo.
- **Empaquetar la API con Vite**: NestJS carga módulos opcionales al vuelo, que habría que excluir a mano, y no es una práctica documentada.
- **Organizar por tipo de fichero, o con capas de _clean architecture_ en cada módulo**: lo primero ya lo descarta el ADR-0018, y lo segundo serían capas vacías, porque la lógica de negocio vive en `domain` y `catalog-builder`.
- **PostgreSQL instalado con `apt` en WSL**: la versión la decide Ubuntu, no la imagen fijada que usan la CI y los entornos.
- **`prisma dev`**: es PGlite, una PostgreSQL adaptada que no es la de producción.
- **Contenedores de servicio de Actions**: la imagen estaría en tres ficheros que habría que mantener iguales a mano.
- **Testcontainers**: duplica lo que ya hacen Compose en desarrollo y en la CI.
- **Solo tests unitarios, o solo de integración**: los unitarios no prueban ni las rutas, ni la validación, ni las migraciones; sin ellos, cada fallo de la lógica de la API necesitaría la base de datos.
- **El esquema de los instantes en la API**: habría que moverlo a `domain` en la sesión 10, y la web podría acabar escribiendo su propia versión.
- **Solo el README de la API**: las reglas comunes quedarían repartidas entre ADR que no se actualizan.

## Consecuencias

- Corrige en parte el ADR-0038, que elegía `nestjs-zod`; el ADR-0040, que pedía un contenedor de servicio de Actions; y el ADR-0018, con la organización de `apps/api` y el módulo `time/` de `domain`.
- **Dependencias nuevas**, con versiones exactas:
  - de la API: NestJS (`@nestjs/common`, `@nestjs/core` y `@nestjs/platform-express`), sus dependencias `reflect-metadata` y `rxjs`, `@nestjs/swagger`, `@scalar/api-reference`, `@prisma/client` y `@prisma/adapter-pg`;
  - de desarrollo: `@nestjs/cli`, `@nestjs/testing`, `prisma`, `supertest`, `pg`, para borrar y crear la base de datos de los tests, y los tipos de Express, `supertest` y `pg`.
- **Scripts de instalación**: se permite el de `@prisma/engines`, que descarga el motor de las migraciones, y se rechazan los de `prisma`, `@scarf/scarf` (telemetría) y `vue-demi`.
- `pnpm test` necesita la PostgreSQL de Compose arrancada, como los tests de navegador necesitan Chromium.
- Cuando `nestjs-zod` admita NestJS 12 no hará falta volver a él: la validación propia de NestJS cubre lo que se usaba.
- El Nginx de cada entorno tiene que pasar a la API el `Host` original para que `REFERENCE_HOSTS` funcione, y cada entorno fija esa variable con el host de su web (sesión 4).
