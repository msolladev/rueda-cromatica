# ADR-0040: El despliegue de la fase 6

- **Estado:** aceptada; corregida en parte por [ADR-0042](0042-esqueleto-api.md) y [ADR-0044](0044-despliegue-api-postgresql.md)
- **Fecha:** 2026-11-24

## Contexto

Preproducción y producción son una VM cada una en el homelab, con 2 GB de memoria, el contenedor de Nginx con la web y el runner de GitHub que despliega ([ADR-0026](0026-preproduccion-homelab.md), [ADR-0028](0028-produccion-homelab.md), [docs/08](../08-despliegue.md)). El túnel de Cloudflare lleva todos los subdominios a Nginx Proxy Manager, y un servicio nuevo solo necesita su entrada allí. Las VM no tienen copias de seguridad, porque no guardan nada que no esté en el repositorio.

La fase 6 añade `apps/api`, `apps/admin` y PostgreSQL ([ADR-0038](0038-stack-backend.md)). Desde la migración, el catálogo curado solo existe en la base de datos ([ADR-0037](0037-catalogo-en-base-de-datos.md)). El certificado gratuito de Cloudflare solo cubre un nivel de subdominio (`*.msolla.dev`).

## Decisión

### Dónde se ejecuta cada pieza

- **Todo en la VM de cada entorno**, cada pieza en su contenedor, descritas juntas en un fichero de Docker Compose: la web, `apps/admin`, la API y PostgreSQL, con sus datos en un volumen. La VM pasa a 4 GB de memoria.
- **PostgreSQL solo es accesible desde la propia VM.**
- **Las imágenes** de la API y de `apps/admin` se montan en el runner de la VM, como la de la web, con sus comprobaciones y su vuelta atrás automática.

### Direcciones

- **La API va bajo `/api` de cada frontal**, y el Nginx de la VM pasa esas peticiones a la misma API:
  - la web llama a `colorwheel.msolla.dev/api/v1/…`;
  - `apps/admin`, en `colorwheel-admin.msolla.dev`, llama a `colorwheel-admin.msolla.dev/api/v1/…`.
- **En preproducción**: `colorwheel-preprod.msolla.dev` y `colorwheel-admin-preprod.msolla.dev`.
- **Así no hace falta CORS**, las cookies son las más estrictas posibles, y la sesión de la web y la de `apps/admin` son distintas: un fallo en la web pública no llega a la sesión del administrador.
- **El service worker no guarda nunca nada de `/api`**, y los buscadores no indexan `apps/admin`. La CI comprueba las dos cosas.
- **Una entrada nueva en Nginx Proxy Manager por entorno**, la de `apps/admin`. El túnel no se toca.

### Copias de seguridad

- **Un volcado diario de PostgreSQL** con `pg_dump`, cifrado, que sale de la VM hacia el NAS del homelab, una máquina distinta del servidor de Proxmox. Se guardan 7 copias diarias y 4 semanales.
- **Una prueba de restauración mensual**: se restaura la última copia en una PostgreSQL temporal y se comprueba que el catálogo que genera coincide con la última publicación.
- **El cortafuegos de la VM abre solo el NAS**, en su puerto, y el NAS tiene un usuario propio para las copias que solo escribe en su carpeta.

### Los datos de preproducción

- **Preproducción tiene su propia PostgreSQL**, con el catálogo de producción y nunca con los datos de los usuarios.
- **Producción deja en el NAS un volcado solo de las tablas del catálogo**, junto a sus copias. Preproducción lo carga cada semana y cuando Miguel lo pide. Las dos VM siguen sin poder hablar entre ellas.
- **Lo que se edite en `apps/admin` de preproducción se pierde** en la siguiente carga, y las cuentas de preproducción son de prueba.

### La CI

- **La API y `apps/admin` se comprueban como los demás paquetes**: lint, tipos y tests. Los tests de la API usan una PostgreSQL temporal en el runner de GitHub, como contenedor de servicio de Actions.
- **Un catálogo de prueba congelado** para los tests: una copia de una publicación real, en la carpeta de los tests, que se actualiza cuando un test lo necesita. Los PR compilan y prueban la web con él. Los despliegues descargan la última publicación de su entorno y pasan todas las comprobaciones también con ella antes de servirla.
- **Las migraciones las aplica el despliegue** (`prisma migrate deploy`) antes de arrancar la API nueva. Cada migración funciona también con la versión anterior de la API, porque la vuelta atrás automática devuelve la imagen pero no la base de datos: primero se amplía (una columna nueva) y, en un despliegue posterior, cuando ya nadie la usa, se recorta (se quita la vieja).
- **«Publicar» lanza el despliegue** de su entorno con la API de GitHub, en la rama de ese entorno (`preprod` o `main`), con un token que solo puede lanzar los workflows de este repositorio, guardado en la VM. Si llega otro despliegue, espera, como hoy.

## Alternativas descartadas

- **La base de datos en una VM propia por entorno**: cuatro VM en lugar de dos, con cortafuegos entre ellas, y la API seguiría necesitando la contraseña de la base de datos en la VM del runner.
- **Una sola PostgreSQL para los dos entornos**: un fallo o un ataque en preproducción alcanzaría a producción ([ADR-0028](0028-produccion-homelab.md)).
- **La API en su propio subdominio**: necesita CORS para los dos frontales, una entrada más en Nginx Proxy Manager por entorno y una sola sesión compartida entre la web y `apps/admin`.
- **`apps/admin` bajo `/admin/` de la web**: comparte origen con la web pública, así que un fallo en la web llegaría a la sesión del administrador.
- **Subdominios de dos niveles** (`admin.colorwheel.msolla.dev`): el certificado gratuito de Cloudflare no los cubre.
- **Copias de la VM entera con Proxmox**: recuperar una ficha obliga a restaurar la máquina, y en el mismo servidor un fallo del disco se lleva también la copia.
- **Archivado continuo con pgBackRest**: pensado para bases de datos con mucho tráfico.
- **Preproducción con un catálogo propio cargado una vez**: se aleja del real, y las migraciones se prueban sobre datos que ya no se parecen a los de producción.
- **Datos de prueba inventados en preproducción**: no prueban nada que no prueben ya los tests.
- **Que los PR descarguen la publicación de producción**: el mismo commit daría resultados distintos según el día, y un PR fallaría por una publicación o porque el homelab no responde.

## Consecuencias

- Las VM dejan de poder rehacerse sin copias: docs/08 §7 incluirá la restauración de la base de datos, y §8 las copias y su prueba.
- La API guarda en la VM de cada entorno sus secretos: la contraseña de PostgreSQL, la clave de cifrado de las copias, los de los proveedores de inicio de sesión y el token de GitHub.
- El runner, que maneja Docker, tiene acceso a la base de datos. Su riesgo se acota como hoy: solo acepta trabajos de las ramas protegidas y de los colaboradores.
- Queda pendiente la copia fuera de casa (la tercera de la regla 3-2-1): un incendio o un robo se llevaría el servidor y el NAS a la vez. Se decide antes de que haya usuarios reales con cuenta.
