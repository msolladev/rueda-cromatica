# ADR-0022: Búsqueda de las pinturas parecidas

- **Estado:** aceptada
- **Fecha:** 2026-11-18

## Contexto

docs/01 dejaba para la fase 4 los umbrales y el orden de las equivalencias calculadas. La web buscará, para cada color de la rueda (hasta 6), las pinturas más parecidas de las marcas activas, sobre unas 1400 pinturas.

Medido sobre el catálogo actual:

- Para una rejilla de 324 colores de la rueda, la pintura más cercana de cada marca está a una mediana de 5,5 a 6,0 de ΔE2000. Las fuentes sitúan la diferencia perceptible en torno a 1 y la aceptable en torno a 2 (docs/06 §3).
- Los 1393 hex son de origen comunitario, así que todas las pinturas tienen el color aproximado.
- Algunos tipos de pintura tienen un hex que no representa cómo quedan sobre la miniatura: lavados, tintas, contrast, technical y metálicas. Con `#ffffff`, entre las primeras de AK salen cuatro technical (Blood Effect, Chipping Effect, Frost Effect y Viscera Effect).

## Decisión

La especificación está en [docs/06](../06-pinturas-parecidas.md).

- **Resultados agrupados por marca**, con un `limit` por marca (3 por defecto) y filtrados por las marcas que elige el usuario.
- **Vista sin distinguir marca**: `rankOverall` junta los resultados de la búsqueda con el mismo orden y devuelve como mucho `limit`, las posiciones que puede ordenar con seguridad. El usuario elige la vista en la web.
- **Sin umbral que oculte resultados.** Cada resultado lleva una etiqueta de calidad por tramos de ΔE (≤ 1, ≤ 2, ≤ 5 y más de 5), con los límites tomados de las fuentes.
- **Orden**: ΔE redondeado a 2 decimales y, en los empates, el ID de la pintura.
- **El color aproximado no cambia el orden**: solo lleva el aviso.
- **El tipo de pintura es un filtro**, que elige el usuario. Por defecto, solo las opacas (base, layer, standard y dry) y no metálicas.
- **Índice propio en `matching`**: `buildPaintIndex` convierte una vez el color de cada pintura a CIELAB. Lo construye la web al cargar el catálogo.

## Alternativas descartadas

- **Un único orden global en lugar de agrupar por marca**: una marca con muchas pinturas cercanas tapa a las demás, y el orden entre marcas aparenta una precisión que los hex comunitarios no tienen. El resultado por marca contiene el global, pero el global no garantiza nada por marca.
- **Una sola función con la vista como parámetro**: el tipo que devuelve dependería del parámetro, y cambiar de vista volvería a calcular todos los ΔE.
- **Un umbral que oculta resultados**: con el catálogo actual dejaría sin resultados a cada marca en más de la mitad de los colores de la rueda, y ninguna fuente da la cifra de corte. Un tope alto tampoco tiene fuente.
- **Desempatar por nombre**: un nombre puede cambiar al curar los datos y dos pinturas pueden llamarse igual (Dawnstone en layer y en dry).
- **Desempatar por tipo de pintura**: solo actuaría en los empates exactos, así que una diferencia de 0,01 cambiaría qué regla se aplica.
- **Comparar el ΔE sin redondear**: la última cifra de las funciones trigonométricas puede variar entre navegadores y cambiar el orden.
- **Poner detrás las pinturas aproximadas, o penalizar su ΔE**: hoy no cambia nada, porque todas lo son. Con colores medidos, una pintura medida lejana pasaría delante de una comunitaria casi idéntica, y la penalización no tiene fuente.
- **Ordenar por tipo en lugar de filtrar**: una opaca lejana iría delante de un contrast casi idéntico.
- **Filtro de tipos fijo en el dominio**: quien pinta con Contrast no podría elegirlos.
- **Precalcular el color dentro del agregado `Catalog`**: `catalog` dependería de la conversión de color, al revés de lo que fija el ADR-0018 (`matching` depende de `catalog`).
- **No precalcular**: las 6 búsquedas tardaban 6,7 ms en escritorio, frente a 1,8 ms con el índice. Es mucho margen de los 16 ms de un fotograma si la web actualiza los resultados mientras se arrastra.

## Consecuencias

- `domain` depende de culori, con la versión del `catalog:` del workspace.
- docs/01 §4 deja de definir `CalculatedMatch` y remite a docs/06.
- La etapa 5 incluye el selector de vista y el filtro de tipos, además del de marcas.
- Cuando haya colores medidos (fase 5), conviene revisar las etiquetas y el trato de los aproximados con datos reales.
