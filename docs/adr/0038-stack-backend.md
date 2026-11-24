# ADR-0038: El stack de `apps/api` y `apps/admin`

- **Estado:** aceptada
- **Fecha:** 2026-11-24

## Contexto

El [ADR-0017](0017-arquitectura-objetivo-backend.md) dejó para la fase 6 el stack del backend y de la base de datos, y el [ADR-0023](0023-documentacion-tecnica.md) dejó la referencia de la API REST para cuando se eligiera el framework de `apps/api`, con Scalar como candidato. Con el [ADR-0037](0037-catalogo-en-base-de-datos.md), la base de datos guarda el catálogo curado, los cambios pendientes, el historial, las publicaciones, las cuentas y las preferencias. Son pocos datos y pocas escrituras: un administrador y las preferencias de los usuarios.

El proyecto ya valida con Zod 4 en `domain`. Lo ideal es que un mismo esquema valide cada petición, dé sus tipos y genere la especificación OpenAPI. Miguel está aprendiendo NestJS.

Las versiones citadas son las publicadas en npm a 2026-11-24.

## Decisión

### `apps/api`

- **NestJS, con su motor HTTP por defecto, Express.** Es el que usan casi toda la documentación y los ejemplos de NestJS, y la velocidad de Fastify no se nota a esta escala.
- **La validación, con Zod**, mediante `nestjs-zod` (5.x, que admite Zod 4): los esquemas se convierten en los DTO de NestJS, sin `class-validator`.
- **La especificación OpenAPI** sale de esos mismos esquemas con `@nestjs/swagger`, y la referencia de la API se publica con Scalar.
- **Las clases y los decoradores de NestJS solo están en la capa de la API**: los controladores, los servicios y los guards. La lógica sigue pura en `domain` y en `catalog-builder` ([ADR-0018](0018-organizacion-codigo-patrones.md)).
- **La API se compila** antes de ejecutarse, porque los decoradores no se pueden quitar al vuelo como los tipos.

### Rutas

- **La versión de la API va al principio de la ruta, siempre explícita**, con el versionado por URI de NestJS: `/api/v1/…`. No hay ninguna ruta sin versión que signifique «la última», porque la PWA instalada que la usara se rompería sin aviso al salir la siguiente.
- **La versión del esquema del catálogo es un parámetro**, para no confundirla con la de la API: `GET /api/v1/catalog?schemaVersion=1`.
- **Tres grupos**, por quién puede usarlos:
  - `/api/v1/catalog`: cualquiera, sin sesión, con límite de peticiones y cabeceras de caché;
  - `/api/v1/me/…`: un usuario con sesión, solo sus datos;
  - `/api/v1/admin/…`: una sesión con el rol de administrador.

### Fechas

- **Se envían y se guardan siempre en UTC.** La PWA y `apps/admin` envían cada instante con `toISOString()` (`2027-03-01T09:00:00.000Z`), nunca como texto en la hora local ni sin zona. La API solo acepta ese formato (`z.iso.datetime()` de Zod).
- **En PostgreSQL, `timestamptz`**: cada fecha del esquema de Prisma se declara con `@db.Timestamptz`, porque Prisma usa por defecto `timestamp` sin zona.
- **Se muestran en la zona horaria y el idioma de quien las ve**, con `Intl.DateTimeFormat`.

### La base de datos

- **PostgreSQL**, en su contenedor oficial, en la VM de cada entorno ([ADR-0040](0040-despliegue-fase-6.md)). Es la referencia del ecosistema, tiene un tipo JSON con índices para las publicaciones y las preferencias, y su herramienta oficial de copias (`pg_dump`).
- **Prisma 7**, la última versión estable, fijada de forma exacta, para el acceso a los datos y las migraciones. Las tablas se describen en `schema.prisma`, Prisma genera el cliente con sus tipos, y cada cambio de estructura es una migración en SQL que se revisa en el PR y se aplica con `prisma migrate deploy`.

### `apps/admin`

- **React y Vite, como `apps/web`**: una aplicación de una sola página, sin prerenderizado, sin PWA y sin SEO, con la misma configuración de ESLint, TypeScript y Vitest.
- **Las llamadas a la API, tipadas desde su especificación OpenAPI**, para que el frontal y la API no puedan desalinearse sin que lo detecte TypeScript.
- **En castellano, con los textos en un diccionario tipado** desde el principio, como la web ([docs/07](../07-web.md) §9). Añadir un idioma será añadir un fichero.
- **Le aplican las reglas de interfaz de CLAUDE.md**: WCAG 2.2 AA, ratón, teclado y pantalla táctil, y mobile first.

## Alternativas descartadas

- **Fastify solo**: maduro y con plugins oficiales de seguridad, pero Miguel aprende NestJS, y NestJS mantiene la lógica fuera del framework.
- **NestJS sobre Fastify**: no aporta nada a esta escala, y parte del ecosistema de NestJS da por hecho Express.
- **Hono**: pensado sobre todo para servidores en el borde de la red, con un ecosistema de servidor más pequeño en Node.
- **Express sin NestJS**: no valida ni genera la especificación OpenAPI por sí mismo.
- **Una ruta sin versión para la última**: cambia de comportamiento sin aviso al salir la siguiente versión.
- **`/api/catalog/v1`**: mezcla la versión del esquema del catálogo con la de la API.
- **SQLite** (`node:sqlite`, que en Node 26.13 funciona sin aviso de experimental): no hay servicio que mantener, pero se aprende menos de un backend habitual, y no admite varias copias de la API.
- **MariaDB o MySQL**: no aportan nada frente a PostgreSQL, y su tipo JSON es más limitado.
- **Drizzle**: su versión estable es la 0.45 y la 1.0 está en candidata, con cambios que rompen, incluida la carpeta de migraciones.
- **TypeORM**: comprueba menos tipos, y su mantenimiento ha sido irregular durante años.
- **Kysely**: no tiene migraciones generadas ni integración con NestJS.
- **React Admin o Refine para `apps/admin`**: su modelo de «guardar y ya está» choca con los cambios pendientes y la publicación única.
- **Angular para `apps/admin`**: un segundo framework de frontal en el monorepo, con otras herramientas.
- **`apps/admin` en los 13 idiomas**: cada texto se escribiría 13 veces para un solo administrador. Escribirlos directamente en las pantallas obligaría a recorrer todas para añadir un idioma.

## Consecuencias

- Completa el [ADR-0023](0023-documentacion-tecnica.md): la referencia de la API REST se genera desde la especificación OpenAPI de `@nestjs/swagger` y se publica con Scalar.
- `apps/api` tiene un paso de build propio, y su CI necesita PostgreSQL para los tests ([ADR-0040](0040-despliegue-fase-6.md)).
- Cada dependencia nueva (NestJS, `nestjs-zod`, `@nestjs/swagger`, Scalar, Prisma) se fija de forma exacta, con la madurez mínima de 7 días. Las que comparten la API y `apps/admin` van en el `catalog:` de pnpm.
- `nestjs-zod` es de la comunidad: si se abandona, la validación se escribiría con un pipe propio sobre Zod.
