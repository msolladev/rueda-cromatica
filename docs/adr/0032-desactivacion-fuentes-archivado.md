# ADR-0032: Desactivación de fuentes y archivado

- **Estado:** aceptada
- **Fecha:** 2026-11-22

## Contexto

El [ADR-0015](0015-fuentes-trazabilidad-licencias.md) fija que cualquier fuente se puede desactivar en los datos curados: sus colores pasan al siguiente candidato o a `null`, sus aristas desaparecen, los IDs no cambian y el builder informa de lo que cambia. Fija también el script `archive-sources`, que busca o solicita una captura en la Wayback Machine y descarga el fichero oficial con su SHA-256. El [ADR-0019](0019-alcance-minimo-mvp.md) (decisión 5) añade que un documento desactivado sale del catálogo y que el test de estabilidad lo acepta mientras su fichero siga en los datos curados.

A 2026-11-22, las tres fuentes son repositorios de GitHub, con la `url` fijada a un commit y sin captura. Una es la página de una carpeta (DonnervS, con tres ficheros) y dos son páginas de un fichero (las tablas de SimoGecko). Las cartas en PDF llegan en el paso 4 de la fase 5.

## Decisión

### Desactivación

- **Una pintura cuya única fuente se desactiva se queda en el catálogo sin color**, como dice el ADR-0015. `domain` y la web ya admiten `color: null`: la pintura no entra ni en las pinturas parecidas ni en el buscador.
- **El test de estabilidad acepta que falte el ID de una fuente desactivada**, sin lápida, porque una lápida impediría reactivarla. Es el único ID que falta: las pinturas, las gamas y las marcas se quedan.
- **Una elección o un descarte que citan una fuente desactivada hacen fallar el build** (decisión 4 del ADR-0019), con el candidato que se publicaría sin ellos.

### Resumen de cambios

- **Compara el mismo build con todas las fuentes y sin las desactivadas.** Así aísla el efecto de la desactivación de cualquier otro cambio de los datos, y se mantiene igual mientras la fuente siga desactivada.
- Lista cada pintura cuyo color cambia o se pierde, con el ΔE2000. Los pasos 4 y 5 añaden las equivalencias oficiales y las sustitutas que desaparecen.
- **Se escribe en `packages/catalog-builder/reports/disabled-sources.json`**, con las reglas del informe de discrepancias del [ADR-0031](0031-varios-candidatos-color.md): es determinista, se versiona, lo comprueba `--check` y nunca hace fallar el build.

### `archive-sources`

- **Se archiva la `url` de la fuente**, que es la que va a `catalog.json` con su `archiveUrl`. **Se descargan los ficheros que lee su importador**: el fichero en bruto de una página de fichero de GitHub, los ficheros en bruto de una carpeta y la propia URL en cualquier otra fuente, como un PDF. Es una sola lista en el código para el importador y para el script, así que el hash es el de lo que se transcribió.
- **La Wayback Machine**:
  - la captura se busca con la API CDX, sin claves: la más reciente de la URL exacta con respuesta 200;
  - si no hay ninguna, se solicita con Save Page Now 2, que exige las claves S3 de una cuenta gratuita de archive.org;
  - las capturas se piden de una en una, y el estado se consulta durante 2 minutos como mucho, el máximo de una captura;
  - como mucho una petición cada 5 segundos, sondeos incluidos. Internet Archive no publica sus límites: sus usuarios hablan de entre 30 y 60 por minuto, y de un bloqueo de la IP durante una hora si se insiste tras un 429;
  - lo pasajero (sin respuesta, un 5xx o un 429) se reintenta dos veces, a los 30 y a los 60 segundos o según su `Retry-After`. Si sigue fallando, la ejecución no vuelve a pedir nada a la Wayback Machine;
  - un error de Save Page Now, como el de un sitio que bloquea el archivado, no se reintenta: se muestra con su código;
  - lo que falla deja `archiveUrl: null`, se lista al final por fuente, y lo hace la siguiente ejecución, que solo hace lo que falta.
- **Las claves** se leen de `~/.config/internetarchive/ia.ini`, el fichero de la herramienta oficial `ia`. El script se niega a leerlo si otros usuarios del sistema pueden hacerlo. Nunca se ponen en variables de entorno.
- **La carpeta de descargas** se indica con `CATALOG_SOURCES_DIR` y tiene que estar fuera del repositorio.

### Campos de la fuente en los datos curados

- `disabled`: `null`, o un objeto con una nota obligatoria.
- `files`: los ficheros descargados, cada uno con su URL, su nombre y su SHA-256.
- La revisión no se añade: en las fuentes de GitHub, el commit ya está en la `url`. La URL de la copia de terceros tampoco, porque ninguna fuente la usa: llega con la primera carta alojada por terceros.
- El builder comprueba que `archiveUrl` sea una captura de la `url`, para que un cambio de revisión no deje una captura de la anterior.

## Alternativas descartadas

- **Sacar del catálogo las pinturas que se quedan sin fuente**: va contra el ADR-0015 y contra la regla de que un ID publicado nunca desaparece.
- **Una lápida para la fuente desactivada**: no se podría reactivar.
- **Comparar con el `catalog.json` versionado**: mezcla la desactivación con los demás cambios del commit, y en la CI siempre sale vacío.
- **Comparar con la última etiqueta `release/`**: acumula todo lo que ha cambiado desde la publicación.
- **Archivar también cada fichero en bruto**: cada fichero necesitaría su propia captura en los datos, y en un PDF repetiría el `archiveUrl` de la fuente.
- **No descargar las fuentes de GitHub**: el commit fija el contenido, pero si el repositorio desaparece no queda una copia exacta.
- **Save Page Now sin claves**: su documentación lo desaconseja, y su límite es de 4 capturas por minuto.
- **Sin ritmo ni reintentos**, como en la primera versión del script: en su primera ejecución, el 22 de noviembre de 2026, web.archive.org rechazó la conexión de forma intermitente durante unos minutos, y dos de las tres búsquedas fallaron sin volver a intentarlo.
- **Solo buscar capturas, sin solicitarlas**: vuelve al trabajo manual que el ADR-0015 descarta.
- **Las claves en variables de entorno**: los procesos hijos las heredan y acaban en el historial de la shell.
- **Las claves en los secretos de GitHub**: solo se leen en un workflow, y el script nunca se ejecuta en la CI.
- **Pedir las claves en cada ejecución**: Node no trae entrada oculta, y se teclean cada vez.
- **El llavero del sistema**: WSL no lo tiene en marcha por defecto.

## Consecuencias

- `catalog.json` no cambia mientras no se desactive ninguna fuente, y el resumen empieza vacío.
- Al desactivar la tabla muestreada de SimoGecko, el build falla por el descarte de Corax White y por su motivo, que se queda sin uso. Quitados los dos, cambia el color de 128 pinturas. Al desactivar la tabla oficial, 144 pinturas se quedan sin color.
- Los importadores y `archive-sources` comparten la lista de ficheros de cada fuente, en `src/cli/source-files.ts`.
- El documento oficial de Save Page Now 2 es un Google Doc que no se puede leer sin navegador. Este ADR sigue una copia de 2023 archivada en archive.org.
