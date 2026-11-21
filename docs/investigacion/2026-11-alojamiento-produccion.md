# Alojamiento de producción

> **Documento de investigación, no especificación.** Recoge lo que dice la documentación oficial de cada proveedor a fecha de **2026-11-21**. No se edita: si la investigación se repite, se escribe un informe nuevo con otra fecha. La decisión que se derive va en `docs/adr/`.
>
> Los datos marcados como **no verificado** no deben usarse sin comprobarlos antes.

Busca dónde servir la web en producción, en `colorwheel.msolla.dev`, con las mismas respuestas que da la preproducción ([docs/07](../07-web.md) §12, [docs/08](../08-despliegue.md) §3). Es el punto «Decidir dónde va producción» de los pendientes de CLAUDE.md. Como la elección tiene que servir también para la fase 6, con la API, la administración y la base de datos ([ADR-0017](../adr/0017-arquitectura-objetivo-backend.md)), evalúa además dónde podría ir todo junto (§6), y recoge el riesgo de los bloqueos de IP que LaLiga ordena en España durante los partidos (§5).

## 1. Conclusiones

- **Elección: el homelab** (§7). Es la única opción gratuita que sirve hoy la web con las reglas de docs/07 §12 y que admite después, en el mismo sitio y con la misma forma, la API, la administración y PostgreSQL. A cambio, depende de la conexión y la luz de casa, y el túnel de Cloudflare la expone a los bloqueos de LaLiga.
- **Para la web sola** hay alojamientos estáticos gratuitos que cumplen casi todo (§3, §4), pero ninguno admite después la fase 6 en el mismo sitio: habría que repartir la web, la administración y la API entre proveedores, o mudarse.
- **Para todo en un sitio** (§6), ningún proveedor gratuito cumple los criterios de Miguel: o piden tarjeta, o duermen el servidor más de 1 s, o no admiten dominio propio, o no tienen PostgreSQL gratuito, o no publican su DPA. El que más se acercaba, Northflank, pide tarjeta al crear un servicio y en el plan gratuito solo ofrece EE. UU. y Londres, según la prueba de Miguel.
- **Los bloqueos de LaLiga** (§5) afectan sobre todo a las IP compartidas de Cloudflare, y por tanto a Cloudflare Workers y al túnel del homelab, hasta que venza la sentencia, el 20-06-2027. Quien tiene la PWA instalada sigue usándola sin conexión.

## 2. Datos de partida

- **DNS**: Miguel confirma que el dominio `msolla.dev` está registrado en Cloudflare y su zona DNS está allí. Hasta ahora no se ha configurado nada en ella a mano: los subdominios del homelab llegan por el túnel de Cloudflare (`cloudflared` en Proxmox) a Nginx Proxy Manager. **No verificado**: si el túnel usa un registro comodín (`*.msolla.dev`) o uno por subdominio. Importa para Cloudflare Workers, que no crea un dominio propio sobre un nombre que ya tiene un CNAME (§4.1).
- **Tamaño de la web**: el `dist` de `0a3731c` tiene 66 ficheros y 3,8 MB, unos 0,58 MB comprimidos con gzip. El service worker precachea casi todo, así que la primera visita descarga del orden de 0,6 MB y las siguientes solo lo que cambia. 10 GB al mes dan para unas 17 000 primeras visitas.
- **Requisitos**, los del encargo:
  1. Cada página también sin la `/` final, con el estado 200 y sin redirigir.
  2. `/<ruta>/index.html` redirige con un 301 a `/<ruta>/`.
  3. Una dirección desconocida responde con el `404.html` de su idioma (`dist/<idioma>/404.html`) si empieza por un idioma, y con `dist/404.html` si no, con el estado 404.
  4. Cabeceras de caché por ruta, como en preproducción.
  5. Dominio propio (`colorwheel.msolla.dev`) con HTTPS.
  6. Despliegue desde GitHub Actions con cada push a `main`, subiendo el `dist` que compiló la CI, y forma de volver a la versión anterior.
  7. Gratuito para el tráfico de un proyecto personal.
- **Criterios para la fase 6**, que Miguel fija en esta investigación:
  - gratis y sin tarjeta, sin ningún plan de pago;
  - siempre encendido, o que despierte en 1 s como máximo;
  - RGPD obligatorio: los datos en la UE o en un país con decisión de adecuación de la Comisión (art. 45), y un DPA del proveedor como encargado del tratamiento (art. 28);
  - evitar las IP de Cloudflare en lo posible, sin que sea eliminatorio;
  - todo en un sitio, por simplicidad, que en un monorepo es lo natural.

## 3. Tabla de requisitos

Cumple (**sí**), no cumple (**no**) o la documentación no lo aclara (**?**). Las fuentes están numeradas en §8.

| Requisito                | Cloudflare Workers                                                 | statichost.eu                                   | Homelab                  | Vercel                                                     | Cloudflare Pages                 | Netlify                                                | GitHub Pages               | Firebase Hosting                    | Render                                   |
| ------------------------ | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------ | ---------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ | -------------------------- | ----------------------------------- | ---------------------------------------- |
| 1. Sin `/` final, 200    | **no** sin Worker; **sí** con Worker [C2, C5]                      | **?** [S2]                                      | **sí** [H1]              | **sí** [V1]                                                | **?** [P1]                       | **no**: redirige [N1]                                  | **?**                      | **?** [F1]                          | **?**                                    |
| 2. `index.html` → 301    | **no** sin Worker (307); **sí** con Worker o `_redirects` [C2, C4] | **?**: solo con una regla forzada (`301!`) [S2] | **sí** [H1]              | **sí**, con `statusCode: 301`; **?** sobre un fichero [V1] | **?**: redirige, sin estado [P1] | **?**: redirige, sin estado [N2]                       | **?**                      | **?** [F1]                          | **no**: no aplica reglas a ficheros [R1] |
| 3. 404 por idioma        | **sí**: el `404.html` más cercano [C3]                             | **sí**: `/es/* /es/404.html 404` [S2]           | **sí** [H1]              | **?** [V2]                                                 | **sí** [P1]                      | **sí**: `/es/* /es/404.html 404` [N3]                  | **no**: uno solo [G1]      | **no**: uno solo [F2]               | **no**: la reescritura no da 404 [R1]    |
| 4. Caché por ruta        | **sí**: `_headers`, o el Worker [C4]                               | **sí**: `_headers` [S3]                         | **sí** [H1]              | **sí** [V1]                                                | **sí** [P2]                      | **sí** [N4]                                            | **no** [G2]                | **sí** [F1]                         | **sí**, solo en el panel [R2]            |
| 5. Dominio propio, HTTPS | **sí**: la zona está en Cloudflare [C6]                            | **sí**: CNAME [S4]                              | **sí**: túnel y NPM [H2] | **sí**: CNAME, sin proxy [V3]                              | **sí** [P3]                      | **sí**: CNAME; HTTPS **?** [N5]                        | **sí** [G3]                | **sí**: registro A [F3]             | **sí** [R3]                              |
| 6. Subir `dist`, volver  | **sí**: `wrangler deploy`, 100 versiones [C7, C8]                  | Subir **sí** [S5]; volver **?** [S1]            | **sí** [H3]              | **sí**; volver solo un paso [V4]                           | **sí** [P4]                      | **sí** [N6]                                            | **sí**; volver **?** [G4]  | **sí** [F4]                         | **no**: compila desde git [R4]           |
| 7. Gratuito              | **sí**: los ficheros, sin límite; el Worker, 100 000 al día [C9]   | **sí**: 1 sitio, 10 GB al mes [S1]              | **sí**                   | **sí**: 100 GB al mes; uso comercial **?** [V5]            | **sí** [P5]                      | **sí**, pero 300 créditos; ~20 despliegues al mes [N7] | **sí**: 100 GB al mes [G5] | **sí**; tráfico contradictorio [F5] | **?** [R5]                               |

## 4. Los alojamientos estáticos que mejor cumplen

### 4.1 Cloudflare Workers con _static assets_

Un Worker sin código sirve los ficheros de `dist` gratis y sin límite de peticiones [C9]. Con `not_found_handling: "404-page"`, una dirección desconocida recibe el `404.html` más cercano con el estado 404, que es justo el requisito 3 [C3]. Pero ningún modo de `html_handling` responde con un 200 tanto a `/es` como a `/es/`: el predeterminado redirige `/es` con un 307, y `/es/index.html` también con un 307 [C2]. Por eso hace falta un Worker pequeño que atienda las páginas antes que los ficheros (`run_worker_first`): sirve `/<ruta>/index.html` para `/<ruta>`, redirige con un 301 `/<ruta>/index.html` y deja todo lo demás a `env.ASSETS.fetch`, que aplica el 404 por idioma [C5].

- **Ventajas**:
  - Todos los requisitos se cumplen de forma documentada, y las respuestas las decide código del repositorio, probado en la CI con `smoke-check.sh`, igual que hoy `nginx.conf`.
  - La zona DNS ya está en Cloudflare: el dominio propio y su certificado los crea el despliegue, sin registros externos [C6].
  - `wrangler-action` despliega desde GitHub Actions, y `wrangler rollback` vuelve a cualquiera de las 100 últimas versiones [C7, C8].
  - Es el candidato del [ADR-0012](../adr/0012-entornos.md), y la red de Cloudflare sirve desde cerca de cualquier usuario.
- **Desventajas**:
  - Un fichero de código más que mantener y probar (el Worker), con su configuración de `wrangler`.
  - Las peticiones que pasan por el Worker cuentan para el límite de 100 000 al día del plan gratuito, y al superarlo responden 429 en lugar de servir la web [C9]. Solo pasan las páginas: los ficheros de `/assets/` no.
  - `_headers` no se aplica a las respuestas que genera el Worker, así que el Worker tiene que poner sus propias cabeceras de caché [C4].
  - **No verificado**: si el comodín del túnel, si existe, impide crear el dominio propio [C6]. Si `colorwheel.msolla.dev` tuviera ya un CNAME, habría que borrarlo antes.
  - La versión sigue a medias durante un despliegue: «Pages loaded before rollback can still request the newer version's assets» [C8]. Con el precaché de Workbox, que pide sus ficheros con el hash de la revisión, **no verificado** si afecta.

### 4.2 statichost.eu

Un proveedor sueco pequeño, con toda su infraestructura en Europa [S6]. Admite `_redirects` y `_headers` al estilo de Netlify, y subir un zip ya compilado con su script `shcli`, sin compilar en su lado [S2, S3, S5].

- **Ventajas**:
  - El 404 por idioma y las cabeceras por ruta, con una sintaxis documentada y sin código [S2, S3].
  - Infraestructura europea e independiente, sin depender de un proveedor estadounidense [S6].
  - Nada que programar: dos ficheros de texto en `dist`.
- **Desventajas**:
  - La documentación no dice qué responde a `/es`, y las reglas no se aplican a los ficheros que existen («Actual static files are always matched first»), así que el 1 y el 2 solo se sabrán con un despliegue de prueba [S2]. El 301 de `index.html` necesitaría una regla forzada (`/es/index.html /es/ 301!`), sin garantía de que no entre en bucle.
  - El plan gratuito anuncia «Instant rollbacks», pero no explica cómo, ni si vale para las subidas directas [S1].
  - 10 GB de tráfico al mes y un único sitio, sin decir qué pasa al superarlo [S1]. Con un solo sitio no cabe la administración de la fase 6, y la API no puede ir allí.
  - La documentación no menciona GitHub Actions: la subida desde la CI es el mismo `shcli` con una clave de API como secreto [S5].
  - Un proveedor muy pequeño, con más riesgo de que cambie o cierre.

### 4.3 El homelab

Una segunda VM, o la misma, con la imagen de Nginx de preproducción sin `X-Robots-Tag: noindex`, detrás del túnel y de Nginx Proxy Manager.

- **Ventajas**:
  - Cumple todo por construcción, con la configuración y las comprobaciones que ya funcionan [H1, H3].
  - Ninguna cuenta ni proveedor nuevo, y nada nuevo que aprender.
- **Desventajas**:
  - La web pública depende de la conexión y de la luz de casa, y de que la VM y Proxmox estén levantados. La página de mantenimiento cubre los cortes de la VM, pero no los de la conexión.
  - Toda la carga y cualquier ataque llegan a la red de casa, aunque pasen por el túnel.
  - El [ADR-0012](../adr/0012-entornos.md) eligió un entorno propio para la preproducción «para aprender el despliegue completo»; la producción no aporta nada nuevo que aprender.

### 4.4 Vercel, solo si las otras fallan

Cumple el 1, el 2, el 4 y el 5 según su documentación [V1, V3], pero no documenta ninguna forma de servir un `404.html` distinto por carpeta en una web estática [V2]. En el plan gratuito solo se vuelve a la versión inmediatamente anterior [V4], y exige reorganizar `dist` en `.vercel/output` [V4]. **No verificado**: si su plan gratuito admite cualquier uso o solo el no comercial [V5].

## 5. Riesgo: los bloqueos de LaLiga

- **Qué pasa**: una sentencia del Juzgado Mercantil n.º 6 de Barcelona (18-12-2024) permite a LaLiga ordenar a Movistar, MásOrange, Vodafone y DIGI que bloqueen direcciones IP durante los partidos [L1, L3]. El bloqueo es por IP, así que cae cualquier web que comparta la IP bloqueada.
- **Sigue en la temporada 2026/27**: el 15-08-2026 se bloquearon unas 550 IP a la vez, y desde entonces en cada jornada, desde poco antes del partido hasta el final de la retransmisión; en los casos medidos, de 3 a 6 horas, también entre semana [L1, L2]. No se ha encontrado ninguna fuente de octubre o noviembre de 2026.
- **Cloudflare es el más afectado**: según OONI, de enero a junio de 2026, con el 30 % de las IP bloqueadas acumuló el 90 % de los dominios afectados, más de 501 000 [L1]. Cloudflare no colabora con LaLiga y critica los bloqueos [L4]; Twitch, Scaleway y Gcore tienen acuerdos con LaLiga, y Vercel colabora con ella, según una fuente de 2025 [L5]. Los bloqueos han alcanzado a 36 proveedores, también AWS, Akamai, Microsoft y GitHub Pages [L1, L6].
- **Hasta cuándo**: la sentencia cubre hasta el 20-06-2027 [L1]. La proposición no de ley que aprobó el Congreso el 29-04-2026 no obliga a nada, y el amparo de Cloudflare y RootedCON ante el Tribunal Constitucional no tiene resolución pública [L3, L6].
- **A qué alternativas afecta**:
  - **Cloudflare Workers**: ninguna fuente nombra Workers, Pages ni el túnel, pero un dominio propio de Workers se sirve desde las IP compartidas de Cloudflare. **No verificado**, pero lo más probable es que caiga igual. Una IP distinta «no garantiza que el problema desaparezca» [L3].
  - **Homelab**: se publica por el túnel de Cloudflare, con IP de Cloudflare: el mismo riesgo. Afecta también a la preproducción actual.
  - **statichost.eu**: infraestructura propia y europea, sin Cloudflare [S6], y sin ningún caso de bloqueo encontrado. Ningún proveedor está a salvo del todo [L1]. Su registro en la zona de Cloudflare tendría que ser «DNS only», sin el proxy: con el proxy, la web se serviría desde IP de Cloudflare.
- **Qué notaría quien usa la web**: la PWA instalada sigue funcionando sin conexión, desde el precaché. Fallan las visitas nuevas desde España durante los partidos y las actualizaciones de la web. Google rastrea desde fuera de España, así que el SEO no debería notarlo (**no verificado**).

## 6. Todo en un sitio, pensando en la fase 6

**La forma que se busca**: un único origen y un único despliegue, como la preproducción. Un Nginx sirve la web en `/` y, en la fase 6, la administración en `/admin/` (también estática) y reenvía `/api/` al servicio de la API, con PostgreSQL al lado. Son dos servicios y una base de datos, sin CORS y con las cookies de sesión del mismo origen. Las aplicaciones siguen separadas en el código, como pide el [ADR-0017](../adr/0017-arquitectura-objetivo-backend.md). Lo previsto en la hoja de ruta cabe en esa forma: la página por pintura se prerenderiza volviendo a compilar la web cuando cambia el catálogo, y las tareas periódicas son trabajos puntuales, no servicios.

| Proveedor               | Sin tarjeta                                                   | Arranque ≤ 1 s                                           | RGPD                                                        | Lo que lo descarta                                                                   |
| ----------------------- | ------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Northflank (Sandbox)    | **no**: la pide al crear un servicio (prueba de Miguel) [NF1] | **sí**: siempre encendido [NF1]                          | **?**: Londres por adecuación [UE1]; DPA no publicado [NF2] | Tarjeta; solo EE. UU. y Londres en el plan gratuito (prueba de Miguel)               |
| HostStack               | **sí** [HS1]                                                  | **?**: duerme a los 60 min, sin tiempo documentado [HS2] | **sí**: Helsinki, DPA [HS3]                                 | Un solo servicio gratuito; arranque sin medir; lo lleva una persona desde 2026 [HS4] |
| Cloudflare Workers + D1 | **?** [C9]                                                    | **sí** [CW1]                                             | **sí**: DPA y D1 en la UE [CW2, CW3]                        | IP de Cloudflare (§5); D1 en lugar de PostgreSQL; 10 ms de CPU por petición [CW1]    |
| Koyeb                   | **no** [K1]                                                   | **no**: 1-5 s [K2]                                       | DPA [K3]                                                    | Tarjeta                                                                              |
| Render                  | **sí** [R5]                                                   | **no**: «about one minute» [R6]                          | **?**                                                       | Arranque; PostgreSQL gratuito caduca a los 30 días [R6]                              |
| Fly.io                  | **no** [FL1]                                                  | **no**: «about 2 seconds or more» [FL2]                  | Datos en EE. UU. [FL3]                                      | Sin plan gratuito                                                                    |
| Railway                 | **sí** [RW1]                                                  | **?** [RW2]                                              | Sin elegir región en el plan gratuito [RW1]                 | Sin dominio propio en el plan gratuito [RW1]                                         |
| alwaysdata              | **?**                                                         | **?** [AD1]                                              | **sí**: Francia [AD2]                                       | Sin dominio propio en el plan gratuito; sin Docker [AD1]                             |
| Clever Cloud            | **sí**, solo créditos de prueba [CC1]                         | **?**                                                    | **sí**: Francia, DPA [CC2]                                  | Sin plan gratuito permanente                                                         |
| Deno Deploy             | **?**                                                         | **sí** [DD1]                                             | **no**: EE. UU. [DD2]                                       | Cierra en abril de 2027; sin monorepos [DD1]                                         |
| Supabase                | **?**                                                         | **?**                                                    | **sí**: Fráncfort, DPA [SB1]                                | Sin dominio propio en el plan gratuito; pausa tras 1 semana sin uso [SB1]            |
| Appwrite                | **?**                                                         | **?**                                                    | DPA [AW1]                                                   | PostgreSQL de pago [AW1]                                                             |

Descartados también: Neon (solo base de datos, sin alojar webs [NE1]), Wasmer Edge (sin Node real), Leapcell (sin región europea documentada), Back4app (solo EE. UU.), Zeabur (sin cómputo gratuito), Scalingo, Sevalla, Hidora y Hostim (solo pruebas), y Azure e IBM (tarjeta) [OT1].

## 7. Elección

Miguel elige **el homelab**: la producción con la misma forma que la preproducción, en una VM propia, publicada por el túnel de Cloudflare y Nginx Proxy Manager, como el resto de servicios del homelab.

- **Por qué**: cumple los siete requisitos de la web por construcción [H1, H3] y admite la fase 6 en el mismo sitio (§6), gratis, con los datos en casa y sin un proveedor más. La configuración del servidor es una sola, la de preproducción, y preproducción prueba exactamente lo que sirve producción.
- **Lo que se acepta**:
  - La disponibilidad depende de la conexión, la luz y el servidor de casa.
  - Los bloqueos de LaLiga alcanzan a las IP de Cloudflare que publica el túnel (§5), al menos hasta el 20-06-2027.
- **Queda para la sesión de configuración**: el ADR con esta elección y el resto de decisiones de producción, la máquina, el workflow de `main`, la etiqueta `release/` y TypeDoc. CLAUDE.md recomienda statichost.eu en «Pendiente fuera de la hoja de ruta»: hay que actualizarlo.

## 8. Fuentes

Leídas el 2026-11-21, salvo las pruebas de Miguel, hechas el mismo día con su cuenta. Las de los bloqueos de LaLiga son prensa y una web independiente, no documentación oficial. Las de Firebase, Render, Vercel, Netlify y GitHub se resumen: las citas literales son cortas.

**Bloqueos de LaLiga**

- [L1] Euronews, [«In Spain, football matches knock thousands of websites and services offline»](https://www.euronews.com/2026/09/18/in-spain-football-matches-knock-thousands-of-websites-and-services-offline), 18-09-2026: «Since then, the blocks have continued every matchday»; los datos de OONI y el vencimiento de la sentencia, el 20-06-2027.
- [L2] Ecosistema Startup, [«LaLiga bloquea 550 IPs en 2026»](https://ecosistemastartup.com/laliga-bloquea-550-ips-en-2026-como-afecta-a-startups-en-cloudflare/), 17-08-2026.
- [L3] [¿Hay ahora fútbol?](https://hayahora.futbol/), sin fecha: la sentencia (n.º 310/2024), los operadores y el amparo. Su lista en vivo no se pudo leer.
- [L4] Cloudflare, [«Innovating to address streaming abuse — and our latest transparency report»](https://blog.cloudflare.com/h1-2025-transparency-report/), 19-12-2025, actualizado el 15-07-2026.
- [L5] Xataka Móvil, [acuerdos de LaLiga con Vercel, Twitch, Scaleway y Gcore](https://www.xatakamovil.com/streaming/estar-bloqueadas-a-colaborar-asi-ha-logrado-laliga-que-vercel-twitch-scaleway-no-sigan-pasos-cloudflare), 09-05-2025.
- [L6] Tech Times, [«Spain's Parliament Votes to Rein In LaLiga's Mass IP Blockades»](https://www.techtimes.com/articles/316733/20260516/spains-parliament-votes-rein-laligas-mass-ip-blockades-test-case-eu-internet-governance.htm), 16-05-2026.

**Cloudflare Workers** (developers.cloudflare.com)

- [C1] [Static Assets](https://developers.cloudflare.com/workers/static-assets/).
- [C2] [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/): en `auto-trailing-slash`, «/folder | 307 to /folder/»; en `drop-trailing-slash`, «/folder/ | 307 to /folder». Ningún modo da 200 a las dos.
- [C3] [Static Site Generation and custom 404 pages](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/): «Workers will serve the contents of the nearest `404.html` file with a `404 Not Found` status».
- [C4] [Headers](https://developers.cloudflare.com/workers/static-assets/headers/): «Custom headers defined in the `_headers` file are not applied to responses generated by your Worker code». [Redirects](https://developers.cloudflare.com/workers/static-assets/redirects/): redirecciones 301, 302, 303, 307 y 308, y «Redirects are always followed, regardless of whether or not an asset matches the incoming request».
- [C5] [Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/): `run_worker_first`, y las peticiones con `env.ASSETS.fetch` «have `html_handling` and `not_found_handling` configuration applied to them».
- [C6] [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/): exige «An active Cloudflare zone»; «You cannot create a Custom Domain on a hostname with an existing CNAME DNS record»; el certificado se genera solo.
- [C7] [GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/): `cloudflare/wrangler-action`, que ejecuta `wrangler deploy`.
- [C8] [Rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/): «You can only roll back to the 100 most recent versions».
- [C9] [Pricing](https://developers.cloudflare.com/workers/platform/pricing/): «Requests to static assets are free and unlimited»; 100 000 peticiones al día al Worker en el plan gratuito. [Billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): al superarlas, «these requests will receive a 429». [Limits](https://developers.cloudflare.com/workers/platform/limits/): 20 000 ficheros por versión y 25 MiB por fichero.

**Cloudflare Pages** (developers.cloudflare.com)

- [P1] [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/): «`/about/index.html` will be redirected to `/about/`», sin estado; busca el 404 más cercano subiendo por las carpetas.
- [P2] [Headers](https://developers.cloudflare.com/pages/configuration/headers/).
- [P3] [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
- [P4] [Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) y [Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).
- [P5] [Limits](https://developers.cloudflare.com/pages/platform/limits/). La [portada de Pages](https://developers.cloudflare.com/pages/) dice «Start new projects with Workers».

**statichost.eu** (www.statichost.eu)

- [S1] [Pricing](https://www.statichost.eu/pricing/): Hobby, «Free», «1 site», «10 GB bandwidth», «100 build minutes», «Instant rollbacks ✔».
- [S2] [Redirects and rewrites](https://www.statichost.eu/docs/routing/): «Actual static files are always matched first»; los 404 por carpeta, `/de/* /de/404.html 404`; el `!` fuerza una regla.
- [S3] [Custom headers](https://www.statichost.eu/docs/custom-headers/): fichero `_headers` en la raíz de la carpeta publicada.
- [S4] [Custom domains](https://www.statichost.eu/docs/domains/): CNAME a `SITENAME.statichost.page.` y certificado «automatically and on-demand». No menciona el proxy de Cloudflare.
- [S5] [Direct upload](https://www.statichost.eu/docs/direct-upload/): «the zip file is used exactly as provided», con el script [shcli](https://www.statichost.eu/shcli) y una clave de API.
- [S6] [Terms](https://www.statichost.eu/terms/): lo gestiona Variable Object Assignment, en Estocolmo. [Pricing](https://www.statichost.eu/pricing/), FAQ: «No AWS, no Cloudflare, no US cloud dependencies».

**Homelab**

- [H1] `apps/web/deploy/preprod/nginx.conf` y [docs/08](../08-despliegue.md) §3.
- [H2] [ADR-0012](../adr/0012-entornos.md) y [ADR-0026](../adr/0026-preproduccion-homelab.md).
- [H3] [docs/08](../08-despliegue.md) §2 y §6.

**Vercel** (vercel.com/docs)

- [V1] [vercel.json](https://vercel.com/docs/project-configuration/vercel-json): con `trailingSlash` sin definir, «visiting a path with or without a trailing slash will not redirect»; las redirecciones admiten `statusCode`; cabeceras por ruta. Las reescrituras dan prioridad al sistema de ficheros.
- [V2] [Errors](https://vercel.com/docs/errors) y [Build Output API, configuration](https://vercel.com/docs/build-output-api/configuration): `status` en las rutas, sin página de 404 por carpeta.
- [V3] [Add a domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain) y [Troubleshooting](https://vercel.com/docs/domains/troubleshooting): CNAME y, en Cloudflare, «DNS only».
- [V4] [Rollback](https://vercel.com/docs/deployments/rollback-production-deployment): «On the Hobby plan, you can only roll back to the immediately previous production deployment». [CLI deploy](https://vercel.com/docs/cli/deploy): `--prebuilt` sobre `.vercel/output`.
- [V5] [Hobby](https://vercel.com/docs/plans/hobby): 100 GB de tráfico y 1 000 000 de peticiones al mes; al superarlos, esperar 30 días. No se leyeron los términos de uso.

**Netlify** (docs.netlify.com)

- [N1] [Redirect options](https://docs.netlify.com/routing/redirects/redirect-options/): las _pretty URLs_, activas por defecto, llevan `/about` a `/about/`; «You cannot use a redirect rule to add or remove a trailing slash».
- [N2] [Post processing](https://docs.netlify.com/build/post-processing/overview/): «`/about.html` to `/about/`», sin estado.
- [N3] [Redirect options](https://docs.netlify.com/routing/redirects/redirect-options/): `/en/* /en/404.html 404`.
- [N4] [Headers](https://docs.netlify.com/routing/headers/).
- [N5] [Get started with domains](https://docs.netlify.com/domains-https/custom-domains/): CNAME a `<proyecto>.netlify.app`.
- [N6] [CLI](https://docs.netlify.com/cli/get-started/) y [Manage deploys](https://docs.netlify.com/site-deploys/manage-deploys/).
- [N7] [Credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/): 300 créditos al mes, 15 por despliegue de producción y 20 por GB. [Resume paused projects](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/): al agotarlos, la web se pausa hasta el mes siguiente.

**GitHub Pages** (docs.github.com)

- [G1] [Custom 404 page](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site): un único `404.html`.
- [G2] Ninguna página de la documentación de Pages permite fijar cabeceras HTTP.
- [G3] [Custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
- [G4] [Custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
- [G5] [Limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): 100 GB al mes como límite blando.

**Firebase Hosting** (firebase.google.com/docs/hosting)

- [F1] [Full config](https://firebase.google.com/docs/hosting/full-config): `trailingSlash`, `cleanUrls` y cabeceras; no dice qué responde a una carpeta sin `/`.
- [F2] [Full config](https://firebase.google.com/docs/hosting/full-config) e [i18n rewrites](https://firebase.google.com/docs/hosting/i18n-rewrites): un `404.html` en la raíz, y el 404 por idioma elige por `Accept-Language`, no por la ruta.
- [F3] [Custom domain](https://firebase.google.com/docs/hosting/custom-domain).
- [F4] [Manage hosting resources](https://firebase.google.com/docs/hosting/manage-hosting-resources).
- [F5] [Pricing](https://firebase.google.com/pricing) (360 MB al día) frente a [Usage, quotas and pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing) (10 GB al mes).

**Render** (render.com/docs)

- [R1] [Redirects and rewrites](https://render.com/docs/redirects-rewrites): «Render does not apply redirect or rewrite rules to a path if a resource exists at that path»; las reescrituras no tienen estado propio.
- [R2] [Static site headers](https://render.com/docs/static-site-headers).
- [R3] [Custom domains](https://render.com/docs/custom-domains).
- [R4] [Static sites](https://render.com/docs/static-sites) y [Deploy hooks](https://render.com/docs/deploy-hooks): compila desde el repositorio.
- [R5] [Free](https://render.com/docs/free): no da las cifras de tráfico de los sitios estáticos.

**Todo en un sitio** (§6)

- [NF1] Northflank, [Pricing](https://northflank.com/pricing): Sandbox «Free», «No card needed», «Always on, no sleeping», «2 services, 2 jobs, and 1 database»; frente a [Pricing on Northflank](https://northflank.com/docs/v1/application/billing/pricing-on-northflank): «all users must add a payment method to start creating resources». La prueba de Miguel confirma lo segundo.
- [NF2] Northflank, [Privacy](https://northflank.com/legal/privacy), [Terms](https://northflank.com/legal/terms) y [Security](https://northflank.com/security): sin DPA publicado; los términos permiten borrar la cuenta «without warning».
- [UE1] [Decisión de Ejecución (UE) 2025/2574](https://eur-lex.europa.eu/eli/dec_impl/2025/2574/oj/eng): renueva la adecuación del Reino Unido hasta el 27-12-2031.
- [HS1] HostStack, [Pricing](https://hoststack.dev/pricing): «No credit card required»; un servicio Nano y un PostgreSQL gratuitos.
- [HS2] HostStack, [Billing](https://hoststack.dev/docs/billing): sin tarjeta, el servicio gratuito «sleeps after 60 minutes without traffic».
- [HS3] HostStack, [DPA](https://hoststack.dev/dpa) y [Sub-processors](https://hoststack.dev/sub-processors).
- [HS4] HostStack, [About](https://hoststack.dev/about): «run from Denmark by one person».
- [CW1] Cloudflare, [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/) y [Limits](https://developers.cloudflare.com/workers/platform/limits/): sin arranques en frío de máquina virtual; 10 ms de CPU por petición en el plan gratuito.
- [CW2] Cloudflare, [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/): jurisdicción `eu`.
- [CW3] Cloudflare, [Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/).
- [K1] Koyeb, [Pricing FAQ](https://www.koyeb.com/docs/faqs/pricing): «We require a credit card to prevent fraud and abuse».
- [K2] Koyeb, [Scale-to-zero](https://www.koyeb.com/docs/run-and-scale/scale-to-zero): «cold start time of 1-5 seconds».
- [K3] Koyeb, [Data Processing Agreement](https://www.koyeb.com/docs/legal/data-processing-agreement).
- [R5] Render, [FAQ](https://render.com/docs/faq): solo cobra si se ha añadido un medio de pago.
- [R6] Render, [Free](https://render.com/docs/free): el servicio gratuito se duerme a los 15 minutos y despertarlo «takes about one minute»; «Free Render Postgres databases expire 30 days after creation».
- [FL1] Fly.io, [Free waiver](https://docs.fly.io/about/free-waiver): «New organizations don't have a free tier».
- [FL2] Fly.io, [Autostop/autostart](https://docs.fly.io/launch/autostop-autostart): «A cold start takes about 2 seconds or more».
- [FL3] Fly.io, [Privacy policy](https://fly.io/legal/privacy-policy.md): datos tratados en EE. UU.
- [RW1] Railway, [Free plan](https://docs.railway.com/pricing/free-plan): sin tarjeta; «Custom domains, cron jobs, region choice | No».
- [RW2] Railway, [App sleeping](https://docs.railway.com/reference/app-sleeping): sin tiempo de arranque documentado, y la primera petición puede dar un 502.
- [AD1] alwaysdata, [Public cloud prices](https://help.alwaysdata.com/en/docs/admin-billing/billing/public-cloud-prices/) y [Docker](https://help.alwaysdata.com/en/docs/development/docker/): el plan gratuito se limita a la dirección `alwaysdata.net`; Docker solo en nube privada.
- [AD2] alwaysdata, [Environment](https://www.alwaysdata.com/en/environment/): infraestructura en Francia.
- [CC1] Clever Cloud, [Pricing](https://clever.cloud/pricing/): créditos gratuitos al registrarse, sin tarjeta.
- [CC2] Clever Cloud, [DPA](https://www.clever.cloud/general-terms-and-conditions-of-use/clever-cloud-data-processing-agreement/).
- [DD1] Deno, [Deno Deploy](https://docs.deno.com/deploy/) y [Getting started](https://docs.deno.com/deploy/getting_started/): «will be sunset in April 2027»; «Mono-repos … are not yet supported»; arranque de «a few hundred milliseconds» en aplicaciones grandes ([Runtime](https://docs.deno.com/deploy/reference/runtime/)).
- [DD2] Deno, [Terms](https://docs.deno.com/deploy/terms_and_conditions/): «The Services are based in the United States».
- [SB1] Supabase, [Pricing](https://supabase.com/pricing), [Custom domains](https://supabase.com/docs/guides/platform/custom-domains), [Regions](https://supabase.com/docs/guides/platform/regions) y [DPA](https://supabase.com/legal/dpa).
- [AW1] Appwrite, [Postgres](https://appwrite.io/products/postgres): «Managed databases need a paid plan»; [GDPR](https://appwrite.io/docs/advanced/security/gdpr).
- [NE1] Neon, [Functions](https://neon.com/docs/compute/functions/overview): «Neon Functions do not support hosting websites».
- [OT1] [Wasmer](https://docs.wasmer.io/edge/learn/supported-frameworks-and-languages), [Leapcell](https://leapcell.io/pricing), [Back4app](https://www.back4app.com/pricing/container-as-a-service), [Zeabur](https://zeabur.com/pricing), [Scalingo](https://scalingo.com/pricing), [Sevalla](https://sevalla.com/pricing/), [Hostim](https://hostim.dev/pricing), [Azure](https://azure.microsoft.com/en-gb/free) e [IBM](https://www.ibm.com/cloud/free/faq).
