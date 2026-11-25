# Despliegue

Cómo se despliegan la web, la API y PostgreSQL, cómo se vuelve atrás y cómo se hacen y se prueban las copias de la base de datos. Hay dos entornos, los dos en el homelab y con la misma forma, cada uno en su VM: la preproducción (`preprod`) y la producción (`production`). Las decisiones están en el [ADR-0026](adr/0026-preproduccion-homelab.md), el [ADR-0028](adr/0028-produccion-homelab.md), el [ADR-0040](adr/0040-despliegue-fase-6.md) y el [ADR-0044](adr/0044-despliegue-api-postgresql.md), que completan el [ADR-0011](adr/0011-ci-cd.md) y el [ADR-0012](adr/0012-entornos.md).

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

1. **`verify`**, en un runner de GitHub: la misma verificación que los PR (la acción `.github/actions/verify`), con el build compilado con el `SITE_ORIGIN` del entorno. Incluye los tests de integración de la API, con su PostgreSQL de Docker Compose ([docs/09](09-api.md) §7), y los tests de extremo a extremo. Después empaqueta:
   - la API, con `apps/api/deploy/pack.sh`: su `dist`, sus migraciones y solo sus dependencias de producción, con la estructura del monorepo, en `api.tar` (§3);
   - el catálogo, con `catalog:pack`: los ficheros de `data/` y el `catalog.json` de la última etiqueta `release/`, ya leídos, en `catalog-pack.json` ([docs/09](09-api.md) §8.3), porque la VM no tiene ni el repositorio ni su historial.

   Con todo eso ejecuta `deploy/deploy.sh` en el propio runner, con cada entorno, y después la copia y la prueba de restauración (§8), con un volumen local en lugar del NAS (`deploy/ci/compose.yaml`). Por último sube como artefacto de la ejecución la web, la referencia de los paquetes (`dist/reference/`), `api.tar` y `catalog-pack.json`.

2. **`deploy`**, en el runner propio de la VM del entorno, solo si el anterior ha pasado. Descarga ese artefacto, sin compilar nada, y ejecuta `deploy/deploy.sh` con el entorno:
   1. monta las imágenes de esa versión, con el commit en su nombre (`colorwheel-web:<commit>` y `colorwheel-api:<commit>`);
   2. arranca PostgreSQL, si no lo está o si ha cambiado su imagen. Si la nueva no arranca, vuelve a la anterior y para;
   3. aplica las migraciones con `prisma migrate deploy`, con la imagen nueva de la API. La API que sirve sigue funcionando, porque cada migración amplía y solo un despliegue posterior recorta ([docs/09](09-api.md) §6);
   4. carga el catálogo con `catalog:load --from catalog-pack.json`: sustituye el borrador y, si todavía no hay ninguna publicación, guarda la primera. Va en una transacción, así que si falla no cambia nada;
   5. arranca la web y la API candidatas junto a las que sirven, sin tráfico y solo accesibles desde la propia VM, y les pasa las comprobaciones de la web y de la API (§3);
   6. si pasan, sustituye las dos que sirven y repite las comprobaciones por el dominio público, a través del túnel y de Nginx Proxy Manager;
   7. si esa segunda comprobación falla, vuelven las dos a su versión anterior;
   8. borra las imágenes de la web y de la API salvo las cinco últimas de cada una, y la caché de montaje.

**La web y la API se despliegan y vuelven atrás juntas**: solo se sirve la pareja del mismo commit, que la CI ha probado junta. La base de datos nunca vuelve atrás. Si fallan las migraciones, la carga o las candidatas, lo que sirve no se toca.

En producción, `ci.yml` añade después **`tag-release`**, en un runner de GitHub, cuando la versión nueva ya se sirve y ha pasado las comprobaciones: crea la etiqueta de la publicación en ese commit (`release/AAAA-MM-DD`, o `.2`, `.3`… si no es la primera del día; [docs/03](03-identificadores.md) §7), que protege sus IDs. Es el único job con permiso de escritura en el repositorio, y está fuera de `deploy.yml` para que las llamadas a ese workflow no necesiten ese permiso. Si falla, la web ya está publicada sin etiqueta: hay que volver a lanzar el job.

Si algo falla, la ejecución sale en rojo y GitHub avisa por correo. Un despliegue nunca se cancela a medias: si llega otro push, espera.

## 3. La máquina de cada entorno

Todo lo que se ejecuta en la VM está en `deploy/compose.yaml`, un proyecto de Docker Compose llamado `colorwheel`, y `deploy/compose.sh` es la forma en que lo usan los scripts. Lo que es de la VM entera está en `deploy/`; la imagen de cada app, con sus comprobaciones, en `apps/<app>/deploy/`.

| Servicio   | Qué es                                                                  | Desde fuera                                   |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `web`      | El Nginx de la web, que además pasa `/api/` a la API                    | El puerto 8080, solo para Nginx Proxy Manager |
| `api`      | La API                                                                  | Nada: solo la alcanza el Nginx de la web      |
| `postgres` | PostgreSQL, con sus datos en el volumen `colorwheel_postgres-data`      | Nada: solo la alcanzan la API y las copias    |
| `backup`   | restic, con su repositorio en el NAS, solo mientras dura una copia (§8) | Solo el NAS, por NFS                          |

Las candidatas de un despliegue (`web-candidate` y `api-candidate`) y la PostgreSQL temporal de la prueba de restauración (`restore-postgres`) solo existen mientras se usan. Las candidatas tienen su propia red, donde la API candidata se llama `api`, así que el Nginx candidato es idéntico al que sirve. En la red de las que sirven se llama `api-candidate`, así que la web que sirve nunca le pasa tráfico. La web candidata escucha solo en `127.0.0.1:8081` de la VM.

**Todos los contenedores** son de solo lectura, sin capacidades, sin poder ganar privilegios y con los registros rotados. Ninguno se ejecuta como `root`. Sus imágenes están fijadas por versión y digest, y Dependabot propone las nuevas.

**La configuración de la VM** está en `/etc/colorwheel/`, fuera del repositorio:

- `colorwheel.env`: la dirección del NAS y la ruta de su exportación (`NAS_ADDRESS` y `NAS_BACKUP_PATH`), que no son secretas;
- `secrets/`: un fichero por secreto, que Compose monta en `/run/secrets/` de los contenedores que lo usan, y nunca como variable de entorno. Hoy son `postgres-password`, que leen PostgreSQL (`POSTGRES_PASSWORD_FILE`) y la API (`DATABASE_PASSWORD_FILE`), y `backup-password`, la del repositorio de las copias.

GitHub no guarda ningún secreto (§5). El usuario del runner puede leerlos, porque maneja Docker; su riesgo se acota como dice §5.

### 3.1. La web

La imagen está en `apps/web/deploy/` y es la misma para todos los entornos: Nginx sin `root`, con la configuración de `nginx.conf`, la web y la referencia de los paquetes. Lo único que cambia por entorno está en `environments/<entorno>.conf`, que el `Dockerfile` elige con el argumento `ENVIRONMENT`.

- **Rutas**: las de docs/07 §12. Cada página también sin la `/` final, sin redirigir; `/<ruta>/index.html` redirige con un 301 a `/<ruta>/`; las direcciones desconocidas y `/<idioma>/404.html` responden con el `404.html` de su idioma y el estado 404.
- **Caché**: los nombres con hash de `/assets/`, un año e `immutable`. Todo lo demás (las páginas, `sw.js`, `catalog.json`, el `manifest`), `no-cache`, para que el navegador siempre compruebe si hay versión nueva.
- **Buscadores**: en preproducción, todas las respuestas llevan `X-Robots-Tag: noindex`; en producción, solo las de la referencia y las de la API. El `robots.txt` es el del build, que permite rastrear: si lo prohibiera, los buscadores no verían la cabecera.
- **Referencia de los paquetes**: la que genera `pnpm docs:api`, en `/reference/`, sin indexar en ningún entorno. `/reference` redirige con un 301 a `/reference/`, porque sus páginas se enlazan con direcciones relativas.
- **`/api/`** pasa a la API ([docs/09](09-api.md) §2), resuelta en cada petición por el DNS de Docker: Nginx arranca sin ella, y si la API cae la web sigue sirviendo y `/api/` responde 502. Le pasa el `Host` original, que decide dónde se sirve la referencia de la API ([docs/09](09-api.md) §5), y comprime con gzip sus respuestas; Cloudflare entrega Brotli al navegador. La API decide su caché.
- **El límite de `/api/`**: 10 peticiones por segundo de media y ráfagas de 20 por visitante, y después 429. El visitante es la IP de `CF-Connecting-IP`, que Cloudflare siempre sobrescribe. Nginx la acepta de cualquier origen porque el cortafuegos de la VM solo deja llegar a Nginx Proxy Manager (§7): si esa regla cambiara, cualquiera podría elegir su IP.

`apps/web/deploy/smoke-check.sh` comprueba todo lo de la web contra cualquier servidor (`smoke-check.sh <url-base> <entorno>`), y también que cada dirección que precachea el service worker responde con el estado 200, no es el nombre de un fichero y no es de `/api/`, que nunca se guarda ([ADR-0040](adr/0040-despliegue-fase-6.md)). Si una falla, el service worker no se instala y la web no funciona sin conexión.

### 3.2. La API

La imagen está en `apps/api/deploy/` y es la misma para todos los entornos: la imagen oficial de Node en Debian _slim_, con la versión de `devEngines` (un test las mantiene iguales), y la API de `api.tar`. Ese paquete deja `domain` y `catalog-builder` en `packages/`, enlazados como en desarrollo, porque Node no ejecuta TypeScript dentro de `node_modules`. La misma imagen arranca la API, aplica las migraciones y carga el catálogo. Ocupa unos 1,2 GB, casi todo de la CLI de Prisma y de Scalar. `REFERENCE_HOSTS` es el host de la web del entorno.

`apps/api/deploy/smoke-check.sh <url-base> <host-de-la-web> [--local]` comprueba, a través del Nginx de la web: `GET /api/v1/health`; el catálogo publicado, comprimido, con su caché, sin indexar y con 304 para su `ETag`; y la referencia en el host de la web. Con `--local`, por la dirección de la VM, comprueba además que otro host no tiene referencia y que una ráfaga recibe 429; por el dominio público, esa ráfaga limitaría al propio despliegue.

La CI ejecuta las dos comprobaciones con cada build, con la imagen de cada entorno, y el despliegue, antes y después de cambiar la versión.

## 4. La página de mantenimiento

Mientras la web no responde (los segundos del cambio de contenedor, o un reinicio de la VM; con la API caída, la web sigue respondiendo), Nginx Proxy Manager sirve `apps/web/deploy/maintenance.html` con el estado 503 y `Retry-After`, para que los buscadores no la tomen por la web. No usa ficheros externos: lleva dentro el icono de la web, del que saca la rueda y el favicon, y el nombre de la web en cada idioma, y un test los mantiene iguales a los de la web. Muestra la rueda con su plantilla girando sobre los tonos, en un marco de cristal sobre un fondo de pintura que se mueve muy despacio, y sin movimiento si el sistema lo pide. Sale en el idioma de la dirección o del navegador, con el mismo criterio que la web. Cada 2 segundos pregunta, sin recargar, si la web ha vuelto, y en cuanto vuelve se funde y recarga. Quien ya tiene la web en el precaché no la ve.

Se activa sola, sin tocar nada: la entrada de Nginx Proxy Manager la entrega siempre que no consigue conectar con la web en medio segundo. Sin ese límite esperaría un minuto: con la VM apagada nadie le contesta, y el cortafuegos de Proxmox descarta el «rechazado» de la VM cuando no hay nada escuchando. Es el mismo fichero para los dos entornos. Se copia a mano a Nginx Proxy Manager, una copia por entorno, así que si cambia, hay que volver a copiar las dos (§7).

## 5. Configuración de GitHub

- **Entornos `preprod` y `production`**: cada uno solo puede desplegar su rama (`preprod` y `main`). Su variable `SITE_ORIGIN` es el origen del entorno (`https://` y el dominio, sin `/` final). No hay secretos: están en la VM (§3).
- **Las copias**: el workflow `backup.yml` se ejecuta cada noche en el runner de cada VM, y también a demanda (§8). No usa los entornos de GitHub, que solo admiten su rama: GitHub solo lanza los workflows programados desde `main`, y cada entorno usa los scripts de su propia rama.
- **Pull requests**: solo de colaboradores, y los workflows de cualquier persona de fuera necesitan aprobación. Es lo que impide que alguien ajeno ejecute código en el runner del homelab.
- **Reglas de las ramas** `preprod` y `main`: las de §1.
- **Regla de las etiquetas** `release/*`: no se pueden mover ni borrar. Crearlas sí, para que el job `tag-release` no necesite saltarse la regla.
- **Runners**: uno por entorno, en su VM, registrado en el repositorio con la etiqueta `colorwheel-<entorno>` (`colorwheel-preprod` y `colorwheel-production`), que es la que pide `deploy`. El job de producción solo se ejecuta con un push a `main`, solo lo recoge el runner de producción y el entorno `production` solo admite `main`: tres barreras para que `preprod` no despliegue en producción.

## 6. Volver atrás

- **Un despliegue que falla sus comprobaciones** no llega a servirse, o vuelve solo a la versión anterior de la web y de la API (§2). La base de datos no vuelve: por eso cada migración funciona también con la API anterior.
- **Un fallo funcional que pasa las comprobaciones** se deshace con un PR de `git revert` contra `preprod`, que pasa por la CI y se despliega como cualquier otro cambio. Si el fallo está en producción, después se lleva `preprod` a `main` con su PR, como cualquier publicación: nunca se corrige directamente en `main`. Después, un test que lo cubra. Si el fallo es de una migración, el revert no la deshace: se corrige con otra migración.
- **Una migración que falla a medias** detiene el despliegue sin tocar lo que sirve, y Prisma la deja marcada como fallida, así que las siguientes no se aplican. Se mira qué ha quedado con `prisma migrate status`, se deshace a mano lo que haya llegado a aplicarse y se marca con `prisma migrate resolve --rolled-back <migración>`. Después, el PR que la corrige. Los dos comandos se ejecutan con la imagen de la API, como en el despliegue (abajo).
- **Una emergencia sin GitHub**: en la VM del entorno, en la copia del repositorio del runner (`/home/github-runner/actions-runner/_work/rueda-cromatica/rueda-cromatica`), `docker image ls colorwheel-api` lista las últimas versiones por commit. Para servir una, con la web del mismo commit:
  ```sh
  source deploy/compose.sh
  VERSION=<commit> REFERENCE_HOSTS=<dominio-del-entorno> compose up --detach --no-deps api web
  ```
  Con la imagen de una versión se ejecuta cualquier comando de la API, como los de Prisma: `VERSION=<commit> compose run --rm --no-deps api node_modules/.bin/prisma migrate status`. La rama y lo que se sirve quedan desincronizados hasta el siguiente despliegue, así que después hay que hacer el revert igualmente.
- **Restaurar la base de datos** desde la última copia, o desde otra (`restic snapshots` las lista), también en esa carpeta. Sustituye todo lo que tenga la base de datos, así que antes se para la API:
  ```sh
  source deploy/compose.sh; environment=<entorno>; source deploy/backup/restic.sh
  compose stop api
  restic dump --host "$HOST_NAME" latest "/$DUMP" >/tmp/restore.dump
  compose exec -T postgres pg_restore --username chromatic_wheel --dbname chromatic_wheel --clean --if-exists --no-owner --exit-on-error </tmp/restore.dump
  rm /tmp/restore.dump
  VERSION=<commit-que-se-sirve> REFERENCE_HOSTS=<dominio-del-entorno> compose up --detach --no-deps api
  ```

## 7. Crear o rehacer la máquina de un entorno

Cada entorno tiene su VM. Todo lo que guarda está en el repositorio o en este documento, salvo su base de datos, que tiene sus copias en el NAS (§8): si se estropea, se rehace, se restaura la última copia y se despliega otra vez. Los pasos, sin los datos del homelab:

Los pasos están comprobados en Proxmox VE 8.4. `<entorno>` es `preprod` o `production`. `<vmid>`, `<nombre>`, `<bridge>`, `<almacenamiento>`, `<ip-vm>`, `<gateway>`, `<red-local>`, `<ip-npm>` e `<ip-nas>` son los del homelab, que no se escriben aquí.

**La VM** ([Proxmox, Cloud-Init Support](https://pve.proxmox.com/wiki/Cloud-Init_Support)), en el shell del nodo:

1. Descargar la imagen cloud de Ubuntu 26.04 y comprobarla:
   ```sh
   cd /root && wget https://cloud-images.ubuntu.com/resolute/current/resolute-server-cloudimg-amd64.img
   wget -q https://cloud-images.ubuntu.com/resolute/current/SHA256SUMS && sha256sum --check --ignore-missing SHA256SUMS
   ```
2. Crear la VM, importar la imagen como disco y prepararla para cloud-init:
   ```sh
   qm create <vmid> --name <nombre> --ostype l26 --cores 2 --memory 4096 --net0 virtio,bridge=<bridge>,firewall=1 --scsihw virtio-scsi-pci --agent enabled=1 --onboot 1
   qm set <vmid> --scsi0 <almacenamiento>:0,import-from=/root/resolute-server-cloudimg-amd64.img
   qm set <vmid> --ide2 <almacenamiento>:cloudinit
   qm set <vmid> --boot order=scsi0 --serial0 socket --vga serial0
   qm disk resize <vmid> scsi0 32G
   ```
3. En la interfaz, pestaña «Cloud-Init» de la VM: el usuario, sin contraseña, la clave SSH pública, `Upgrade packages` y la IP fija (`ip=<ip-vm>/24,gw=<gateway>`). Después, «Regenerate Image».
4. Arrancar la VM y borrar la imagen y `SHA256SUMS` de `/root`.

Una VM creada antes de la fase 6, con 2 GB, pasa a 4 GB con `qm set <vmid> --memory 4096` y un reinicio desde Proxmox (apagar y encender, no reiniciar desde dentro).

**Dentro de la VM**, por SSH:

1. El agente de Proxmox: `sudo apt-get update && sudo apt-get install -y qemu-guest-agent && sudo systemctl start qemu-guest-agent`.
2. Docker, desde su repositorio oficial ([Docker, Install on Ubuntu](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository)), con `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` y `docker-compose-plugin`.
3. El usuario del runner, sin `sudo` y en el grupo `docker`: `sudo useradd --create-home --shell /bin/bash --groups docker github-runner`.
4. El runner: en GitHub, «Settings → Actions → Runners → New self-hosted runner» (Linux, x64). Como `github-runner` (`sudo -iu github-runner`), los comandos de «Download» y el `./config.sh` de «Configure», con el nombre y la etiqueta `colorwheel-<entorno>`. Después, como servicio: `sudo bash -c 'cd /home/github-runner/actions-runner && ./svc.sh install github-runner && ./svc.sh start'`.
5. La configuración, los secretos (§3) y el cliente de NFS, para el volumen de las copias (§8). La carpeta es de `root` y del grupo `docker`, que es el del runner, y nadie más entra; los ficheros se pueden leer desde los contenedores, que ejecutan con su propio usuario:
   ```sh
   sudo install -d -m 750 -o root -g docker /etc/colorwheel /etc/colorwheel/secrets
   printf 'NAS_ADDRESS=<ip-nas>\nNAS_BACKUP_PATH=/mnt/DATA/colorwheel/<entorno>\n' | sudo tee /etc/colorwheel/colorwheel.env >/dev/null
   openssl rand -hex 32 | sudo tee /etc/colorwheel/secrets/postgres-password >/dev/null
   openssl rand -hex 32 | sudo tee /etc/colorwheel/secrets/backup-password >/dev/null
   sudo apt-get install -y nfs-common
   sudo sh -c 'chmod 644 /etc/colorwheel/colorwheel.env /etc/colorwheel/secrets/*'
   ```
   Si se rehace la VM, `backup-password` es la de siempre, la del gestor de contraseñas de Miguel: sin ella no se pueden leer las copias. Si es nueva, se guarda allí en cuanto se crea, una por entorno. `postgres-password` puede ser nueva: PostgreSQL solo la lee al crear su volumen.

**El cortafuegos** ([Proxmox, Firewall](https://pve.proxmox.com/pve-docs/chapter-pve-firewall.html)):

1. En el Datacenter, si su «Firewall» no está activado todavía: «Input Policy» en `ACCEPT` **antes** de activarlo, para no cambiar nada del servidor ni de las demás máquinas.
2. En la VM, la casilla «Firewall» de su tarjeta de red y estas reglas, con la política de entrada `DROP` y la de salida `ACCEPT`:
   ```
   IN ACCEPT -source <ip-npm> -p tcp -dport 8080 # Nginx Proxy Manager
   IN ACCEPT -source <red-local>/24 -p tcp -dport 22 # SSH from home
   OUT ACCEPT -dest <gateway> # Router (DNS)
   OUT ACCEPT -dest <ip-nas> -p tcp -dport 2049 # NAS (NFS, backups)
   OUT DROP -dest <red-local>/24 # Rest of the home network
   ```
   Las reglas se aplican en orden: la del NAS tiene que ir antes de la que corta el resto de la red. La entrada solo admite a Nginx Proxy Manager en el 8080, y de eso depende que Nginx pueda creer la IP de `CF-Connecting-IP` (§3.1).
3. Activar el cortafuegos de la VM y comprobar desde ella que llega a internet y al puerto 2049 del NAS (`timeout 3 bash -c '</dev/tcp/<ip-nas>/2049' && echo ok`), y no a otra máquina de la red, tampoco a la VM del otro entorno.

**El NAS** (TrueNAS SCALE 25.04), con el mismo patrón que los demás servicios que tienen espacio propio: un dataset por entorno, exportado por NFS solo a su VM. No se toca nada de lo que ya hay, y no se añade ningún protocolo: SMB y NFS ya están activos.

1. Comprobar, sin cambiar nada, que el servicio NFS tiene activo NFSv4 («System → Services → NFS», «Enabled Protocols»), que es el que usa la VM. Si solo tiene NFSv3, activar NFSv4 es una decisión aparte: no se hace sin comprobar antes que no afecta al servicio que ya usa NFS.
2. El usuario de las copias, una vez para los dos entornos: «Credentials → Users → Add», `colorwheel-backup`, sin contraseña, sin directorio personal y con la shell `nologin`. Sus ficheros son de ese usuario, y no puede entrar en el NAS.
3. Los datasets, una vez: en «Datasets», `DATA/colorwheel` y, dentro, uno por entorno, `DATA/colorwheel/<entorno>`, con el preset «Generic». En «Edit Permissions» de cada uno, el usuario y el grupo `colorwheel-backup`, con lectura y escritura solo para ellos.
4. La exportación de cada entorno: «Shares → Unix (NFS) Shares → Add», la ruta `/mnt/DATA/colorwheel/<entorno>`, en «Hosts» solo `<ip-vm>`, y en «Advanced Options» (abajo del formulario), «Mapall User» y «Mapall Group» `colorwheel-backup`, con los dos de «Maproot» vacíos. Así, todo lo que escribe la VM es de ese usuario, el propietario del dataset.
5. Las instantáneas, una vez: «Data Protection → Periodic Snapshot Tasks → Add», el dataset `DATA/colorwheel`, «Recursive», cada día y con una vida de 14 días. La VM no puede borrarlas, aunque restic borre copias (§8).

La primera copia crea el repositorio de restic en su dataset.

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

**Cloudflare**: la zona tiene el «Browser Cache TTL» por defecto, de 4 horas, que sustituye la cabecera `Cache-Control` de los ficheros que guarda, como `sw.js` y los iconos. Así, una versión nueva tardaría horas en llegar, y las comprobaciones del despliegue fallan. Por eso el dominio de cada entorno está en una regla de caché («Caching → Cache Rules») que respeta la cabecera del origen: el campo «Hostname» igual al dominio, «Eligible for cache», «Edge TTL» con «Use cache-control header if present, bypass cache if not» y «Browser TTL» con «Respect origin TTL». Es una sola regla para los dos dominios, unidos con `or`. No toca el túnel.

**La base de datos**, si se rehace una VM que ya tenía datos, antes del primer despliegue. Sin restaurar, el despliegue cargaría el borrador de `data/` y la primera publicación de la etiqueta, y se perderían las demás. En la VM, con una copia temporal del repositorio, que es público:

```sh
git clone --depth 1 --branch <rama-del-entorno> https://github.com/msolladev/rueda-cromatica.git /tmp/rueda-cromatica && cd /tmp/rueda-cromatica
source deploy/compose.sh
compose up --detach --wait postgres
```

Después, los pasos de «Restaurar la base de datos» de §6 sin los de la API, y `rm -rf /tmp/rueda-cromatica`.

Por último, volver a lanzar el último despliegue de la rama del entorno (`preprod` o `main`) desde la pestaña «Actions» de GitHub. En producción, la versión conserva su etiqueta: `tag-release` no crea otra para un commit que ya la tiene.

## 8. Mantenimiento y copias

- **El sistema** instala solo los parches de seguridad (`unattended-upgrades`, activado en Ubuntu).
- **El runner** se actualiza solo.
- **Las imágenes** de la web, de la API, de PostgreSQL y de restic las actualiza Dependabot con un PR. La de Node también está en `devEngines`, así que su PR necesita cambiar las dos. Las versiones mayores de PostgreSQL no las propone: necesitan migrar sus datos, y son una decisión aparte.
- **Las imágenes viejas** las borra cada despliegue (§2).

### 8.1. Las copias de la base de datos

El workflow `backup.yml` ejecuta en el runner de cada VM, con los scripts de `deploy/backup/` de la rama de su entorno:

- **Cada noche, a las 03:30 UTC**, `backup.sh`:
  1. comprueba que la copia anterior tiene como mucho 26 horas. Si no, la de hoy se hace igualmente, pero el job termina en rojo: una noche que GitHub no lanzó se detecta así a la siguiente;
  2. vuelca la base de datos con `pg_dump` a un fichero, para que un volcado fallido nunca sea una copia;
  3. la guarda con restic en su repositorio del NAS, cifrada con `backup-password`;
  4. conserva 7 copias diarias y 4 semanales, y comprueba el repositorio.
- **El día 1 de cada mes, a las 04:30 UTC**, `restore-test.sh` ([ADR-0044](adr/0044-despliegue-api-postgresql.md)):
  1. lee y verifica cada byte del repositorio (`restic check --read-data`);
  2. restaura la última copia en una PostgreSQL temporal, con sus datos en memoria;
  3. comprueba con la imagen de la API que sirve (`verify-restore`) que la última publicación restaurada es idéntica a la de la base de datos viva con el mismo `uuid`, y que el borrador restaurado genera un catálogo que se puede publicar.
- **A demanda**, desde la pestaña «Actions» de GitHub, el workflow «Backup» con la tarea y el entorno.

Si algo falla, el job sale en rojo y GitHub avisa por correo, como con los despliegues. Si el runner de una VM está apagado, el job espera 24 horas y después falla, y también avisa. GitHub desactiva los workflows programados de un repositorio público tras 60 días sin actividad, y avisa antes por correo: si llega ese correo, se vuelve a activar en «Actions».

Docker monta la exportación NFS del NAS solo mientras dura una copia. Las instantáneas diarias del NAS (§7) cubren lo que restic no puede: que alguien que entrara en la VM borrara las copias.

Queda pendiente la copia fuera de casa, la tercera de la regla 3-2-1 ([ADR-0040](adr/0040-despliegue-fase-6.md)).
