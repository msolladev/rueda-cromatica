# Despliegue

Cómo se despliega la web y cómo se vuelve atrás. Hay dos entornos, los dos en el homelab y con la misma forma, cada uno en su VM: la preproducción (`preprod`) y la producción (`production`). Las decisiones están en el [ADR-0026](adr/0026-preproduccion-homelab.md) y el [ADR-0028](adr/0028-produccion-homelab.md), que completan el [ADR-0011](adr/0011-ci-cd.md) y el [ADR-0012](adr/0012-entornos.md).

Este documento no recoge IPs, nombres de máquinas ni la configuración del homelab, porque el repositorio es público. Esos datos solo existen en el homelab.

## 1. Flujo de ramas

```
feat/x ──PR (squash)──▶ preprod ──PR (merge)──▶ main
                         │                       │
                         ▼                       ▼
                   preproducción             producción
```

- **Las ramas de trabajo** entran en `preprod` con un PR, fusionado con _squash_ y con un título que sigue Conventional Commits, que es el mensaje del commit.
- **`preprod` llega a `main`** con un PR fusionado con un commit de merge, nunca con _squash_ ni _rebase_: así las dos ramas comparten historia y el siguiente PR solo trae lo nuevo.
- **Dependabot** abre sus PR contra `preprod`.
- **Las dos ramas están protegidas**: solo cambian con un PR cuya CI ha pasado, y no admiten push forzado ni borrarse.

## 2. Qué pasa en cada push a `preprod` o a `main`

El workflow `ci.yml` llama a `deploy.yml` con el entorno de la rama: `preprod` con `preprod` y `main` con `production`. `deploy.yml` es el mismo para todos los entornos:

1. **`verify`**, en un runner de GitHub: la misma verificación que los PR (la acción `.github/actions/verify`), con el build compilado con el `SITE_ORIGIN` del entorno. Incluye los tests de extremo a extremo y las comprobaciones del servidor sobre ese mismo `dist`. Después sube como artefacto de la ejecución el `dist` y la referencia de la API (`dist/reference/`).
2. **`deploy`**, en el runner propio de la VM del entorno, solo si el anterior ha pasado. Descarga ese artefacto, sin compilar nada, y ejecuta `apps/web/deploy/deploy.sh` con el entorno:
   1. monta la imagen de esa versión, con el commit en su nombre (`colorwheel-web:<commit>`);
   2. la arranca junto a la que sirve, solo accesible desde la propia VM, y le pasa las comprobaciones (`smoke-check.sh`);
   3. si pasan, sustituye a la que sirve y repite las comprobaciones por el dominio público, a través del túnel y de Nginx Proxy Manager;
   4. si esa segunda comprobación falla, vuelve a arrancar la imagen anterior;
   5. borra las imágenes salvo las cinco últimas, y la caché de montaje.

En producción, `ci.yml` añade después **`tag-release`**, en un runner de GitHub, cuando la versión nueva ya se sirve y ha pasado las comprobaciones: crea la etiqueta de la publicación en ese commit (`release/AAAA-MM-DD`, o `.2`, `.3`… si no es la primera del día; [docs/03](03-identificadores.md) §7), que protege sus IDs. Es el único job con permiso de escritura en el repositorio, y está fuera de `deploy.yml` para que las llamadas a ese workflow no necesiten ese permiso. Si falla, la web ya está publicada sin etiqueta: hay que volver a lanzar el job.

Si algo falla, la ejecución sale en rojo y GitHub avisa por correo. Un despliegue nunca se cancela a medias: si llega otro push, espera.

## 3. El servidor

La imagen está en `apps/web/deploy/` y es la misma para todos los entornos: Nginx sin `root`, fijado por versión y digest (Dependabot propone las nuevas), con la configuración de `nginx.conf`, la web y la referencia de la API. Lo único que cambia por entorno está en `environments/<entorno>.conf`, que el `Dockerfile` elige con el argumento `ENVIRONMENT`. El contenedor es de solo lectura, sin capacidades y con los registros rotados.

- **Rutas**: las de docs/07 §12. Cada página también sin la `/` final, sin redirigir; `/<ruta>/index.html` redirige con un 301 a `/<ruta>/`; las direcciones desconocidas y `/<idioma>/404.html` responden con el `404.html` de su idioma y el estado 404.
- **Caché**: los nombres con hash de `/assets/`, un año e `immutable`. Todo lo demás (las páginas, `sw.js`, `catalog.json`, el `manifest`), `no-cache`, para que el navegador siempre compruebe si hay versión nueva.
- **Buscadores**: en preproducción, todas las respuestas llevan `X-Robots-Tag: noindex`; en producción, solo las de la referencia. El `robots.txt` es el del build, que permite rastrear: si lo prohibiera, los buscadores no verían la cabecera.
- **Referencia de la API**: la que genera `pnpm docs:api`, en `/reference/`, sin indexar en ningún entorno. `/reference` redirige con un 301 a `/reference/`, porque sus páginas se enlazan con direcciones relativas.

`smoke-check.sh` comprueba todo esto contra cualquier servidor (`smoke-check.sh <url-base> <entorno>`), y también que cada dirección que precachea el service worker responde con el estado 200 y no es el nombre de un fichero: si una falla, el service worker no se instala y la web no funciona sin conexión. La CI lo ejecuta con cada build, con la imagen de cada entorno, y el despliegue, antes y después de cambiar la versión.

## 4. La página de mantenimiento

Mientras la web no responde (los segundos del cambio de contenedor, o un reinicio de la VM), Nginx Proxy Manager sirve `apps/web/deploy/maintenance.html` con el estado 503 y `Retry-After`, para que los buscadores no la tomen por la web. No usa ficheros externos: lleva dentro el icono de la web, del que saca la rueda y el favicon, y el nombre de la web en cada idioma, y un test los mantiene iguales a los de la web. Muestra la rueda con su plantilla girando sobre los tonos, en un marco de cristal sobre un fondo de pintura que se mueve muy despacio, y sin movimiento si el sistema lo pide. Sale en el idioma de la dirección o del navegador, con el mismo criterio que la web. Cada 2 segundos pregunta, sin recargar, si la web ha vuelto, y en cuanto vuelve se funde y recarga. Quien ya tiene la web en el precaché no la ve.

Se activa sola, sin tocar nada: la entrada de Nginx Proxy Manager la entrega siempre que no consigue conectar con la web en medio segundo. Sin ese límite esperaría un minuto: con la VM apagada nadie le contesta, y el cortafuegos de Proxmox descarta el «rechazado» de la VM cuando no hay nada escuchando. Es el mismo fichero para los dos entornos. Se copia a mano a Nginx Proxy Manager, una copia por entorno, así que si cambia, hay que volver a copiar las dos (§7).

## 5. Configuración de GitHub

- **Entornos `preprod` y `production`**: cada uno solo puede desplegar su rama (`preprod` y `main`). Su variable `SITE_ORIGIN` es el origen del entorno (`https://` y el dominio, sin `/` final). No hay secretos.
- **Pull requests**: solo de colaboradores, y los workflows de cualquier persona de fuera necesitan aprobación. Es lo que impide que alguien ajeno ejecute código en el runner del homelab.
- **Reglas de las ramas** `preprod` y `main`: las de §1.
- **Regla de las etiquetas** `release/*`: no se pueden mover ni borrar. Crearlas sí, para que el job `tag-release` no necesite saltarse la regla.
- **Runners**: uno por entorno, en su VM, registrado en el repositorio con la etiqueta `colorwheel-<entorno>` (`colorwheel-preprod` y `colorwheel-production`), que es la que pide `deploy`. El job de producción solo se ejecuta con un push a `main`, solo lo recoge el runner de producción y el entorno `production` solo admite `main`: tres barreras para que `preprod` no despliegue en producción.

## 6. Volver atrás

- **Un despliegue que falla sus comprobaciones** no llega a servirse, o vuelve solo a la versión anterior (§2).
- **Un fallo funcional que pasa las comprobaciones** se deshace con un PR de `git revert` contra `preprod`, que pasa por la CI y se despliega como cualquier otro cambio. Si el fallo está en producción, después se lleva `preprod` a `main` con su PR, como cualquier publicación: nunca se corrige directamente en `main`. Después, un test que lo cubra.
- **Una emergencia sin GitHub**: en la VM del entorno, `docker image ls colorwheel-web` lista las últimas versiones por commit. Para servir una, se para la actual (`docker rm --force colorwheel-web`) y se arranca esa con las mismas opciones que usa `run` en `deploy.sh`. La rama y la web quedan desincronizadas hasta el siguiente despliegue, así que después hay que hacer el revert igualmente.

## 7. Crear o rehacer la máquina de un entorno

Cada entorno tiene su VM. No guarda nada que no esté en el repositorio o en este documento, así que no tiene copias de seguridad: si se estropea, se rehace y se despliega otra vez. Los pasos, sin los datos del homelab:

Los pasos están comprobados en Proxmox VE 8.4. `<entorno>` es `preprod` o `production`. `<vmid>`, `<nombre>`, `<bridge>`, `<almacenamiento>`, `<ip-vm>`, `<gateway>`, `<red-local>` e `<ip-npm>` son los del homelab, que no se escriben aquí.

**La VM** ([Proxmox, Cloud-Init Support](https://pve.proxmox.com/wiki/Cloud-Init_Support)), en el shell del nodo:

1. Descargar la imagen cloud de Ubuntu 26.04 y comprobarla:
   ```sh
   cd /root && wget https://cloud-images.ubuntu.com/resolute/current/resolute-server-cloudimg-amd64.img
   wget -q https://cloud-images.ubuntu.com/resolute/current/SHA256SUMS && sha256sum --check --ignore-missing SHA256SUMS
   ```
2. Crear la VM, importar la imagen como disco y prepararla para cloud-init:
   ```sh
   qm create <vmid> --name <nombre> --ostype l26 --cores 2 --memory 2048 --net0 virtio,bridge=<bridge>,firewall=1 --scsihw virtio-scsi-pci --agent enabled=1 --onboot 1
   qm set <vmid> --scsi0 <almacenamiento>:0,import-from=/root/resolute-server-cloudimg-amd64.img
   qm set <vmid> --ide2 <almacenamiento>:cloudinit
   qm set <vmid> --boot order=scsi0 --serial0 socket --vga serial0
   qm disk resize <vmid> scsi0 32G
   ```
3. En la interfaz, pestaña «Cloud-Init» de la VM: el usuario, sin contraseña, la clave SSH pública, `Upgrade packages` y la IP fija (`ip=<ip-vm>/24,gw=<gateway>`). Después, «Regenerate Image».
4. Arrancar la VM y borrar la imagen y `SHA256SUMS` de `/root`.

**Dentro de la VM**, por SSH:

1. El agente de Proxmox: `sudo apt-get update && sudo apt-get install -y qemu-guest-agent && sudo systemctl start qemu-guest-agent`.
2. Docker, desde su repositorio oficial ([Docker, Install on Ubuntu](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository)), con `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` y `docker-compose-plugin`.
3. El usuario del runner, sin `sudo` y en el grupo `docker`: `sudo useradd --create-home --shell /bin/bash --groups docker github-runner`.
4. El runner: en GitHub, «Settings → Actions → Runners → New self-hosted runner» (Linux, x64). Como `github-runner` (`sudo -iu github-runner`), los comandos de «Download» y el `./config.sh` de «Configure», con el nombre y la etiqueta `colorwheel-<entorno>`. Después, como servicio: `sudo bash -c 'cd /home/github-runner/actions-runner && ./svc.sh install github-runner && ./svc.sh start'`.

**El cortafuegos** ([Proxmox, Firewall](https://pve.proxmox.com/pve-docs/chapter-pve-firewall.html)):

1. En el Datacenter, si su «Firewall» no está activado todavía: «Input Policy» en `ACCEPT` **antes** de activarlo, para no cambiar nada del servidor ni de las demás máquinas.
2. En la VM, la casilla «Firewall» de su tarjeta de red y estas reglas, con la política de entrada `DROP` y la de salida `ACCEPT`:
   ```
   IN ACCEPT -source <ip-npm> -p tcp -dport 8080 # Nginx Proxy Manager
   IN ACCEPT -source <red-local>/24 -p tcp -dport 22 # SSH from home
   OUT ACCEPT -dest <gateway> # Router (DNS)
   OUT DROP -dest <red-local>/24 # Rest of the home network
   ```
3. Activar el cortafuegos de la VM y comprobar desde ella que llega a internet y no a otra máquina de la red, tampoco a la VM del otro entorno.

**Nginx Proxy Manager**:

1. La página de mantenimiento, en su consola: `mkdir -p /data/maintenance && curl -fsSL https://raw.githubusercontent.com/msolladev/rueda-cromatica/<commit>/apps/web/deploy/maintenance.html -o /data/maintenance/colorwheel-<entorno>.html`.
2. La entrada: el dominio del entorno, `http` a `<ip-vm>:8080`, «Cache Assets» apagado (si no, guardaría el service worker), «Block Common Exploits» encendido, su certificado con HTTP/2 y sin «Force SSL». En «Advanced»:
   ```nginx
   proxy_connect_timeout 500ms;
   # Maintenance page while the web does not answer (rueda-cromatica, docs/08).
   error_page 502 504 =503 /__maintenance.html;
   location = /__maintenance.html {
       internal;
       alias /data/maintenance/colorwheel-<entorno>.html;
       default_type text/html;
       add_header Retry-After 10 always;
       add_header Cache-Control "no-store" always;
       add_header X-Robots-Tag "noindex" always;
   }
   ```

Por último, volver a lanzar el último despliegue de la rama del entorno (`preprod` o `main`) desde la pestaña «Actions» de GitHub. En producción, la versión conserva su etiqueta: `tag-release` no crea otra para un commit que ya la tiene.

## 8. Mantenimiento

- **El sistema** instala solo los parches de seguridad (`unattended-upgrades`, activado en Ubuntu).
- **El runner** se actualiza solo.
- **La imagen de Nginx** la actualiza Dependabot con un PR.
- **Las imágenes viejas** las borra cada despliegue (§2).
