# ADR-0017: Arquitectura objetivo con backend

- **Estado:** aceptada
- **Fecha:** 2026-11-07

## Contexto

El MVP es una PWA sin servidor:

- El catálogo se mantiene en JSON dentro del repositorio ([ADR-0016](0016-datos-curados-json.md)).
- El builder genera `catalog.json`.
- El catálogo se publica junto con la app ([ADR-0007](0007-versionado-distribucion.md)).

Más adelante se quiere:

- Mantener el catálogo desde una web de administración, con su frontal y su backend separados, y una API REST.
- Actualizar el catálogo de la PWA sin volver a desplegarla.
- Tener sesiones de usuario y otras funciones con datos propios de cada usuario.

## Decisión

- **Orden**: primero se completa el MVP según la hoja de ruta. El backend es una fase posterior y propia.
- **Estructura objetivo del monorepo**:
  - `apps/web`: la PWA pública.
  - `apps/admin`: el frontal de mantenimiento del catálogo.
  - `apps/api`: el backend REST con base de datos.
  - `packages/domain`: compartido por las tres apps. El backend lo usa para validar lo que guarda.
  - `packages/importers`: la importación de fuentes, extraída de `catalog-builder`.
- **API de administración**: un CRUD granular de pinturas, gamas, marcas, fuentes y equivalencias, con autenticación y un historial de cambios. El modelo y las reglas de docs/01-04 se mantienen: IDs congelados, lápidas, aristas dirigidas, licencias por fuente, desactivación por fuente y reglas de curación.
- **Qué consume la PWA de la API**, a partir de la fase 5 (en el MVP no hay API):
  - La instantánea pública del catálogo, para actualizar su catálogo local.
  - Los endpoints de usuario: sesión y sincronización.
  - No consume la API de administración ni consulta pinturas por REST: trabaja siempre con su catálogo local, porque tiene que funcionar offline y porque la rueda y las equivalencias calculadas recorren todas las pinturas.
- **Instantánea pública del catálogo**: la API expone el catálogo completo con el formato de [02-esquema-catalog-json.md](../02-esquema-catalog-json.md), pidiéndolo por versión de esquema (p. ej., `GET /catalog/v1`). Así la API sirve siempre un catálogo que la app instalada sabe leer. La PWA lo usa para sustituir su catálogo local:
  - Valida el catálogo descargado con `parseCatalog` antes de sustituir al local.
  - La sustitución es atómica: si algo falla, se conserva el catálogo anterior.
  - El catálogo incluido en la app se mantiene como respaldo.
- **Preparación desde la fase 4**:
  - Los importadores se escriben como funciones puras (fuente → filas), sin acceso a disco dentro de la lógica.
  - `domain` no depende de que el catálogo sea un fichero.
- **Usuarios**:
  - Cuentas y sesiones en `apps/api`, con dos roles: usuario y administrador. Solo el administrador accede a `apps/admin` y a la API de administración.
  - Los datos del usuario (colección, preferencias y, más adelante, recetas y lista de la compra) se guardan en la base de datos y se sincronizan entre dispositivos.
  - Offline primero: la PWA guarda los datos del usuario en local y los sincroniza cuando hay conexión.
  - La gestión de usuarios (altas, bajas y roles) se hace desde `apps/admin`.
- **Migración**: los JSON curados de la fase 4 se cargan una sola vez en la base de datos como datos iniciales.

## Alternativas descartadas

- **Empezar ya por el backend**: adelantaría la base de datos, la autenticación, la administración y un servidor siempre activo antes de validar la app, con la producción todavía sin decidir.
- **Que la PWA consulte las pinturas por REST**: rompería el funcionamiento offline y el cálculo de equivalencias sobre todo el catálogo.
- **Servir la instantánea solo en su versión más reciente**: una app instalada con una `schemaVersion` anterior no podría leerla.

## Consecuencias

- El ADR-0007 sigue vigente durante el MVP. Cuando se implemente la actualización del catálogo sin volver a desplegar, se sustituirá por un ADR nuevo.
- Los ADR 0011 (paso 4 de la CI), 0012 (entornos con base de datos) y 0016, y la especificación docs/04, se revisarán en la fase 5.
- Puntos abiertos para la fase 5:
  - Si la PWA busca versiones nuevas automáticamente, ofrece un botón de descarga o hace las dos cosas.
  - El stack del backend y de la base de datos.
  - La autenticación.
  - Dónde se despliega.
  - Cómo se resuelven los conflictos de sincronización cuando se edita el mismo dato en dos dispositivos sin conexión.
  - Si la cuenta es obligatoria o la app sigue siendo usable de forma anónima. La recomendación inicial es anónima con cuenta opcional.
  - El tratamiento de los datos personales (RGPD), que la app del MVP no recoge.
