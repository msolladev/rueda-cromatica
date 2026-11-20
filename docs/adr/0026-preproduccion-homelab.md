# ADR-0026: Preproducción en el homelab

- **Estado:** aceptada
- **Fecha:** 2026-11-20

## Contexto

El [ADR-0012](0012-entornos.md) sitúa la preproducción en una máquina nueva del homelab, servida con Docker detrás del túnel de Cloudflare y de Nginx Proxy Manager, y deja pendientes el tipo de máquina, el servidor estático y la forma del artefacto. El [ADR-0011](0011-ci-cd.md) pide que la despliegue un runner propio que solo hace conexiones salientes, con el mismo artefacto que construyó la CI. Pero `SITE_ORIGIN` se fija al compilar y es distinto en cada entorno, así que un único artefacto no sirve para preproducción y producción. Además, el plan gratuito de GitHub no permite proteger ramas ni usar variables por entorno en un repositorio privado. El funcionamiento está en [docs/08](../08-despliegue.md).

## Decisión

- **Flujo de ramas**: las ramas de trabajo entran en `preprod` con un PR y se fusionan con _squash_, con un título que sigue Conventional Commits. `preprod` llega a `main` con un PR fusionado con un commit de merge, para que las dos ramas compartan historia. Cada push a `preprod` despliega en preproducción; `main` desplegará en producción. Dependabot también abre sus PR contra `preprod`.
- **Máquina**: una VM de Proxmox con Ubuntu 26.04 LTS, creada con cloud-init, que es lo que recomienda Proxmox para ejecutar contenedores de aplicación con el máximo aislamiento ([Proxmox VE, Linux Container](https://pve.proxmox.com/wiki/Linux_Container)). Es la misma versión de Ubuntu que usan los runners de la CI.
- **Servidor**: Nginx, en la imagen oficial que se ejecuta sin `root`, fijada por versión y digest, con un contenedor de solo lectura y sin capacidades. Su configuración cumple docs/07 §12 y añade a todas las respuestas `X-Robots-Tag: noindex`, que evita la indexación sin cambiar el build ni el `robots.txt`.
- **Artefacto**: cada entorno despliega el `dist` que su CI compiló con su origen y probó, sin recompilarlo. En preproducción, la CI de cada push a `preprod` lo sube como artefacto de Actions, y el runner lo descarga y monta con él la imagen. Producción compilará el suyo desde `main`. Sustituye a la «promoción manual del mismo artefacto» del ADR-0011.
- **Runner**: en la misma VM que sirve la web, con un usuario propio. El cortafuegos de Proxmox aísla la VM: solo recibe tráfico de Nginx Proxy Manager y solo sale a internet, no al resto de la red.
- **Despliegue con comprobaciones y vuelta atrás automática**: la versión nueva arranca junto a la que sirve y se comprueba sin tráfico; si pasa, la sustituye y se vuelve a comprobar por el dominio público; si esa comprobación falla, vuelve sola la imagen anterior. Se guardan las cinco últimas imágenes. Los fallos funcionales que pasan los tests se deshacen con `git revert`.
- **Página de mantenimiento**: Nginx Proxy Manager la sirve con el estado 503 y `Retry-After` mientras la web no responde (el cambio de contenedor o un reinicio de la VM). Es un HTML estático por subdominio, sin ficheros externos, que se recarga solo.
- **Repositorio público**, con los PR limitados a los colaboradores y la aprobación obligatoria de los workflows de cualquier persona de fuera, para que nadie ajeno pueda ejecutar código en el runner del homelab. Así el plan gratuito permite proteger `preprod` y `main` (PR y CI obligatorios), las variables por entorno y limitar el entorno `preprod` a su rama. Sustituye a lo que el ADR-0011 da por hecho sobre el repositorio privado.
- **Configuración**: `SITE_ORIGIN` es una variable del entorno `preprod` de GitHub. El despliegue no necesita secretos. Ni el repositorio ni los registros de Actions, que son públicos, contienen IPs, nombres de máquinas ni la configuración del homelab.

## Alternativas descartadas

- **Un contenedor LXC**: menos aislamiento para el runner, y los contenedores de aplicación de Proxmox aún son una vista previa tecnológica.
- **Caddy o static-web-server**: el HTTPS automático de Caddy sobra detrás de Nginx Proxy Manager, y static-web-server tiene mucha menos comunidad.
- **La imagen completa en un registro**: más piezas, una credencial del registro en el homelab y, con un repositorio privado, la cuota de almacenamiento.
- **Un build sin origen completado al desplegar**: obliga a cambiar el build, y modificar los ficheros compilados desincroniza las revisiones del precaché de Workbox.
- **El runner en otra VM**, que despliega por SSH: la clave SSH le daría igualmente la VM de la web, con más piezas.
- **Proteger la preproducción con Cloudflare Access o con contraseña**: el inicio de sesión se interpone con el service worker y el `manifest`, y dificulta probar la PWA instalada y sin conexión.
- **Volver atrás solo con `git revert` o volviendo a ejecutar un despliegue anterior**: no es automático, y el segundo deja la rama y la web desincronizadas.
- **Mantener el repositorio privado con GitHub Pro**: un coste mensual por lo mismo que da el repositorio público.

## Consecuencias

- La CI se ejecuta dos veces por cambio: en el PR y en el push a `preprod`, con el origen de preproducción. En un repositorio público, los minutos de los runners de GitHub no tienen límite.
- La configuración de Nginx se prueba en la CI con el mismo `dist`, con las mismas comprobaciones que hace el despliegue.
- Mientras cambia el contenedor, la web no responde uno o dos segundos y se ve la página de mantenimiento. Quien ya tiene la web en el precaché no lo nota.
- La configuración de Nginx Proxy Manager, del cortafuegos y de la VM vive en el homelab. docs/08 explica cómo se rehace, sin sus datos.
- Producción tendrá su propio ADR cuando se decida dónde va.
