# ADR-0033: Equivalencias oficiales entre líneas vigentes

- **Estado:** aceptada
- **Fecha:** 2026-11-22

## Contexto

El paso 4 de la fase 5 trae las equivalencias oficiales que el [ADR-0019](0019-alcance-minimo-mvp.md) aplazó. `catalog.json` ya tenía `equivalences` en su esquema, vacío, y las equivalencias son aristas dirigidas con una fuente del fabricante ([ADR-0004](0004-equivalencias-dirigidas.md)). Las cartas son PDF con maquetas muy distintas: tres tablas en el último panel de un tríptico (Vallejo CC266), hexágonos con tres casillas marcadas con iconos (la carta de Warpaints Fanatic) y una tabla de siete páginas con las casillas centradas (AK). Nombran pinturas que no están en el catálogo (líneas descatalogadas, de aerógrafo o fuera del alcance) y tienen erratas («Abbadon Black», «Pink Horor»).

## Decisión

### Reparto entre los pasos 4 y 5

- **Paso 4**: las equivalencias oficiales cuyos dos extremos son pinturas de líneas vigentes del catálogo.
- **Paso 5**: las líneas descatalogadas con sus cartas (la de GW de 2012 y la de los Warpaints originales a Fanatic) y, con ellas, las sustituciones.
- Una carta se transcribe entera ([ADR-0030](0030-datos-curados-dos-capas.md)). Una fila con un extremo en una línea descatalogada se ignora con el motivo `discontinued-line-pending`. Cuando el paso 5 dé de alta esas pinturas, la decisión 3 del ADR-0019 hará fallar el build hasta que se quiten esas ignoradas.

### Las cartas

- **Entran** la CC266 de Vallejo (Game Color, Wash y Xpress Color hacia Citadel), la Warpaints Fanatic Conversion Chart de The Army Painter y la tabla de equivalencias de AK de 2023 (3rd Gen hacia Model Color, Game Color y Citadel), desde las URL oficiales de cada fabricante.
- **No entran**:
  - la CC329 de Model Color, que solo relaciona Model Color con Model Air, RAL, RLM, FS y ANA;
  - las tablas de AK de 2021, que repiten la de 2023 (AK → Vallejo) o son su inversa exacta (Vallejo → AK);
  - la carta de AK de 236 colores (2020) y el dossier de 2024, cuya columna de Citadel trae códigos que no son de GW y no se pueden resolver.

### La transcripción de un PDF

- **Un importador por carta**, con [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`), el lector de PDF de Firefox. Es una dependencia de desarrollo de `catalog-builder`, sin dependencias propias; su canvas nativo opcional se excluye, porque solo se lee el texto.
- `cli/pdf.ts` convierte el PDF en fragmentos de texto con su posición, y la función pura de cada carta los convierte en filas con la regla de columnas de esa carta.
- **Se comprueba fila a fila**:
  - el transcriptor falla si sobra algún fragmento de la tabla o si las cabeceras cambian;
  - los tests fijan el número de filas de cada tabla tal como se ve en la carta;
  - al importar se cotejó cada pareja con una segunda extracción hecha con poppler, sin añadirlo al repositorio. Coinciden todas; la única diferencia fue un error de poppler.
- `import-charts` transcribe las tres cartas; `archive-sources` las archiva y las descarga como cualquier otra fuente ([ADR-0032](0032-desactivacion-fuentes-archivado.md)).

### La forma de los datos

- **El fichero de una carta** añade a las claves de cualquier fuente `equivalences`: las parejas `{ from, to, note }` de claves de sus filas, en el orden y la dirección de la carta. En las demás fuentes va vacío.
- **`paints` nombra cada pintura una vez**, aunque aparezca en varias filas, con el esquema de fila de siempre. Su clave es el código del fabricante si la carta lo da (`72.051`, `AK11029`). Si no, es la columna y el nombre literal (`Citadel/Abbadon Black`, `GW/Fulgrim Pink`, `WP/Matt White`), porque un mismo nombre puede estar en varias columnas.
- **Una casilla con dos códigos**, como «049/047», son dos parejas con una nota. Una casilla vacía no da ninguna.
- **Los extremos se resuelven con las claves del ADR-0030.** Una arista se publica si sus dos filas son claves de pinturas; si una está ignorada, la pareja se queda en la transcripción. Una errata se resuelve con la clave literal en la ficha, que cita la carta en su nota, sin un alias. Un nombre que corresponde a dos pinturas, como Dawnstone (Layer y Dry), se ignora como ambiguo.
- **El importador escribe las claves** cuando el código o el nombre coinciden con una sola pintura. El apóstrofo tipográfico cuenta como el recto. Solo se añaden claves: no cambia ningún otro campo de las fichas.
- Los motivos nuevos son `discontinued-line-pending`, `ambiguous` y `not-in-catalog`. Una pintura retirada de una línea vigente usa el que ya existía, `not-in-current-chart`.
- Con una fuente desactivada, sus aristas desaparecen y el resumen de fuentes desactivadas las lista.

### La web

- **`domain`** da, para una pintura, sus equivalencias salientes y entrantes con las fuentes que las afirman y su ΔE respecto a un color, con la misma etiqueta de cercanía que las pinturas parecidas.
- **Un bloque «Equivalencias oficiales»** en la pestaña Base cuando hay una pintura elegida en el buscador, encima de las pinturas parecidas y aparte de ellas:
  - dos grupos con la dirección en el título: «Para Black se propone» y «Black se propone para»;
  - cada equivalencia, con la misma fila que las parecidas (muestra partida, ΔE y «Detalles») y quién la afirma, con un enlace a «Créditos y fuentes»;
  - todas, sin los filtros;
  - si no hay ninguna, una sola línea que lo dice.
- **Cada fila** lista además sus equivalencias en «Detalles».
- **Un botón con el icono de la rueda** junto a cada equivalencia la hace la base, como el buscador, y «Volver a…» deshace el salto. Su nombre accesible dice la acción entera; su tooltip, el mismo de los botones del tema, la resume.
- **La redacción no atribuye la arista a la marca de la pintura**, porque un documento puede publicar aristas que salen de pinturas de otra marca (la CC073 de Vallejo sale de Citadel). Quién la afirma está en cada fila.
- **El paso 5** añade la sustituta de una pintura descatalogada como un grupo más del bloque y una entrada más de «Detalles».

## Alternativas descartadas

- **Transcribir a mano**: unas 1500 casillas, y cada errata sería nuestra.
- **Transcribir una vez con un script suelto**: no se puede reproducir, y la siguiente revisión de la carta se rehace desde cero.
- **`pdf-parse`**, que fija una versión antigua de pdf.js y necesita un canvas nativo; **`unpdf`**, que envuelve pdf.js sin aportar nada aquí; **poppler** en el importador, que no instala `pnpm install`.
- **La fila tal como se ve en la carta**, con sus casillas: necesitaría un segundo mecanismo de claves y de ignoradas por columna.
- **Los extremos resueltos en la transcripción**: mezcla lo que dice la fuente con la interpretación.
- **Solo en «Detalles»**: quien busca su pintura no ve la respuesta oficial sin abrir cada fila, y la equivalente puede no estar entre las parecidas.
- **Una ficha «Oficial» en las filas de las parecidas**: mezcla lo afirmado con el orden por ΔE, y la dirección y la fuente no caben.
- **Ocultar el bloque sin equivalencias**: sin él no se sabe si falta el dato o si algo ha fallado.
- **Un motivo propio para las pinturas retiradas**: repetiría `not-in-current-chart`.

## Consecuencias

- `catalog.json` publica 445 aristas de las tres cartas, y 674 de las 1393 pinturas tienen alguna.
- Lo que el ADR-0030 transcribe de cada fuente («Qué se transcribe») se amplía con las parejas de las cartas. El detalle está en [docs/04](../04-datos-curados.md).
- El bloque es la §16 de [docs/07](../07-web.md), después del buscador; el pie pasa a ser la §17 y los prototipos la §18.
