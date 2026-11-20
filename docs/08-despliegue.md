# Despliegue

Cómo se despliega la web y cómo se vuelve atrás. Por ahora solo existe la preproducción, en el homelab. Producción está por decidir. Las decisiones están en el [ADR-0026](adr/0026-preproduccion-homelab.md), que completa el [ADR-0011](adr/0011-ci-cd.md) y el [ADR-0012](adr/0012-entornos.md).

Este documento no recoge IPs, nombres de máquinas ni la configuración del homelab, porque el repositorio es público. Esos datos solo existen en el homelab.

## 1. Flujo de ramas

```
feat/x ──PR (squash)──▶ preprod ──PR (merge)──▶ main
                         │                       │
                         ▼                       ▼
                   preproducción            producción (futuro)
```

- **Las ramas de trabajo** entran en `preprod` con un PR, fusionado con _squash_ y con un título que sigue Conventional Commits, que es el mensaje del commit.
- **`preprod` llega a `main`** con un PR fusionado con un commit de merge, nunca con _squash_ ni _rebase_: así las dos ramas comparten historia y el siguiente PR solo trae lo nuevo.
- **Dependabot** abre sus PR contra `preprod`.
- **Las dos ramas están protegidas**: solo cambian con un PR cuya CI ha pasado, y no admiten push forzado ni borrarse.

## 2. Qué pasa en cada push a `preprod`

Lo hace el workflow `ci.yml`:

1. **`ci-preprod`**, en un runner de GitHub: la misma verificación que los PR (la acción `.github/actions/verify`), con el build compilado con el `SITE_ORIGIN` del entorno `preprod`. Incluye los tests de extremo a extremo y las comprobaciones del servidor de preproducción sobre ese mismo `dist`, que después sube como artefacto de la ejecución.
2. **`deploy-preprod`**, en el runner propio de la VM de preproducción, solo si el anterior ha pasado. Descarga ese `dist`, sin compilar nada, y ejecuta `apps/web/deploy/preprod/deploy.sh`:
   1. monta la imagen de esa versión, con el commit en su nombre (`colorwheel-web:<commit>`);
   2. la arranca junto a la que sirve, solo accesible desde la propia VM, y le pasa las comprobaciones (`smoke-check.sh`);
   3. si pasan, sustituye a la que sirve y repite las comprobaciones por el dominio público, a través del túnel y de Nginx Proxy Manager;
   4. si esa segunda comprobación falla, vuelve a arrancar la imagen anterior;
   5. borra las imágenes salvo las cinco últimas, y la caché de montaje.

Si algo falla, la ejecución sale en rojo y GitHub avisa por correo. Un despliegue nunca se cancela a medias: si llega otro push, espera.

## 3. El servidor

La imagen está en `apps/web/deploy/preprod/`: Nginx sin `root`, fijado por versión y digest (Dependabot propone las nuevas), con la configuración de `nginx.conf`. El contenedor es de solo lectura, sin capacidades y con los registros rotados.

- **Rutas**: las de docs/07 §12. Cada página también sin la `/` final, sin redirigir; `/<ruta>/index.html` redirige con un 301 a `/<ruta>/`; las direcciones desconocidas y `/<idioma>/404.html` responden con el `404.html` de su idioma y el estado 404.
- **Caché**: los nombres con hash de `/assets/`, un año e `immutable`. Todo lo demás (las páginas, `sw.js`, `catalog.json`, el `manifest`), `no-cache`, para que el navegador siempre compruebe si hay versión nueva.
- **Buscadores**: todas las respuestas llevan `X-Robots-Tag: noindex`. El `robots.txt` es el del build: si prohibiera rastrear, los buscadores no verían la cabecera.

`smoke-check.sh` comprueba todo esto contra cualquier servidor (`smoke-check.sh <url-base>`): la CI lo ejecuta con cada build y el despliegue, antes y después de cambiar la versión.

## 4. La página de mantenimiento

Mientras la web no responde (los segundos del cambio de contenedor, o un reinicio de la VM), Nginx Proxy Manager sirve `apps/web/deploy/preprod/maintenance.html` con el estado 503 y `Retry-After`, para que los buscadores no la tomen por la web. No usa ficheros externos, sale en el idioma de la dirección o del navegador y se recarga sola cada 10 segundos. Quien ya tiene la web en el precaché no la ve.

Se activa sola, sin tocar nada: la entrada de Nginx Proxy Manager la entrega siempre que la web no contesta. El fichero se copia a mano a Nginx Proxy Manager, así que si cambia, hay que volver a copiarlo (§7).

## 5. Configuración de GitHub

- **Entorno `preprod`**: solo puede desplegar la rama `preprod`. Su variable `SITE_ORIGIN` es el origen de la preproducción (`https://` y el dominio, sin `/` final). No hay secretos.
- **Pull requests**: solo de colaboradores, y los workflows de cualquier persona de fuera necesitan aprobación. Es lo que impide que alguien ajeno ejecute código en el runner del homelab.
- **Reglas de las ramas** `preprod` y `main`: las de §1.
- **Runner**: registrado en el repositorio con la etiqueta `colorwheel-preprod`, que es la que pide `deploy-preprod`.

## 6. Volver atrás

- **Un despliegue que falla sus comprobaciones** no llega a servirse, o vuelve solo a la versión anterior (§2).
- **Un fallo funcional que pasa las comprobaciones** se deshace con un PR de `git revert` contra `preprod`, que pasa por la CI y se despliega como cualquier otro cambio. Después, un test que lo cubra.
- **Una emergencia sin GitHub**: en la VM, `docker image ls colorwheel-web` lista las últimas versiones por commit. Para servir una, se para la actual (`docker rm --force colorwheel-web`) y se arranca esa con las mismas opciones que usa `run` en `deploy.sh`. La rama y la web quedan desincronizadas hasta el siguiente despliegue, así que después hay que hacer el revert igualmente.

## 7. Rehacer la máquina

La VM no guarda nada que no esté en el repositorio o en este documento, así que no tiene copias de seguridad: si se estropea, se rehace y se despliega otra vez. Los pasos, sin los datos del homelab:

<!-- Se completa al montar la máquina, con los pasos comprobados. -->

## 8. Mantenimiento

- **El sistema** instala solo los parches de seguridad (`unattended-upgrades`, activado en Ubuntu).
- **El runner** se actualiza solo.
- **La imagen de Nginx** la actualiza Dependabot con un PR.
- **Las imágenes viejas** las borra cada despliegue (§2).
