# @chromatic-wheel/api

La API REST de la rueda, con NestJS y PostgreSQL. Guardará el catálogo curado, sus publicaciones, las cuentas y las preferencias. Hoy tiene:

- las rutas bajo `/api`, con la versión siempre explícita (`/api/v1/…`);
- la validación de las peticiones y las respuestas con Zod, que también genera la especificación OpenAPI;
- la referencia de la API con Scalar;
- PostgreSQL con Prisma 7 y sus migraciones;
- `GET /api/v1/health`, que comprueba que la API y su base de datos responden;
- el catálogo en la base de datos: su borrador, con las mismas capas que `packages/catalog-builder/data/`, la carga desde esa carpeta, la generación del catálogo idéntica a `build-catalog`, sus publicaciones y `GET /api/v1/catalog?schemaVersion=1`, que sirve la última ([docs/09](../../docs/09-api.md) §8).

Las reglas comunes a todas las rutas están en [docs/09](../../docs/09-api.md), y las rutas, en la referencia que sirve la propia API.

## Ejemplo

Con Docker en marcha, desde la raíz del repositorio:

```sh
pnpm --filter @chromatic-wheel/api db:up   # PostgreSQL de desarrollo
pnpm --filter @chromatic-wheel/api dev     # la API en http://localhost:3000
```

```sh
curl http://localhost:3000/api/v1/health
# {"status":"ok","checkedAt":"2027-03-01T09:00:00.000Z"}
```

La referencia está en `http://localhost:3000/api/v1/reference`.

Con el catálogo cargado:

```sh
pnpm --filter @chromatic-wheel/api catalog:load
curl 'http://localhost:3000/api/v1/catalog?schemaVersion=1'
# el catalog.json de la última publicación, tal como se publicó
```

## Comandos

Con `pnpm --filter @chromatic-wheel/api <script>`:

- `db:up` / `db:down`: arranca o para la PostgreSQL de desarrollo (`compose.yaml`). Sus datos se conservan en un volumen.
- `db:reset`: la para y borra sus datos.
- `db:migrate`: crea una migración con los cambios de `prisma/schema.prisma` y la aplica a la base de datos de desarrollo ([docs/09](../../docs/09-api.md) §6).
- `dev`: la API con recarga al cambiar el código, con las variables de `.env.development`.
- `catalog:load`: carga `packages/catalog-builder/data/` en el borrador de la base de datos de desarrollo y, si todavía no hay ninguna publicación, guarda como primera el `catalog.json` de la última etiqueta `release/`. Se puede repetir ([docs/09](../../docs/09-api.md) §8.3).
- `build` / `start`: compila la API en `dist/` y la arranca. `start` toma la configuración de las variables de entorno ([docs/09](../../docs/09-api.md) §2).
- `test`: los tests unitarios y los de integración, que necesitan la PostgreSQL de `db:up` ([docs/09](../../docs/09-api.md) §7).
- `typecheck`: los tipos, con el cliente de Prisma recién generado.
