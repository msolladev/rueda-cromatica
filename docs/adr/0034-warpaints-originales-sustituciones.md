# ADR-0034: Los Warpaints originales, las sustituciones y las pinturas descatalogadas en la web

- **Estado:** aceptada; corregida en parte por [ADR-0035](0035-lineas-antiguas-citadel.md)
- **Fecha:** 2026-11-22

## Contexto

El paso 5 de la fase 5 trae las líneas descatalogadas con sus cartas y, con ellas, las sustituciones ([ADR-0033](0033-equivalencias-oficiales-lineas-vigentes.md)). Se hace en dos sesiones: esta (5a) con los Warpaints originales de The Army Painter y lo común a cualquier línea descatalogada, y la siguiente (5b) con las líneas antiguas de Citadel.

- **Los documentos de The Army Painter sobre los Warpaints originales:**
  - el blog de la carta de Fanatic (26-9-2024; [captura del 18-5-2026](https://web.archive.org/web/20260518000902/https://thearmypainter.com/blogs/explore/the-warpaints-fanatic-colour-conversion-chart)), que dice que Fanatic «replaced our long-standing original Warpaints line». Sustituye la línea, no pinta a pinta;
  - la carta de Fanatic, ya transcrita, con 118 Warpaints originales;
  - una carta de conversión de 2020, cuya tabla es una imagen sin texto: los 124 productos de la línea de entonces, con su equivalente en Citadel y en Vallejo;
  - la página del set completo (WP8022P; [captura del 23-4-2025](https://web.archive.org/web/20250423004849/https://thearmypainter.com/products/warpaints-complete-paint-set)): «96 Acrylic Warpaints, 8 Metallic Warpaints, 11 Quickshade Washes and 9 Effects Warpaints».
- **Ningún documento del fabricante da hex ni códigos.** DonnervS rehízo su fichero de The Army Painter solo con Fanatic. [Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints), el repositorio del que desciende DonnervS, con licencia MIT, tiene hex para todos y el código de los de la línea.
- **El ADR-0032** dejó fuera del buscador las pinturas sin color: una pintura descatalogada de la que ninguna fuente da el hex no se podría buscar, que es justo lo que hace quien tiene un bote antiguo.

## Decisión

### Los Warpaints originales

- **Una gama**, `the-army-painter/warpaints` («Warpaints», el nombre del fabricante), descatalogada, como Warpaints Fanatic. Los IDs no chocan con los de Fanatic porque el ID lleva la gama.
- **132 pinturas**: las 119 con color de la carta de 2020 y las 13 de los estuches de pieles y de metálicos que solo nombra la carta de Fanatic. Entre las de 2020, 96 acrílicas (`standard`), 8 metálicas, 11 Quickshade (`wash`) y 4 efectos (`technical`), según los recuentos del set completo; los 5 productos restantes de los «Effects» son auxiliares y se ignoran. Obsidian Pigment Toner, un «pigment toner» que el [ADR-0013](0013-clasificacion-pinturas.md) no tiene, es `standard`: se vendía como un Warpaint más.
- **No entra lo que ningún documento del fabricante nombra**, aunque Arcturus lo tenga: 12 pinturas de los estuches, ignoradas con el motivo nuevo `no-manufacturer-document`.
- **Ninguna tiene sustituta**: el blog sustituye la línea, y la carta da las equivalentes más cercanas. «Some of the colours carried over, such as Daemonic Yellow and Greenskin» es un ejemplo de que el color continúa, no una sustitución.

### Las fuentes nuevas

- **La carta de 2020**, `the-army-painter-warpaints-conversion-chart`, transcrita a mano desde la imagen y sin importador. Un test la coteja con la carta de Fanatic, que tiene texto, y con los recuentos del set completo.
  - Una casilla con dos nombres son dos parejas con una nota, como en el ADR-0033. Un fragmento que es el nombre completo de otra casilla de la misma columna («Agrax», «Seraphim») se transcribe con ese nombre, porque una pintura tiene una sola clave por fuente; la nota guarda la casilla literal.
  - Una errata de una sola pintura posible se resuelve con la clave literal en la ficha; un nombre que no existe («Steel Legion Brown») o una línea de Vallejo que la carta no dice se ignoran como `ambiguous`. Una errata que repite una pintura ya escrita bien se ignora con el motivo nuevo `duplicate-row`.
- **Arcturus**, `arcturus5404-miniature-paints`, fijada a un commit, como fuente comunitaria, la última de su lista en `color-policy.json`, con su importador (`import-arcturus`). Solo aporta los Warpaints originales: los grupos que ya cubre DonnervS se ignoran con el motivo nuevo `newer-source`. Sus colores difieren de los de DonnervS en un ΔE mediano de 9,3 en las pinturas Fanatic que comparten; son comunitarios y la web avisa de que son aproximados.

### Las sustituciones en el builder

- **Lo que dice cada documento**: el fichero de una fuente añade `replacements`, las parejas `{ from, to, note }` de claves de sus filas, vacío en las demás. Solo un documento de tipo `manufacturer` puede tenerlas, y nombra como mucho una sustituta por pintura.
- **La ficha** de una pintura descatalogada no escribe su sustituta: lleva `replacementChoice`, `null` o `{ sourceId, note }`, para elegir cuando dos documentos se contradicen (decisión 1 del [ADR-0019](0019-alcance-minimo-mvp.md)).
- **El build falla** si un documento sustituye una pintura activa, si dos documentos nombran sustitutas distintas sin elección, si la elección sobra o si cita un documento que no nombra ninguna, también por estar desactivado (decisión 4 del ADR-0019). Si varios documentos coinciden, se publica el primero por ID.
- **Con una fuente desactivada**, sus sustituciones desaparecen y el resumen de las fuentes desactivadas lista cada pintura cuya sustituta cambia ([ADR-0032](0032-desactivacion-fuentes-archivado.md)).

### La web

- **El buscador encuentra también las pinturas sin color.** Esto corrige el ADR-0032 en esa parte. Dentro de cada grupo de coincidencia, las vigentes van antes que las descatalogadas.
- **Una pintura descatalogada** lleva la ficha «Descatalogada», con el aspecto de «Elegida», en la sugerencia, bajo el campo, en las filas y en «Detalles». Una pintura sin color tiene la muestra rayada y «sin color» como texto accesible.
- **Al elegir una pintura sin color**, la rueda salta sola cuando no hay nada que elegir:
  1. a su sustituta, al final de la cadena;
  2. si no tiene, a su única equivalente oficial, en cualquier sentido;
  3. con varias o ninguna, la rueda no se mueve, y en lugar de las pinturas parecidas una línea dice que use una equivalencia, o que no hay color ni equivalencias.

  Bajo el campo, «Mostrando Deep Grey, su equivalente según The Army Painter», para que no parezca que la pintura elegida es la otra. `domain` da esa pintura con `colorStandIn`.

- **El bloque de equivalencias** de una pintura descatalogada empieza por el grupo de su sustituta, «Matt White se sustituye por», o una línea que dice que ningún documento la nombra. Con la pintura elegida sin color, sus filas no se miden con la rueda: muestra entera, sin ΔE.
- **«Usar como base»** vale para cualquier pintura, con la misma regla.
- **Las pinturas parecidas** siguen dejando fuera las descatalogadas salvo con el filtro que ya existía ([ADR-0022](0022-busqueda-pinturas-parecidas.md)).

## Alternativas descartadas

- **Solo la carta de Fanatic**: faltan 14 pinturas que existieron, como Dungeon Grey.
- **Leer la carta de 2020 con OCR**: una dependencia del sistema para una sola imagen, que habría que revisar a mano igualmente.
- **Sin hex**: las 14 pinturas solo de la carta de 2020 no tienen equivalente Fanatic, y las equivalencias saldrían sin ΔE.
- **Muestrear las muestras de la carta de 2020**: un hex sacado de una imagen de imprenta en CMYK, no un dato del fabricante.
- **Copiar el hex de la sustituta a la pintura antigua**: sería un hex inventado, sin fuente, y las parecidas la darían por idéntica.
- **Sustitutas para Daemonic Yellow y Greenskin**, por el «carried over» del blog: lee «el color continúa» como «sustituye», y solo para dos de las muchas que continuaron.
- **Sustituta para toda pintura del mismo nombre en las dos líneas**: deducida del nombre, contra el [ADR-0005](0005-sustitucion-en-estado.md).
- **Cuatro gamas** (Warpaints, Metallics, Quickshade Washes y Effects): Fanatic, la sucesora, es una sola gama por el mismo motivo.
- **«Warpaints originales» como nombre de la gama**: «original» es una descripción del blog, no el nombre del producto.
- **Al elegir una pintura sin color, saltar siempre a una equivalente** (la primera de la carta o la de su marca): decide por la persona y esconde las demás.
- **Dejar las pinturas sin color fuera del buscador**: quien tiene un bote antiguo no lo encontraría.
- **La sustituta escrita en la ficha**, como en `catalog.json`: el dato sería nuestro, no de la transcripción del documento.

## Consecuencias

- `catalog.json` tiene 1525 pinturas y 736 aristas: 118 nuevas de la carta de Fanatic y 173 de la de 2020. Ninguna pintura tiene sustituta todavía; las primeras llegan en el paso 5b.
- Las ignoradas `discontinued-line-pending` de los Warpaints originales desaparecen de la carta de Fanatic; las de Citadel antiguo de la tabla de AK siguen hasta el paso 5b.
- Lo que transcribe cada fuente ([ADR-0030](0030-datos-curados-dos-capas.md)) se amplía con las sustituciones. El detalle está en [docs/04](../04-datos-curados.md), [docs/06](../06-pinturas-parecidas.md) y [docs/07](../07-web.md).
- El ADR-0032 pasa a «aceptada; corregida en parte por ADR-0034».
