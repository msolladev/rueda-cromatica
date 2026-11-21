# ADR-0028: Producción en el homelab

- **Estado:** aceptada
- **Fecha:** 2026-11-21

## Contexto

El [ADR-0012](0012-entornos.md) dejó la producción por decidir y apuntaba a un alojamiento estático. El [informe de alojamiento](../investigacion/2026-11-alojamiento-produccion.md) compara los alojamientos gratuitos y concluye que solo el homelab sirve hoy la web con las reglas de docs/07 §12 y admite después, en el mismo sitio, la API, la administración y la base de datos de la fase 6 ([ADR-0017](0017-arquitectura-objetivo-backend.md)). Miguel lo elige (informe §7).

La preproducción ya funciona en el homelab ([ADR-0026](0026-preproduccion-homelab.md)), pero su configuración del servidor estaba escrita solo para ella. El [ADR-0025](0025-estabilidad-ids-etiqueta-publicacion.md) admite una publicación al día, y el [ADR-0023](0023-documentacion-tecnica.md) deja para este momento la publicación de la referencia de la API. El funcionamiento está en [docs/08](../08-despliegue.md).

## Decisión

- **Producción en el homelab**, en una VM propia, distinta de la de preproducción y con la misma forma: Ubuntu, Docker, el runner propio que solo hace conexiones salientes, el cortafuegos de Proxmox, el túnel de Cloudflare y Nginx Proxy Manager. El dominio es `colorwheel.msolla.dev`.
- **Una sola configuración del servidor para los dos entornos**, en `apps/web/deploy/`: la imagen, `nginx.conf`, el despliegue, sus comprobaciones y la página de mantenimiento. Lo que cambia por entorno va en `apps/web/deploy/environments/<entorno>.conf`, que la imagen elige al montarse. Hoy solo cambia la indexación: preproducción responde con `X-Robots-Tag: noindex` y producción no. La CI comprueba la imagen de cada entorno en cada build.
- **Un solo workflow de despliegue para los dos entornos** (`deploy.yml`), al que `ci.yml` llama con el entorno de la rama: `preprod` despliega en `preprod` y `main` en `production`, cada uno con el `dist` que su CI compiló con su origen.
- **Un runner por entorno**, en la VM de ese entorno, con la etiqueta `colorwheel-<entorno>`. Tres barreras impiden que `preprod` despliegue en producción: el job de producción solo se ejecuta con un push a `main`, solo lo recoge el runner de producción, y el entorno `production` de GitHub solo admite la rama `main`.
- **La etiqueta de publicación** la crea el CD de producción después de que la versión nueva pase las comprobaciones por el dominio público, con el permiso `contents: write` solo en ese paso. La primera publicación de un día se etiqueta `release/AAAA-MM-DD`, y las siguientes del mismo día, `release/AAAA-MM-DD.2`, `.3`…, con la fecha en UTC. El builder las ordena por fecha y número. Una regla del repositorio impide mover y borrar las etiquetas `release/*`, pero no crearlas.
- **La referencia de la API** se sirve en `/reference/` de la misma imagen, en los dos entornos, sin indexar.
- **La página de mantenimiento y la vuelta atrás automática** son las de preproducción. Un fallo que llega a producción se corrige con un `git revert` en `preprod`, que llega a `main` como cualquier publicación.

## Alternativas descartadas

- **Un alojamiento estático** (Cloudflare Workers, statichost.eu y los demás del informe): ninguno admite la fase 6 en el mismo sitio, y varios no cumplen las reglas de docs/07 §12.
- **Producción en la VM de preproducción**: un fallo o un compromiso de una alcanzaría a la otra.
- **Copiar la configuración de preproducción para producción**: dos copias que se desincronizan.
- **Una sola imagen que decide la indexación por el dominio de la petición**: deja el dominio de producción dentro de la configuración del servidor, y la comprobación sin tráfico tendría que fingir ese dominio.
- **El runner de preproducción despliega en producción por SSH**: abre el cortafuegos entre las dos VM y deja en preproducción una clave de producción.
- **Una sola publicación al día**: sin etiqueta para la segunda, sus IDs quedan sin proteger; moviendo la etiqueta, deja de significar algo fijo; y prohibiéndola, bloquea la corrección urgente de un fallo.
- **La referencia en GitHub Pages**: un segundo destino de despliegue, con más permisos y acciones, que preproducción no prueba antes.
- **La referencia en un subdominio propio**: un servicio más en Nginx Proxy Manager, y quizá cambios en el túnel.
- **Corregir un fallo de producción directamente en `main`**: la corrección no pasa por preproducción y las ramas se desincronizan hasta fusionar `main` en `preprod`.

## Consecuencias

- La disponibilidad de la web pública depende de la conexión, la luz y el servidor de casa, y los bloqueos de LaLiga alcanzan a las IP de Cloudflare que publica el túnel (informe §5).
- Preproducción prueba la misma configuración que sirve producción, salvo el fichero de su entorno.
- Cada publicación crea su etiqueta, y con ella los IDs quedan protegidos desde la primera.
- Corrige en parte:
  - el [ADR-0012](0012-entornos.md): la producción, que quedaba por decidir;
  - el [ADR-0023](0023-documentacion-tecnica.md): la referencia de la API se publica en los dos entornos;
  - el [ADR-0025](0025-estabilidad-ids-etiqueta-publicacion.md): el formato de la etiqueta y el límite de una publicación al día;
  - el [ADR-0026](0026-preproduccion-homelab.md): la configuración del servidor es común, y `noindex` es solo de preproducción.
