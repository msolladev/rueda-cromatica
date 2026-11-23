# ADR-0035: Las líneas antiguas de Citadel

- **Estado:** aceptada
- **Fecha:** 2026-11-23

## Contexto

El paso 5b de la fase 5 trae las líneas antiguas de Citadel, con lo común a cualquier línea descatalogada ya resuelto en el [ADR-0034](0034-warpaints-originales-sustituciones.md). El [ADR-0013](0013-clasificacion-pinturas.md) previó como gamas descatalogadas Citadel Colour (61-xx), Foundation, los Washes de 2008, las tintas antiguas, Glaze y Edge, y el [ADR-0015](0015-fuentes-trazabilidad-licencias.md) dejó la carta de conversión de GW de 2012 a la espera de una copia fiel.

- **Los documentos de Games Workshop** ya no están en sus URL originales, pero la Wayback Machine guarda los ficheros que servía su web. La API CDX da, para cada captura, el SHA-1 de los bytes descargados entonces; el de cada fichero que se usa coincide con el suyo, así que son los ficheros originales, no copias de terceros:
  - la carta de 2012, `m2320032a_Citadel_Conversion_Chart` ([captura del 5-6-2012](https://web.archive.org/web/20120605023151/http://www.games-workshop.com/MEDIA_CustomProductCatalog/m2320032a_Citadel_Conversion_Chart)), la página 120 de la White Dwarf 388: una imagen de 72 casillas, de la pintura antigua a «the best match from the new paint range». Su texto dice «we can suggest close, but not exact comparisons». Las capturas de marzo y de junio de 2012 tienen el mismo contenido, y las cartas `m2320033a` a `m2320038a` son sus traducciones;
  - la hoja de control «Paints & Inks Range Checklist» de 2004 ([captura del 19-7-2006](https://web.archive.org/web/20060719172124/http://us.games-workshop.com/games/warhammer/painting/checklists/assets/PaintingChecklistCard.pdf)), un PDF con texto: las 65 pinturas y tintas de Citadel Colour con su código 61-xx, más el barniz y el bote vacío. Su versión de bolsillo (`PaintingChecklistSmall.pdf`, captura del mismo día) las agrupa en «PAINTS», «INKS» y «METALLICS», sin códigos;
  - «What Are Citadel Foundation Paints?» ([captura del 17-4-2008](https://web.archive.org/web/20080417050427/http://uk.games-workshop.com/painting/foundation-paints/1/)), con una muestra de cada una de las 18 Foundation, sin códigos;
  - «Using the New Citadel Washes», página 4 ([captura del 8-6-2008](https://web.archive.org/web/20080608042740/http://uk.games-workshop.com/painting/washes/4/)), con la galería de los 8 Washes. Su página 1 dice que «Citadel Washes are replacing the Inks»;
  - para las Glaze, solo las recomendaciones de pinturas de la tienda de GW (`paintDropsJSON.jsp`, capturas de 2015 de los productos `prod1060082` y `prod2900248`), que las nombran con su código, 99189954001 a 99189954004. Ningún documento de GW dice que se retiraran.
- **Las Edge** (Dorn Yellow, Fulgrim Pink…) ya están en el catálogo como Layer vigentes: GW las reclasificó.
- **El color**: ningún documento de GW da hex. Arcturus5404/miniature-paints, ya fuente del catálogo, tiene un fichero de Citadel con una tabla «Foundation (discontinued)» que mezcla Citadel Colour y Foundation, y otra de Washes. DonnervS y SimoGecko solo tienen la gama actual.

## Decisión

### Las gamas y sus pinturas

- **Tres gamas descatalogadas**, con el nombre de producto de GW: `citadel/citadel-colour` («Citadel Colour»), `citadel/foundation` («Foundation») y `citadel/washes` («Washes»). Su sucesora, la gama actual, también se divide por función, y así la Dark Angels Green de 61-38 no se confunde con la Layer actual.
- **91 pinturas**, cada una con el documento de GW que la prueba:
  - Citadel Colour, las 65 de la hoja de control de 2004, con su código. Son `standard`, salvo las 9 tintas, que son `ink`, y Flesh Wash, que es `wash` por su función aunque GW la lista entre las tintas. Las 8 metálicas lo son según la versión de bolsillo. **Las tintas van en esta gama**, no en una propia: GW las vendía como Citadel Colour, con el mismo código 61-xx. Esto corrige en esa parte el ADR-0013;
  - Foundation, las 18 de su página, `base`;
  - Washes, los 8 de su página, `wash`.
- **Todas descatalogadas y sin sustituta.** La carta de 2012 las llama «our old paint range» y da la equivalente más cercana, no una sustituta ([ADR-0005](0005-sustitucion-en-estado.md)), y la página de los Washes sustituye la línea de las tintas, no pinta a pinta, como el blog de The Army Painter en el ADR-0034.
- **Las Glaze no entran**: se sabe que existieron, pero ningún documento de GW permite marcarlas descatalogadas. Sus filas se ignoran con el motivo nuevo `no-discontinuation-document`, y entrarán cuando aparezca uno.
- **Edge no es una gama aparte**: sus pinturas son las Layer de hoy, con su ID.

### Las fuentes nuevas

- **Una fuente por documento**, de tipo `manufacturer`, con la `url` original y su captura en `archiveUrl`:
  - `games-workshop-paints-inks-checklist-2004`, clave el código (`61-32`);
  - `games-workshop-foundation-paints-2008` y `games-workshop-citadel-washes-2008`, clave el nombre;
  - `games-workshop-citadel-conversion-chart-2012`, clave la columna y el nombre (`Old/Regal Blue`, `New/Kantor Blue`), transcrita a mano desde la imagen, como la carta de 2020. Un test la coteja con los tres documentos anteriores, que tienen texto. Dawnstone y Nurgling Green, que hoy son Layer y Dry, se ignoran como `ambiguous`, igual que en las otras cartas.
- **Se leen de su captura**: `src/cli/source-files.ts` lista, para cada una, la captura exacta en bruto (`<fecha>id_`) y su nombre de fichero, y la usan el importador y `archive-sources`. Las tres con texto tienen su importador, `import-games-workshop`.
- **Arcturus** pasa a la carpeta de su commit, con sus dos ficheros, The Army Painter y Citadel. De Citadel solo aporta el color de las pinturas antiguas; lo demás se ignora por grupo. Una fila repetida, que la tabla de Citadel tiene una vez, lleva su número de aparición en la clave (`Foundation (discontinued)/Kommando Khaki (2)`). Las tres filas de Kommando Khaki, con dos hex distintos, se ignoran como `ambiguous`, y lo que Arcturus tiene sin documento de GW, como Jade Green, con `no-manufacturer-document`.
- **La tabla de AK** asigna su columna «Old Citadel» a las pinturas antiguas. Sus erratas de una sola pintura posible («Coldex Grey») se resuelven con la clave literal; Jade Green y Vile Green se ignoran con `no-manufacturer-document`.

## Alternativas descartadas

- **Las copias de terceros de la carta de 2012** (tabletopgamer.com, Dakka Dakka, Scribd): retranscripciones sin forma de comprobarlas, frente al fichero original archivado.
- **Una sola gama para todo lo anterior a 2012**, como la carta, que lo llama «old Citadel Colour»: Foundation y Citadel Colour solo se distinguirían por el tipo, y los Washes se mezclarían con las tintas que sustituyeron.
- **Una gama propia para las tintas**, como preveía el ADR-0013: GW las vendía dentro de Citadel Colour, con su mismo código.
- **Las Glaze como descatalogadas por su ausencia en la tienda actual de GW**: la regla de CLAUDE.md pide un documento del fabricante, y aceptar la ausencia abriría la puerta a marcar Contrast por rumores.
- **Sustitutas desde la carta de 2012**: es una carta de conversión, que da equivalencias.
- **Una fuente nueva para el fichero de Citadel de Arcturus**: es el mismo repositorio en el mismo commit.
- **Muestrear el color de las imágenes** de la carta o de las páginas de 2008: descartado ya en el ADR-0034.

## Consecuencias

- `catalog.json` tiene 1616 pinturas y 854 aristas: 70 nuevas de la carta de 2012 y 48 de la tabla de AK. 84 de las 91 pinturas antiguas tienen color comunitario; las otras 7 (cinco tintas, Thraka Green y Kommando Khaki) entran sin color y se encuentran en el buscador ([ADR-0034](0034-warpaints-originales-sustituciones.md)).
- Ninguna pintura tiene sustituta: contra lo que preveía el ADR-0034, no llegan en este paso. Las tendrá la que un documento del fabricante diga que sustituye a otra.
- El motivo `discontinued-line-pending` desaparece: ya no queda ninguna línea pendiente.
- El ADR-0013 y el ADR-0034 pasan a «aceptada; corregida en parte por ADR-0035». El detalle está en [docs/04](../04-datos-curados.md).
