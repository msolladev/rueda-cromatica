# ADR-0037: El catálogo en la base de datos

- **Estado:** aceptada
- **Fecha:** 2026-11-24
- **Corrige en parte:** [ADR-0017](0017-arquitectura-objetivo-backend.md), [ADR-0025](0025-estabilidad-ids-etiqueta-publicacion.md) y [ADR-0030](0030-datos-curados-dos-capas.md)

## Contexto

Hoy la única fuente de verdad del catálogo es la carpeta `packages/catalog-builder/data/` ([docs/04](../04-datos-curados.md)):

- `sources/`: una transcripción literal por fuente. Solo la escribe su importador, que la reemplaza entera en cada importación.
- `brands/`: las fichas de cada marca, con sus claves, su tipo, su estado, sus notas y sus decisiones de color. Las escribe Miguel a mano, y los importadores solo añaden fichas y claves nuevas.
- `color-policy.json`, `ignore-reasons.json` y `tombstones.json`: las reglas, que solo escribe Miguel.

`build-catalog` genera `catalog.json` a partir de todo eso. Cada cambio se revisa en el diff de un PR, y los IDs se comprueban contra el `catalog.json` de la última etiqueta `release/`.

El [ADR-0017](0017-arquitectura-objetivo-backend.md) lleva el catálogo a una base de datos mantenida desde `apps/admin`, y deja que la PWA descargue la instantánea de la API sin volver a desplegarse. No decidió:

- qué pasa con `data/`, con los importadores y con la revisión por el diff;
- contra qué se comprueban los IDs cuando publicar deja de ser desplegar un commit;
- cómo queda al día el HTML prerenderizado, que se genera con el catálogo: los resultados de ejemplo y los créditos con las fuentes y sus licencias.

Además, habla de migrar «los JSON curados de la fase 4», y hoy son los de dos capas de la fase 5 ([ADR-0030](0030-datos-curados-dos-capas.md)).

## Decisión

### La fuente de verdad pasa a la base de datos

- **Solo hay un sitio donde se edita el catálogo.** Desde la migración es la base de datos, con las mismas tres capas que `data/`: las filas de cada fuente, las fichas con sus claves y las reglas.
- **La migración** carga una sola vez los ficheros de dos capas de `data/`. Se da por buena cuando el catálogo generado desde la base de datos es idéntico, byte a byte, al `catalog.json` de ese día. La última publicación guardada en ese momento es el catálogo de la última etiqueta `release/`, así que la protección de los IDs no tiene ningún hueco.
- **Después de la migración, `data/` se borra del repositorio**, en el mismo PR, con `src/cli/` y `src/curated/`. Ningún programa vuelve a escribir en esa carpeta: los importadores escriben en la base de datos. Su historia sigue en git.

### Cada dato tiene un solo escritor

Es la regla de hoy, que se mantiene:

- **Las filas de una fuente** solo las escribe su importación, que las reemplaza todas. En `apps/admin` son de solo lectura. Si una fuente se equivoca, se corrige en la ficha, con su nota.
- **Las fichas y las reglas** solo las cambia el administrador. Una importación propone fichas y claves nuevas, pero no cambia nunca una ficha que ya existe.
- **El color** solo sale de las filas de las fuentes. La ficha no guarda un color: guarda cuál de los candidatos vale (la elección) y cuáles no (los descartes), y cada decisión guarda el hex contra el que se tomó. Si una importación cambia ese hex, la publicación falla y pide revisarlo, en lugar de imponer en silencio la decisión vieja o el dato nuevo ([ADR-0031](0031-varios-candidatos-color.md)).

### `apps/admin` v1

- **Se edita lo mismo que hoy se edita a mano**: las fichas (nombre, alias, tipo, metálica, estado, sustituta y nota), las decisiones de color, las claves y las filas ignoradas con su motivo.
- **Se lanzan las importaciones y se revisan sus propuestas**: se aceptan o se rechazan las fichas propuestas, y se ven las diferencias entre la fuente y la ficha, las filas sin pintura y lo pendiente.
- **Los informes de hoy son pantallas**: el de las discrepancias de color y el de las fuentes desactivadas.
- **Los datos propios**, como un color medido por el administrador, entrarán más adelante como una fuente más, con sus filas, su origen y su justificación. Así un color sigue teniendo siempre una fuente, y la ficha sigue eligiendo entre fuentes.

### Cambios pendientes y una sola publicación

- **Cada cambio se guarda como pendiente**: editar una ficha, una fuente, una marca, una clave o una fila ignorada, o aceptar lo que propone una importación. Un cambio pendiente no llega a los usuarios.
- **Los pendientes son comunes** a todos los administradores, con el autor de cada cambio. En principio administra una persona; los borradores por administrador quedan para cuando trabajen varios a la vez.
- **La vista previa** enseña todo lo pendiente respecto a la última publicación, agrupado por tipo (pinturas, fuentes, marcas, gamas y equivalencias), con el valor de antes y el de después. También muestra lo que impediría publicar y, como aviso, las discrepancias de color y los efectos de las fuentes desactivadas.
- **Cada pendiente se puede descartar**, uno a uno o todos a la vez.
- **Un único «Publicar»** pasa las comprobaciones de `build-catalog` y, si pasan, guarda la publicación y lanza el despliegue.
- **El historial** registra cada cambio de una fila o de una ficha (el campo, el valor de antes y el de después, cuándo y si vino de una importación o de un administrador) y cada importación (la fuente, su revisión, la fecha y lo que trajo).

### Las publicaciones sustituyen a las etiquetas `release/`

- **Cada publicación** guarda el catálogo completo, su `dataVersion`, la fecha y su autor, y no se modifica nunca. Cuando exista una `schemaVersion` 2, guarda también el catálogo en cada versión que aún lean las apps instaladas.
- **Los IDs se comprueban contra la última publicación**, con las reglas de docs/03 §7. Un ID es inmutable desde que se publica: una ficha que nunca se ha publicado se puede corregir o borrar libremente.
- **Las etiquetas `release/`** siguen marcando cada despliegue del código en producción, pero dejan de ser la referencia de los IDs.
- **Las lápidas** pasan a su tabla, y `apps/admin` no deja borrar una ficha publicada: solo descatalogarla o retirarla con lápida.
- **Una lápida puede decir qué pintura queda**, por ejemplo la que se conserva de un duplicado (la consecuencia que dejó abierta el ADR-0025).

### Lo que queda del usuario con un ID retirado

- **La pintura elegida en el buscador** pasa sola a la que queda, si la lápida lo dice; si no, se quita.
- **En las listas del usuario**, cuando existan (colección, recetas, lista de la compra), una pintura retirada o descatalogada se queda con un aviso, y las acciones que haya no se le aplican. Si hay a qué cambiarla, el elemento ofrece cambiarla («Cambiar por su sustituta, …» o «Cambiar por …» si es la misma pintura), y el usuario decide. La lista nunca se cambia sola.

### Publicar despliega la web

- **«Publicar» lanza el despliegue** del entorno con la API de GitHub. El build descarga la última publicación de su entorno, compila la web con ella y pasa todas sus comprobaciones antes de servirla.
- **La PWA recibe el catálogo como hoy**, por la revisión del precaché de Workbox. No descarga catálogos de la API.
- **`GET /api/v1/catalog?schemaVersion=1`** sirve la última publicación, pública y sin sesión. La usa el build, y cualquiera puede leerla, igual que hoy `catalog.json`.
- **El [ADR-0007](0007-versionado-distribucion.md) sigue vigente**: la app y el catálogo se despliegan juntos.

### `catalog-builder` se queda como paquete puro

- **Conserva `src/importers/`**: las transcripciones de cada fuente, la conciliación, la propuesta de IDs y lo común de las cartas.
- **Conserva `src/pipeline/`**: la generación del catálogo, la elección del color, las equivalencias, las sustituciones, la estabilidad de IDs y los informes.
- **Lo que habla con el exterior pasa a `apps/api`**: la base de datos, la descarga de las fuentes, la lectura de los PDF y el archivado en la Wayback Machine.
- **Hasta la migración, la CLI de hoy sigue funcionando** sobre ese mismo paquete.

## Alternativas descartadas

- **Que git siga siendo la fuente de verdad, con `apps/admin` haciendo commits**: conserva el diff, la CI y las etiquetas, pero cada corrección pasa por un PR y por la CI, la API necesita permiso de escritura en el repositorio y dos ediciones a la vez chocan como dos PR.
- **La base de datos como verdad, exportada además a git en cada publicación**: la API escribiría en un repositorio con las ramas protegidas, y habría dos copias que se desalinean si falla la exportación.
- **Que los importadores sigan escribiendo en `data/` con la base de datos editable**: dos sitios con datos curados de fechas distintas, sin regla que los concilie.
- **Generar el catálogo en cada petición, sin publicaciones**: cada edición llegaría al momento a los usuarios, incluso a medias, y no habría un «último publicado» contra el que comprobar los IDs.
- **Que la PWA descargue la publicación de la API, como preveía el ADR-0017**: el HTML prerenderizado se quedaría desfasado hasta el siguiente despliegue (los créditos seguirían citando una fuente retirada), y la PWA necesitaría su propio código de descarga, validación, sustitución atómica y respaldo. Hacer las dos cosas suma el código de ambas.
- **Dos paquetes, como el ADR-0017 (`packages/importers` y `catalog-builder`)**: la conciliación depende de la generación, así que `importers` dependería de `catalog-builder` sin separarse de verdad.
- **Todo dentro de `apps/api`**: mezcla la lógica pura y probada con el servidor, y la CLI no podría usarla durante la transición.
- **Borradores por administrador**: chocan al publicar si tocan la misma ficha, y hoy administra una persona.
- **Escribir un hex a mano en la ficha**: sería un color sin fuente verificable.

## Consecuencias

- Corrige en parte el [ADR-0017](0017-arquitectura-objetivo-backend.md): la PWA no descarga la instantánea, sino que cada publicación vuelve a desplegar la web; no hay `packages/importers`, porque `catalog-builder` se queda como paquete puro; y se migran los datos de dos capas.
- Corrige en parte el [ADR-0025](0025-estabilidad-ids-etiqueta-publicacion.md): la referencia de los IDs es la última publicación, no la última etiqueta `release/`; las lápidas pasan a una tabla y pueden decir qué pintura queda.
- Corrige en parte el [ADR-0030](0030-datos-curados-dos-capas.md): a `apps/api` no va solo la transcripción, sino también la conciliación y la generación, dentro de `catalog-builder`.
- Desde la migración, git deja de ser la copia de seguridad del catálogo: las copias de PostgreSQL son obligatorias ([ADR-0040](0040-despliegue-fase-6.md)).
- Las comprobaciones de los datos que hoy hace la CI pasan a hacerse al publicar.
- Cada publicación tarda lo que un despliegue, unos 4 minutos, y la web no responde uno o dos segundos mientras cambia el contenedor.
- docs/02, 03, 04, 07 y 08 describen lo vigente, así que se actualizan en la sesión que haga la migración, no antes.
