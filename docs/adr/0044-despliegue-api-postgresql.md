# ADR-0044: El despliegue de la API y PostgreSQL

- **Estado:** aceptada
- **Fecha:** 2026-11-25

## Contexto

La sesión 4 de la fase 6 despliega `apps/api` y PostgreSQL junto a la web, en la VM de cada entorno, con lo que decidió el [ADR-0040](0040-despliegue-fase-6.md): Docker Compose, PostgreSQL solo accesible desde la VM, la API bajo `/api` del Nginx de la web, las migraciones al desplegar, las copias cifradas en el NAS con su prueba de restauración, y preproducción con el catálogo de producción. Hasta ahora, `apps/web/deploy/deploy.sh` desplegaba un único contenedor con `docker run` ([ADR-0026](0026-preproduccion-homelab.md), [ADR-0028](0028-produccion-homelab.md)).

Al concretarlo aparecen restricciones que el ADR-0040 no tenía en cuenta:

- **Las VM no tienen ni el repositorio ni su historial**, y `catalog:load` lee `data/` y saca de git el catálogo de la última etiqueta `release/` ([ADR-0043](0043-catalogo-en-postgresql.md)).
- **`preprod` va por delante de `main`** hasta la sesión 9: su `data/` es el que se está probando.
- **Node no ejecuta TypeScript dentro de `node_modules`** (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), y `domain` y `catalog-builder` se publican como `.ts`. `pnpm deploy` los copia ahí.
- **El NAS es TrueNAS 25.04** y ya ofrece SMB y NFS, sin SSH. SMB comparte todo el pool, del que leen los servicios multimedia, y otro servicio tiene un dataset propio exportado por NFS solo a la IP de su máquina. restic desaconseja guardar su repositorio en un recurso CIFS de Linux, y TrueNAS 25.04 no permite encerrar a un usuario SFTP en su carpeta.
- **Detrás de Cloudflare, el túnel y Nginx Proxy Manager**, el Nginx de la web ve siempre la IP de Nginx Proxy Manager.
- **El catálogo generado desde el borrador solo coincide con la última publicación cuando no hay pendientes**, y casi siempre los habrá.

## Decisión

### El catálogo en la base de datos

- **`verify` genera un paquete del catálogo** (`catalog:pack`): los ficheros de `data/` y el catálogo de la última etiqueta, ya leídos, en un único JSON, que sube con el artefacto del despliegue.
- **Cada despliegue lo carga** con la imagen nueva de la API (`catalog:load --from`), después de las migraciones. La carga ya se podía repetir: sustituye el borrador entero y solo guarda la primera publicación si no hay ninguna.
- **La carga semanal de preproducción desde el NAS**, y el volcado de las tablas del catálogo que la alimenta, se aplazan a la sesión 9. Hasta entonces el borrador de cada entorno es el `data/` de su rama, y cargar el de producción en preproducción borraría lo que se está probando.

### Dónde está cada pieza

- **`deploy/`**, en la raíz, para lo que es de la VM entera: el `compose.yaml`, `deploy.sh`, las comprobaciones comunes y las copias.
- **`apps/<app>/deploy/`** para la imagen de cada app y sus comprobaciones: `apps/web/deploy/` como hasta ahora, y `apps/api/deploy/`. Corrige al [ADR-0028](0028-produccion-homelab.md), que dejaba el despliegue en `apps/web/deploy/`.
- **PostgreSQL se describe una sola vez**: el Compose del despliegue hereda el servicio del de desarrollo (`apps/api/compose.yaml`) sin su puerto ni sus credenciales.

### El despliegue

- **Orden**: las imágenes de la versión, PostgreSQL (solo se recrea si cambia su imagen y, si no arranca, vuelve a la anterior), las migraciones, la carga del catálogo, la web y la API candidatas comprobadas sin tráfico, la sustitución y su comprobación por el dominio público.
- **La web y la API van y vuelven juntas**, como una unidad del mismo commit: solo se sirve la pareja que la CI ha probado junta. La base de datos nunca vuelve atrás; por eso las migraciones amplían y después recortan.
- **La web no depende de la API para arrancar**: Nginx resuelve la API en cada petición, y si la API cae la web sigue sirviendo y `/api` responde con un error.
- **Las candidatas tienen su propia red**, donde la API candidata se llama `api`. En la red de las que sirven se llama `api-candidate`, así que la web que sirve nunca le pasa tráfico.
- **La CI ejecuta el propio `deploy.sh`** con la imagen de cada entorno, y después la copia y la prueba de restauración, con un volumen local en lugar del NAS.

### Los secretos

- **Un fichero por secreto en `/etc/colorwheel/secrets/`** de la VM, montado con los `secrets` de Compose en `/run/secrets/` de los contenedores que lo necesitan. No son variables de entorno, así que no salen en `docker inspect` ni los heredan los procesos.
- **La contraseña de PostgreSQL está en un solo fichero**, que leen PostgreSQL (`POSTGRES_PASSWORD_FILE`) y la API (`DATABASE_PASSWORD_FILE`, que completa `DATABASE_URL`).
- **Nada en GitHub ni en el repositorio.** El usuario del runner puede leerlos, como ya aceptaba el ADR-0040.

### Las copias

- **restic**, con su imagen oficial: cifra con la contraseña del repositorio, conserva 7 diarias y 4 semanales y comprueba el repositorio. El volcado de `pg_dump` se escribe primero en un fichero, para que un volcado fallido nunca sea una copia.
- **La contraseña está en la VM**, porque la prueba mensual es automática y tiene que descifrar, y una copia en el gestor de contraseñas de Miguel, para restaurar si se pierde la VM. Una por entorno.
- **NFS, con el mismo patrón que el servicio que ya lo usa**: un dataset propio por entorno, `DATA/colorwheel/<entorno>`, exportado solo a la IP de su VM con un usuario propio. No añade protocolos al NAS ni toca carpetas de otros servicios. Docker monta el NFS solo mientras dura la copia, y el cortafuegos de la VM solo abre el puerto 2049 del NAS.
- **Instantáneas diarias de ZFS** de `DATA/colorwheel`, que la VM no puede borrar, aunque restic sí pueda borrar copias.
- **Un workflow programado de GitHub Actions**, ejecutado por el runner de cada VM: la copia cada noche y la prueba de restauración el día 1 de cada mes, y también a demanda. Cada entorno usa los scripts de su rama.
- **El aviso es el correo de GitHub** cuando el workflow falla. Cada copia comprueba además que la anterior tiene como mucho 26 horas, así que una noche que GitHub no lanzó hace fallar la siguiente.

### La prueba de restauración

Corrige al ADR-0040, que comparaba el catálogo generado desde el borrador con la última publicación. Se restaura la última copia en una PostgreSQL temporal y se comprueba que:

- **restic lee y verifica cada byte** de su repositorio (`check --read-data`);
- **la última publicación restaurada es la misma** que la de la base de datos viva con su `uuid`, byte a byte, así que no falla si se publica entre la copia y la prueba;
- **el borrador restaurado genera un catálogo que se puede publicar**, con los IDs comprobados contra esa publicación.

### Las imágenes

- **La API**: la imagen oficial de Node en Debian _slim_, con la versión de `devEngines` (un test las mantiene iguales), sin `root`, de solo lectura, sin capacidades y sin poder ganar privilegios. La misma imagen aplica las migraciones y carga el catálogo, así que la CLI de Prisma pasa a dependencia de producción.
- **El paquete de la API**: `verify` instala sus dependencias de producción con la estructura del monorepo, con `domain` y `catalog-builder` fuera de `node_modules`, enlazados como en desarrollo, y lo sube en un `tar`, porque los artefactos de GitHub no conservan los enlaces. La VM monta la imagen con él, sin compilar nada, como la de la web.
- **PostgreSQL**: con su usuario, sin `root`, de solo lectura salvo su volumen y sin capacidades.
- **Todas fijadas por versión y digest**, con Dependabot.

### `/api` en el Nginx de la web

- **El límite**: 10 peticiones por segundo de media y ráfagas de 20 por visitante, y después 429, por la IP de `CF-Connecting-IP`. Se acepta de cualquier origen porque el cortafuegos de la VM solo deja llegar a Nginx Proxy Manager.
- **La compresión**: gzip de las respuestas de la API. Cloudflare entrega Brotli al navegador.
- **El `Host` original llega a la API**, para `REFERENCE_HOSTS`, y sus respuestas no se indexan.
- **El service worker no guarda nada de `/api`**: `smoke-check.sh` falla si precachea una dirección de `/api/`, y un test de extremo a extremo comprueba que, sin conexión, no responde a ninguna.

## Alternativas descartadas

- **Copiar `data/` dentro de la imagen de la API**: mezcla datos y código, y la imagen dependería de la rama.
- **La carga manual por SSH**: no se puede repetir ni pasa por la CI.
- **Todo en `apps/web/deploy/`**: la web sería dueña de la API, de PostgreSQL y de las copias.
- **Desplegar y volver atrás cada pieza por separado**: sirve combinaciones de versiones que nadie ha probado.
- **Sin candidatas, con `docker compose up` y comprobar después**: un fallo deja el entorno roto hasta volver atrás.
- **Los secretos en un `.env` o en los entornos de GitHub**: cada contenedor los vería todos, o cualquier workflow de la rama, y la clave para restaurar no puede depender de GitHub.
- **`pg_dump` con `age` y un script propio**: la retención y la comprobación serían código nuestro.
- **La clave de las copias fuera de la VM**: la prueba mensual pasaría a ser manual.
- **SMB, montado como CIFS o con rclone**: restic lo desaconseja con CIFS, y con rclone haría falta una imagen propia y un usuario con contraseña.
- **SFTP o el `rest-server` de restic**: añaden un protocolo o un servicio al NAS.
- **Temporizadores de systemd o un contenedor con `cron`**: se instalan fuera de la CI y necesitan su propio aviso.
- **Un servicio de «hombre muerto» o un aviso al móvil**: otra cuenta y otra pieza para una copia diaria.
- **Montar la imagen de la API en `verify` y cargarla en la VM**: contradice el ADR-0040 y lo que hace la web, y cada despliegue movería unos 600 MB.
- **Compilar `domain` y `catalog-builder` a JavaScript**: cambia cómo los usan la web y los tests, para un problema que solo tiene la imagen.
- **El límite en una regla de Cloudflare o en la API**: fuera de la CI, o contra lo que decidió el ADR-0043.
- **Comparar el catálogo generado desde el borrador con la publicación**: falla en cuanto hay pendientes.

## Consecuencias

- La VM pasa a 4 GB. Miguel crea en ella `/etc/colorwheel/` con sus secretos y la dirección del NAS, y en el NAS, los datasets, sus exportaciones y las instantáneas ([docs/08](../08-despliegue.md) §7).
- La imagen de la API ocupa unos 1,2 GB, casi todo de la CLI de Prisma y de Scalar. Se conservan las cinco últimas, como las de la web.
- El primer despliegue sustituye el contenedor de la web que arrancaba `docker run` por el del Compose, y si falla, vuelve a esa web sin API.
- Una migración que falla a medias queda marcada en Prisma y se resuelve a mano ([docs/08](../08-despliegue.md) §6).
- GitHub desactiva los workflows programados de un repositorio público tras 60 días sin actividad, y avisa por correo antes.
- La sesión 9 añade el volcado del catálogo de producción en el NAS y su carga semanal en preproducción, con un dataset hijo exportado a preproducción solo para lectura.
