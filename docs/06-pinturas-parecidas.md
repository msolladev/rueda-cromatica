# Pinturas parecidas

Este documento especifica el módulo `matching` de `@chromatic-wheel/domain`: la búsqueda de las pinturas del catálogo más parecidas a un color, que son las equivalencias calculadas de [docs/01](01-modelo-dominio.md) §4, y las equivalencias oficiales de una pintura medidas con el mismo criterio (§10). Por qué se decidió así está en el [ADR-0022](adr/0022-busqueda-pinturas-parecidas.md) y el [ADR-0033](adr/0033-equivalencias-oficiales-lineas-vigentes.md).

## 1. Principios

- **Funciones puras sobre el catálogo**: sin navegador ni Node, y sin estado. Los errores esperables se devuelven como `Result` ([ADR-0018](adr/0018-organizacion-codigo-patrones.md)).
- **Siempre hay respuesta**: no hay un ΔE máximo que oculte resultados. Si la pintura más cercana está lejos, se devuelve con una etiqueta que lo dice (§3).
- **Determinista**: el mismo color y las mismas opciones dan siempre el mismo resultado, en cualquier navegador (§4).
- **Nunca se persiste**: se calcula en el cliente a partir de `catalog.json`.

## 2. Diferencia de color

- **Fórmula**: ΔE CIEDE2000, de culori (`differenceCiede2000`), con los factores paramétricos kL = kC = kH = 1.
- **Espacio**: CIELAB con el blanco D65 (`lab65` de culori). El color de cada pintura se convierte una vez, al construir el índice (§5).
- **El color de la rueda es exacto**: lo genera la propia rueda, así que un resultado es aproximado solo si lo es el color de la pintura (`isColorApproximate`, docs/01 §4).
- **Entre dos hex**: `colorDifference` da el mismo ΔE entre dos colores cualesquiera. La web lo usa para saber si la rueda RYB alcanza el color de una pintura (docs/07 §15).

## 3. Etiquetas de calidad

Cada resultado lleva una etiqueta según su ΔE, redondeado a 2 decimales (§4). Los límites son inclusivos:

| ΔE2000   | Etiqueta (`MatchQuality`) | Significado                                      |
| -------- | ------------------------- | ------------------------------------------------ |
| ≤ 1      | `near-identical`          | Casi idéntica: por debajo de lo que se percibe   |
| ≤ 2      | `very-similar`            | Muy parecida: dentro de la tolerancia exigente   |
| ≤ 5      | `similar`                 | Parecida: dentro de la tolerancia menos exigente |
| más de 5 | `nearest-available`       | La más cercana: no se afirma que sea parecida    |

Los textos visibles de cada etiqueta los pone la web.

**Fuentes de los límites:**

- **1**: con kL = kC = kH = 1, un ΔE2000 de 1 se considera aproximadamente la diferencia mínima perceptible ([Wikipedia, «Color difference»](https://en.wikipedia.org/wiki/Color_difference); [MetricGate](https://metricgate.com/docs/delta-e-ciede2000/)). Hay quien la sitúa en 0,5 ([Graeme Gill, lista ColorSync, 2009](https://lists.apple.com/archives/colorsync-users/2009/Jul/msg00163.html)), pero es una opinión informal.
- **2**: Paravina et al. (2015) miden en ΔE2000 un umbral de perceptibilidad del 50 % de 0,8 y uno de aceptabilidad del 50 % de 1,8, con muestras dentales medidas ([Journal of Esthetic and Restorative Dentistry, DOI 10.1111/jerd.12149](https://doi.org/10.1111/jerd.12149)). La tolerancia habitual en impresión profesional es de 2 a 3 ([Hybrid Helix](https://blog.hybridhelix.com/?p=2470)).
- **5**: tolerancia aceptada en trabajos de color menos críticos ([Hybrid Helix](https://blog.hybridhelix.com/?p=2470)). Es una convención de la industria, sin norma CIE.

**Límites de esta interpretación:**

- Los umbrales salen de muestras medidas con instrumento y comparadas en condiciones controladas. Ninguna fuente da una tolerancia específica para miniaturas.
- Hoy todos los hex del catálogo son de origen comunitario: que dos hex estén a 0,8 no garantiza que las pinturas lo estén. Por eso cada resultado lleva además el aviso de color aproximado.

**Qué cabe esperar con el catálogo actual** (1393 pinturas, medido el 2026-11-18):

- Para una rejilla de 324 colores de la rueda (36 tonos y saturaciones y luminosidades HSL del 30, 60 y 90 % y del 25, 45 y 65 %), la mediana del ΔE a la pintura más cercana de cada marca está entre 5,5 y 6,0.
- Entre las pinturas opacas no metálicas, la más cercana de otra marca está a una mediana de 3,0 a 3,3, y solo entre el 2 % y el 5 % tienen otra a 1 o menos.

## 4. Orden

1. **El ΔE, redondeado a 2 decimales**, de menor a mayor. El redondeo evita que la última cifra de `Math.sin`, `Math.cos` o `Math.atan2`, que la especificación de JavaScript no fija, ordene distinto en dos navegadores. 0,01 está muy por debajo de la diferencia mínima perceptible (§3).
2. **El ID de la pintura**, comparado por unidad de código y sin _locale_, como las colecciones de docs/02 §1.

El color aproximado no cambia el orden: solo lleva el aviso. El tipo de pintura tampoco: se filtra (§6.1), no se ordena.

Ejemplos con datos reales:

- `#ffffff` lo comparten seis pinturas de AK. Empatan a 0 y salen por ID: Blood Effect, Chipping Effect, Frost Effect, Viscera Effect, Washable White Paint y White.
- Con `#cfa344`, Zamesi Desert está a 4,5760 y Ungor Flesh a 4,5801. Las dos redondean a 4,58, y Ungor Flesh va primero por su ID.

`deltaE2000` se devuelve sin redondear; la web lo muestra con la precisión que quiera.

## 5. Índice

- **Contenido**: todas las pinturas con color, también las descatalogadas, que filtra la búsqueda (§6.1), agrupadas por marca en el orden del catálogo y, dentro de cada marca, por ID. Cada una lleva su color ya convertido a CIELAB.
- **Excluye**: las pinturas sin color (docs/01 §3).
- **Una vez por catálogo**: la web lo construye al cargar `catalog.json` y lo reutiliza en cada búsqueda.
- **Es opaco**: solo lo leen las funciones de este módulo.

## 6. Búsqueda

Las funciones, sus opciones, sus resultados y sus errores, con sus valores válidos y por defecto, están en la referencia de la API, que se genera desde el código con `pnpm docs:api` ([README](../README.md#comandos)). Esta sección recoge solo las reglas de comportamiento. Los resultados están congelados (`Object.freeze`).

### 6.1. Por marca

- **Color**: `#rrggbb`, en mayúsculas o minúsculas, como los que da la rueda (docs/05 §6.4). Otro formato es un error.
- **Marcas**: las marcas activas, en cualquier orden y con repeticiones; el resultado sigue el orden del catálogo. Un ID que no está en el catálogo se ignora, como en el agregado del catálogo. También se puede buscar en todas.
- **Candidatas**: por defecto, solo las pinturas opacas no metálicas (base, capa, estándar y pincel seco): son las que se aplican como el color plano de la rueda. Los contrast, lavados, tintas, veladuras, technical y metálicas se añaden a petición.
- **Descatalogadas**: por defecto no, porque ya no se pueden comprar, pero quien las tenga puede pedirlas.
- **Por marca**: las primeras candidatas en el orden de §4, hasta un límite, que por defecto es 3. Una marca seleccionada sin candidatas sigue en el resultado, sin pinturas, para que la interfaz lo pueda decir.
- **Límite**: un entero positivo. 0, un negativo, un decimal, `NaN` o `Infinity` son un error.
- **Resultado**: cada pintura con su marca, su ΔE (§4), su etiqueta de calidad (§3) y si su color es aproximado (§2).

Ejemplo con datos reales: con `#3daf44` (el hex de Moot Green) y el filtro por defecto, Citadel da Moot Green (0), Sybarite Green (9,69) y Orruk Flesh (10,61). Con todos los tipos, da Moot Green, Tesseract Glow (technical, 2,71) y Hexwraith Flame (contrast, 4,80).

### 6.2. Todas las marcas juntas

Junta los resultados de todas las marcas en una lista, con el orden de §4, sin recalcular ningún ΔE.

Devuelve como mucho tantos resultados como el límite de la búsqueda. Más allá de esa posición, el orden no sería fiable: una marca podría tener una pintura mejor que la búsqueda no devolvió porque solo trae ese límite por marca. Para ver las N más parecidas de todas las marcas, hay que buscar con un límite de N o más.

Ejemplo con datos reales: con `#3daf44`, todas las marcas y el filtro por defecto, da Moot Green (Citadel, 0), Ferocious Green (Army Painter, 7,44) y Clear Green (AK, 7,55).

### 6.3. Pintura fijada

La pintura de la que sale el color, cuando se eligió en el buscador (docs/07 §15, [ADR-0029](adr/0029-buscador-pinturas-mvp.md)):

- **Va la primera de su marca**, sea cual sea su ΔE, y no se repite más abajo. Ocupa uno de los huecos del límite, no uno más.
- **Aunque los filtros la excluyan**: por su tipo, por metálica, por descatalogada, o porque su marca no está entre las elegidas. En ese caso su marca aparece en el resultado, en su sitio del orden del catálogo.
- **También la primera de todas las marcas juntas** (§6.2).
- **Lleva una marca** en el resultado, para que la interfaz la distinga.
- Un ID que no está en el catálogo, o una pintura sin color, se ignora.

Ejemplo con datos reales: Hammered Copper (Vallejo, `#dccfc7`) es metálica, así que el filtro por defecto la excluye. Fijada, sale la primera de Vallejo con ΔE 0, seguida de Silver Grey (2,0) y Cream White (2,9).

## 7. Rendimiento

Medido el 2026-11-18 en un Intel i5-12600 de escritorio con Node 26 y culori 4.0.2, con 6 colores contra el catálogo de 1393 pinturas, como la web en cada cambio de la rueda. Son 200 repeticiones, después de 20 de calentamiento:

| Operación                                       | Mediana | Percentil 95 |
| ----------------------------------------------- | ------- | ------------ |
| `buildPaintIndex`, una vez                      | 2,7 ms  | —            |
| 6 búsquedas y `rankOverall`, filtro por defecto | 1,8 ms  | 2,3 ms       |
| 6 búsquedas y `rankOverall`, todos los tipos    | 2,8 ms  | 3,3 ms       |

Comparando los hex sin el índice, las 6 búsquedas tardaban 6,7 ms. No hay medidas en un móvil.

## 8. Uso en la web

La web construye el índice al cargar el catálogo y busca con el resultado de la rueda. Cómo se eligen las marcas, los tipos y las descatalogadas, la vista «Por marca» o «Las más parecidas», qué muestra cada pintura y el aviso de color aproximado están en [docs/07](07-web.md) §1-3. El buscador de pinturas, en §15.

## 9. Búsqueda por nombre

Encuentra pinturas por lo que se escribe, para empezar la rueda desde una pintura que se tiene ([ADR-0029](adr/0029-buscador-pinturas-mvp.md)). Tiene su propio índice, que la web construye al cargar el catálogo, con todas las pinturas con color, también las descatalogadas: quien tiene una puede empezar por ella.

### 9.1. Qué encuentra

- **Dónde busca**: en el nombre de la pintura, sus alias, su código del fabricante, el nombre de su marca y sus alias, y el nombre de su gama.
- **Cada palabra escrita** tiene que estar en alguno de ellos, en cualquier orden y por fragmentos: `tigers skin` encuentra «Tiger's Eye Skin», y `vallejo black`, las Black de Vallejo.
- **Sin distinguir** mayúsculas, acentos ni apóstrofos. En el código tampoco cuentan los puntos, los guiones, las barras ni los espacios: `70950` encuentra `70.950`.
- **Desde 3 caracteres**, contados como los cuenta una persona (`isSearchable`) y sin los espacios de alrededor. Con menos, no busca: con «re» coinciden 492 pinturas.
- **Sobre todo el catálogo**: no aplica los filtros de los resultados (§6.1), que deciden qué pinturas se proponen como parecidas, no cuáles existen.
- **Dónde coincide**: cada resultado dice en qué tramos del nombre, la marca, la gama y el código está lo escrito, para resaltarlo. Lo que coincide en un alias no se resalta, porque el alias no se muestra.
- La tolerancia a las faltas de ortografía (`boney` encuentra «Bony») queda para después.

### 9.2. Orden

1. El nombre, un alias o el código es exactamente lo escrito: «Red» al escribir `red`, o `70.950` al escribir `70950`.
2. El nombre, un alias o el código empieza por lo escrito: «Red Leather».
3. Cada palabra escrita empieza una palabra del nombre o de un alias: «Mephiston Red».
4. Cada palabra escrita está dentro del nombre o de un alias: «Bloodred».
5. Alguna palabra solo está en la marca, la gama o el código.

Dentro de cada grupo, por nombre, marca y gama, sin acentos ni mayúsculas, y al final por ID, comparados por unidad de código y sin _locale_, como §4.

Cuando la búsqueda tolere faltas de ortografía, este orden pasará a ser por pesos según el dato que coincide. Está en una función aparte para poder sustituirla sin tocar la web.

### 9.3. Rendimiento

Busca en el índice en memoria, de forma síncrona. Medido el 2026-11-21 en el mismo equipo que §7, con 7 búsquedas distintas («red», «lothern», «vallejo black», «70950»…) repetidas 300 veces después de 50 de calentamiento, sobre las 1393 pinturas: mediana de 0,16 ms y percentil 95 de 0,33 ms. Está muy por debajo de un fotograma (16 ms), así que la web no necesita retardo ni descartar búsquedas antiguas. No hay medidas en un móvil.

## 10. Equivalencias oficiales de una pintura

Lo que los fabricantes afirman en sus cartas ([ADR-0004](adr/0004-equivalencias-dirigidas.md)), para mostrarlo con la misma fila que las pinturas parecidas sin mezclarlo con ellas ([docs/07](07-web.md) §16):

- **Las dos direcciones, por separado**: las salientes, cuyas aristas salen de la pintura, y las entrantes, que llegan a ella. Una arista solo se lee en su dirección: no se infieren ni las inversas ni las transitivas.
- **Una entrada por cada otra pintura**, con todas las fuentes que afirman esa arista, en el orden del catálogo. Las entradas van en el orden del catálogo de la otra pintura, así que salen agrupadas por marca.
- **Medida contra un color**, el de la rueda, con el ΔE, la etiqueta de §3 y el aviso de color aproximado, como un resultado de §6. Una pintura sin color sale igual, sin ΔE ni etiqueta.
- **Sin filtros ni límite**: son lo que dice la fuente, no candidatas.
- Un color que no es `#rrggbb` es un error esperable; una pintura que no está en el catálogo, un error de programación.

La firma de `findOfficialEquivalences` está en la referencia de la API, que se genera con `pnpm docs:api` ([README](../README.md#comandos)).
