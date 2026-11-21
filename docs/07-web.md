# Web

Este documento especifica `apps/web`: la PWA que integra la rueda de `color-wheel` y busca, para cada color, las pinturas más parecidas del catálogo con `domain`. La web solo presenta ([ADR-0018](adr/0018-organizacion-codigo-patrones.md)): la lógica de color está en `color-wheel` y la del catálogo y la búsqueda, en `domain`. Por qué se decidió así está en el [ADR-0024](adr/0024-web.md).

## 1. Maquetación

- **Un único marcado**, _mobile first_, que se adapta con CSS:
  - En el móvil, una columna: la barra de navegación, el banner de instalar (§8), el título, que dice qué se hace en la página («Encuentra la pintura de cada color de tu esquema») y no repite el nombre de la barra, el buscador de pinturas (§15), la rueda con sus controles y los resultados.
  - Desde 60rem de ancho, el buscador y la rueda a la izquierda, fijos al desplazar, y los resultados a la derecha. Fija, la rueda cabe entera en la pantalla: el círculo encoge (entre 14 y 26rem) para dejar sitio al buscador y a sus controles.
- **La lista de colores de la rueda se oculta** (`hideControl("results")`): la web muestra los colores en sus pestañas, y así cada color aparece una vez.
- **Resultados**, en este orden:
  1. El selector «Mostrar», siempre visible: «Por marca» o «Las más parecidas».
  2. Los filtros, en un desplegable (`<details>`) con un resumen de lo activo: «todas las marcas · opacas · sin descatalogadas». Dentro, las marcas, los tipos que se pueden añadir con las metálicas, y las descatalogadas. Por defecto, todas las marcas, solo las opacas no metálicas y sin descatalogadas (docs/06 §6.1).
  3. El aviso de color aproximado (§3).
  4. Una pestaña por color de la armonía, con su muestra y su nombre: el papel, numerado si se repite («Tríada 1», «Tríada 2»), como en las marcas de la rueda (`colorNames` de `color-wheel`). La rueda señala el color de la pestaña elegida, con un anillo en su marca y su nombre (`highlightColor`); al pasar el ratón o el foco por otra pestaña, señala la de esa mientras tanto. En el móvil se quedan fijas bajo la barra de navegación al desplazar. Si no caben, se desplazan de lado, y en cada lado con pestañas ocultas aparece un degradado del fondo con una flecha (`chevron-left` y `chevron-right` de Lucide), que se desvanece al llegar a ese extremo; pulsada, desplaza la fila. Las flechas no están en el orden del teclado, que recorre las pestañas con las suyas. Se recorren con las flechas, Inicio y Fin (patrón `tablist`).
  5. La leyenda de la muestra partida (§2), una línea de texto sin recuadro.
  6. El panel del color elegido.
- **Pinturas por marca**: 3, con un botón «Ver más pinturas» que añade 3 cada vez a esa marca, y «Ver menos», que vuelve a las 3 primeras. En «Las más parecidas», lo mismo con la lista conjunta. Lo pedido con «Ver más» se reinicia al cambiar de color, de vista o de filtros. Una marca sin candidatas dice «Sin pinturas con estos filtros», y sin ninguna marca elegida, el panel pide elegir una.
- **Debajo**, las armonías explicadas, con el nombre que les da la rueda: en una columna o, desde 60rem de ancho, en tres de tres, para que ninguna quede sola en la última fila.
- **Movimiento**, que responde a cada acción sin estorbar:
  - El marco de la pestaña elegida se desliza hasta la nueva, su muestra crece un poco y la pestaña se hunde al pulsarla. El marco es un único elemento que un poco de JavaScript coloca midiendo la pestaña, para que funcione en todos los navegadores; sin JavaScript, la pestaña se marca sola. El marco se dibuja encima del borde, así que la pestaña no cambia de tamaño.
  - Los selectores segmentados («Mostrar», el tema, y «Modelo» y «Luz» de la rueda) son el mismo control, con el mismo aspecto: un marco con la opción elegida como una pastilla dentro, que se desliza hasta la nueva. Se coloca igual que el marco de las pestañas, midiendo la opción con JavaScript, para que funcione en todos los navegadores.
  - Al elegir otra pestaña, sus filas entran con un fundido corto y escalonado; las que añade «Ver más pinturas» entran una tras otra mientras la lista crece con suavidad hasta su nueva altura, y las que quita «Ver menos» se desvanecen mientras la lista se recoge, antes de desaparecer. Cuando los colores cambian de golpe (el campo Hex, el buscador, «Volver a…», el modelo o la armonía), las filas entran igual que al cambiar de pestaña. Las filas que cambian mientras se arrastra la rueda no se animan.
  - Los desplegables (filtros, «Detalles» y los de créditos y errores) se abren animando su altura donde el navegador lo admite, y su flecha (`chevron-down` de Lucide) gira.
  - Las casillas de los filtros son propias: al marcarlas, la caja se rellena con un pequeño rebote y la marca (`check` de Lucide) se dibuja de izquierda a derecha, como a bolígrafo; al desmarcarlas se borra igual. Con colores forzados vuelven a ser las del sistema.
  - Los colores de la rueda (las muestras de las pestañas, del panel y la mitad de arriba de las muestras partidas) se funden con el nuevo al cambiar en el mismo tiempo y con la misma curva con que la rueda viaja a su nuevo sitio (450 ms, docs/05 §6.2), para que lleguen a la vez; mientras se arrastra la rueda cambian al momento.
  - Cuando una armonía trae más colores, las pestañas nuevas entran creciendo un poco; cuando trae menos, las que sobran se desvanecen donde estaban antes de irse.
  - Las pestañas, fijas bajo la barra, llevan una línea fina y una sombra (más intensa en tema oscuro) solo mientras están fijas, para despegarse de lo que pasa por debajo. Se comprueba al desplazar, como mucho una vez por fotograma.
  - Al abrir «Detalles», sus datos entran uno tras otro, como las filas.
  - Al cambiar un filtro, su resumen da un pequeño salto en el color del acento, también con el desplegable cerrado.
  - Los enlaces llevan un subrayado fino y suave. Al pasar el ratón o llegar con el teclado, una franja de su color crece por debajo desde la izquierda, como un rotulador, y el texto se oscurece un poco; al salir, la franja se recoge hacia la derecha. En los enlaces externos, la flecha del icono `external-link` sale hacia arriba y a la derecha y vuelve con un pequeño rebote. «Ver más pinturas» y «Ver menos» llevan delante `plus` y `minus` de Lucide, que giran media vuelta despacio. Los enlaces con forma de caja se hunden al pulsarlos.
  - Los botones de las acciones principales («Actualizar», «Reintentar», «Instalar», «Ir a la rueda») son todos iguales: rellenos del acento, con el radio de los demás controles y sin sombra. Se aclaran al pasar el ratón y, si llevan una flecha, esta se adelanta.
  - Los botones se hunden al pulsarlos, y las filas se resaltan al pasar el ratón con una banda del mismo ancho que sus separadores.
  - Al pasar el ratón, todo lo que se puede pulsar responde, y solo en dispositivos con ratón (`hover: hover`), para que en el móvil no se quede marcado tras tocar. Las pestañas sin elegir oscurecen su borde y su muestra crece un poco. La barra de los filtros se resalta como las filas y su flecha toma el acento. Los demás desplegables (el aviso de color aproximado, «Detalles» y las licencias) se subrayan como un enlace. Los selectores segmentados marcan la opción no elegida con una pastilla tenue, y los `<select>` oscurecen su borde y su flecha, como los controles de la rueda (docs/05 §6.3).
  - Sin movimiento si el sistema pide reducirlo (`prefers-reduced-motion`).

## 2. Cada pintura

- **A primera vista**: la muestra partida, el nombre, la gama (con la marca delante en «Las más parecidas»), las fichas del tipo, «Metálica» y «Descatalogada» si lo es, «Elegida» si es la pintura del buscador (§15), con el color del acento y un pequeño rebote al aparecer, y la etiqueta de calidad (docs/06 §3) con el ΔE de un decimal al lado («La más cercana | ΔE 7,6»), como una pastilla con un color por nivel (verde, verde claro, ámbar y gris), con contraste de al menos 6:1 en los dos temas. El texto siempre dice el nivel, así que no depende solo del color. Por debajo de la etiqueta, una barra de cercanía tan larga como cerca está la pintura: entera con ΔE 0, la mitad con ΔE 5 (el final de «Parecida») y cada vez más corta después, sin llegar a desaparecer (1 / (1 + ΔE / 5)). Crece al aparecer la fila y sigue los cambios. Es decorativa: el dato está en el texto. El nombre ocupa todo el ancho y la etiqueta va junto a las fichas, a la derecha, para que no lo estreche.
- **En «Detalles»** (`<details>`): el código del fabricante, el hex con su fuente y su origen («#3daf44, de SimoGecko (comunitario)»), que es la fuente breve del color que pide el [ADR-0015](adr/0015-fuentes-trazabilidad-licencias.md), y la razón de que el color sea aproximado (`colorApproximationReasons`) o «Exacto».
- **Muestra partida**: arriba el color de la rueda y abajo el de la pintura, para compararlos sin mover la vista. Es decorativa: su información está en el texto.

## 3. Aviso de color aproximado

Se decide con las pinturas que muestra el panel:

- **Si todas son aproximadas** (hoy siempre, porque todos los hex son comunitarios): un aviso general, sin marcar ninguna pintura.
- **Si se mezclan**: el aviso explica la ficha «≈ Aproximado», y solo la llevan las aproximadas.
- **Si ninguna lo es**: sin aviso.

El aviso es una sola línea con el icono `info` de Lucide («Los colores son aproximados ≈»), que se despliega con la explicación. Enlaza a «Créditos y fuentes» y no nombra las fuentes. La razón concreta de cada pintura está en sus «Detalles».

## 4. Cuándo se actualizan los resultados

Con `change` y también con `input`, con prioridad baja (`useDeferredValue` de React): la rueda se dibuja primero y los resultados la siguen cuando hay tiempo. Al soltar, `change` asegura el resultado final.

Medido el 2026-11-18 en Chromium con un i5-12600, con la CPU ralentizada para simular móviles, un arrastre de 120 pasos y el panel completo (mediana por paso, en ms):

| Operación                     | CPU normal | CPU ÷4 | CPU ÷6 |
| ----------------------------- | ---------- | ------ | ------ |
| Búsqueda (armonía y un color) | 0,8        | 2,3    | 3,6    |
| Pintado del panel en React    | 1,1        | 3,6    | 5,5    |
| Redibujado de la rueda        | 1,5        | 5,4    | 8,1    |
| Total                         | 3,5        | 11,4   | 17,4   |

En un móvil de gama baja (÷6) el total pasa de un fotograma (16,7 ms): por eso los resultados van con prioridad baja y la rueda no. No hay medidas en un móvil real.

## 5. Estado e integración con la rueda

- **La rueda no está controlada por React.** Un componente envoltorio la crea al montarse, con el color y la armonía de partida, y la destruye al desmontarse. React solo guarda el último resultado de sus eventos. La web escribe en la rueda en un único caso: al recuperar las preferencias guardadas, una vez. Nunca responde a un evento escribiendo en la rueda, así que no hay bucles.
- **El estado de la pantalla** (filtros, vista, pestaña, «Ver más», tema, idioma elegido, banner cerrado y la rueda a recordar) es un reductor en TypeScript puro, sin React, que React usa con `useReducer`. Sus reglas se prueban sin navegador. No hay librería de estado.

## 6. Preferencias

Se guardan en `localStorage`, en una clave con la versión del formato:

- las marcas desactivadas (no las activas, para que una marca nueva salga por defecto);
- los tipos añadidos, las metálicas y las descatalogadas;
- la vista, el tema y el idioma elegido;
- si se cerró el banner de instalar;
- el color, el modelo, la armonía y la luz de la rueda, al cambiar (no mientras se arrastra);
- la pintura elegida en el buscador, con su hex, mientras sea la base (§15). «Volver a…» no se guarda.

No se guardan la pestaña, lo pedido con «Ver más» ni si el desplegable está abierto. Lo leído se valida: si no es válido, se descarta entero. Un `localStorage` bloqueado o lleno se ignora.

Se aplican después de que el navegador tome la página (§10), porque el HTML prerenderizado es igual para todos. Para que no se vean un instante los valores por defecto, el script en línea del `<head>`, si hay preferencias guardadas, marca `<html data-restoring>`, y la rueda y los resultados quedan ocultos hasta que tienen el estado guardado y las pinturas buscadas con él. Si algo falla, el CSS los muestra a los 3 segundos. Sin preferencias guardadas (la primera visita, los buscadores) no se oculta nada.

En la fase 6 las preferencias pasarán a la cuenta del usuario ([ADR-0017](adr/0017-arquitectura-objetivo-backend.md)).

## 7. Carga del catálogo y errores

- **La rueda funciona desde el principio**; solo los resultados esperan al catálogo. Mientras se descarga, el panel muestra el ejemplo prerenderizado si nada ha cambiado, o unas filas grises con la forma de los resultados y un brillo que avanza, que se anuncian como «Cargando las pinturas…» a los lectores de pantalla.
- **Si falla, el error ocupa el panel** y la rueda sigue funcionando. Nunca se usa un catálogo a medias (docs/02 §5).

| Causa                                              | Mensaje                                                                                                                                                 | Acción            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Sin red (primera visita sin conexión) o error HTTP | **No se han podido descargar las pinturas.** Comprueba la conexión.                                                                                     | Reintentar        |
| `unsupported-schema-version`                       | **Hay una versión nueva de la aplicación.** Actualiza para ver las pinturas.                                                                            | Actualizar (§8)   |
| JSON mal formado, `invalid-structure`, `integrity` | **Los datos de las pinturas tienen un problema.** La rueda sigue funcionando, pero no se pueden buscar pinturas parecidas. Recarga la página más tarde. | Detalles técnicos |

## 8. PWA

- **Precaché**: todas las páginas de todos los idiomas, el código, los iconos y `catalog.json`. Después de la primera visita, todo funciona sin conexión. Cada página se guarda con su dirección (`/es/`), no con el nombre de su fichero, que no es una dirección (§12): el service worker la descarga por esa dirección al instalarse, así que el servidor tiene que responderla con el estado 200, o la instalación falla entera. «Página no encontrada» no se guarda, porque no tiene dirección propia.
- **Versión nueva** (de la web o del catálogo, que llegan igual): un aviso no modal, «Hay una versión nueva», con «Actualizar», con el mismo diseño que el banner de instalar (marco, icono `refresh-cw` de Lucide, que gira al pasar el ratón por el botón, y apertura animada). Sale también en una pestaña normal del navegador, no solo en la aplicación instalada: el service worker guarda la web en los dos casos. Si no se pulsa, se aplica la próxima vez que se abra la web. La primera versión controla la página en cuanto se instala.
- **Instalar**:
  - Un banner, el primer elemento bajo la barra, en el flujo de la página y no modal, que **llega con la página**: está siempre en el HTML prerenderizado, y el script en línea del `<head>` lo muestra antes del primer pintado (`<html data-install>`) si el navegador instala aplicaciones web (Chromium, que tiene `onbeforeinstallprompt`, o Safari en iOS, que tiene `navigator.standalone`), no está instalada y no se cerró antes. Así nunca aparece tarde ni desplaza la página. En Firefox de escritorio, que no instala aplicaciones web, no sale.
  - Lleva el icono de la web, qué se instala («Instala la Rueda cromática») y por qué, el botón «Instalar» y, en la esquina, un cierre discreto de su misma altura; en pantallas estrechas el botón va bajo el texto. En Safari en iOS, en vez del botón, los pasos para añadirla a la pantalla de inicio.
  - «Instalar» abre el diálogo del navegador (`beforeinstallprompt`). Chromium no lo ofrece hasta que la persona ha usado un poco la página; si se pulsa antes, el banner explica cómo instalarla desde el menú del navegador.
  - Al cerrarlo se pliega y no vuelve; al instalarla, desaparece. El pie sigue ofreciendo «Instalar la aplicación» mientras el navegador permita instalarla.
  - El servidor de desarrollo sirve los manifiestos, pero no tiene service worker: la web instalada desde él no funciona sin conexión.
  - Un botón discreto «Instalar la aplicación» en el pie, para quien cambie de opinión. En iOS, muestra las instrucciones («Compartir» y «Añadir a pantalla de inicio»).
- **Manifiesto, uno por idioma** (`/es/manifest.webmanifest`…), porque un manifiesto no se puede traducir dentro de un mismo fichero. Cada página enlaza el de su idioma, y `/`, el inglés. La aplicación instalada se llama como la web en el idioma desde el que se instala, también bajo el icono («Rueda cromática», «Chromatic Wheel»…), y se abre en ese idioma. Todos comparten el mismo `id`, así que el navegador los toma por una sola aplicación. Su fondo y su color de tema son los del tema oscuro (`#121417`): Android pinta con ellos la pantalla de arranque de la aplicación instalada, el manifiesto no admite un color por tema, y un destello blanco en el modo oscuro molesta más que uno oscuro en el claro. La página pone los de su tema en cuanto carga. Los escribe el build, y el servidor de desarrollo sirve los mismos.
- **Iconos**: la rueda de 12 tonos con el magenta arriba y el triángulo, con un degradado del acento de la web en la punta a un gris en la base. No lleva el blanco y el negro de la rueda porque la esquina negra se perdería en el fondo oscuro. Están en `public/icons/`, en SVG y en PNG de 192 y 512 px, y en versión _maskable_; los PNG se generan a partir del SVG. El icono no puede leer el CSS de la página, así que lleva el acento escrito en hex, y un test comprueba que coincide con el `--accent` de `app.css`.

## 9. Idiomas

- **Los mismos 13 que la rueda** ([ADR-0027](adr/0027-lenguas-cooficiales-espana.md)), con la misma detección (`resolveLocale` de `color-wheel`). La rueda y la web van siempre en el mismo idioma.
- **Los textos de la web** están en un diccionario tipado: si falta un texto en un idioma, no compila. Un test comprueba además que ninguno está vacío y que todos conservan los marcadores (`{count}`…). Los nombres de las armonías y los papeles salen de la rueda (`labelsFor` y `colorNames`). Los nombres de las pinturas no se traducen.
- **El selector de idioma** muestra cada idioma en su propio idioma, con el rótulo bilingüe «Idioma · Language». Al cambiarlo, carga la misma página en el otro idioma y lo recuerda.
- **Riesgo conocido**: los textos de 11 idiomas los escribió Claude y nadie los ha revisado. Solo el castellano y el inglés están revisados.

## 10. Prerenderizado y SEO

- **Cada página de cada idioma se prerenderiza en el build** como su propio `index.html`, con React en Node. El navegador toma ese HTML (`hydrateRoot`) con los mismos datos, que van en la propia página (`<script type="application/json">`).
- **Sin JavaScript** se ven los metadatos, los textos fijos, las armonías explicadas, un ejemplo real completo (el color de partida, los 6 colores de su esquema de miniatura y las pinturas de cada marca, calculados en el build) y los créditos completos. Los 6 colores salen seguidos, como secciones. En el sitio de la rueda, el aviso «La rueda interactiva necesita JavaScript».
- **En el primer render no se lee nada del navegador** (preferencias, idioma del navegador, catálogo): lo que depende de él se aplica justo después (§6). Un test renderiza todas las páginas en Node para garantizarlo.
- **En desarrollo**, el servidor renderiza cada página igual, y pone en el `<head>` como `<link>` los CSS que importa la web. Vite los añadiría desde JavaScript, y la página se vería un instante sin estilos.
- **Cabecera de cada página**: título y descripción en su idioma, `lang`, URL canónica, `hreflang` a los otros 9 idiomas y `x-default` a `/`, metadatos para compartir (Open Graph y la tarjeta de X) y, en la principal, datos estructurados `WebApplication`.
- **`sitemap.xml`** con las alternativas de idioma, y **`robots.txt`**.
- **El origen del sitio** (para las URL absolutas) lo da la variable `SITE_ORIGIN` al compilar. Sin ella, el de `vite preview`.
- **CSP** en una etiqueta `<meta>`: solo scripts propios y el script en línea del `<head>` (§6 y §11), autorizado por su hash. Los estilos en línea se permiten porque las muestras del HTML prerenderizado llevan su color en el atributo `style`.

## 11. Barra de navegación y tema

- **Barra translúcida**: donde el navegador lo admite (`backdrop-filter`), el fondo de la barra es ligeramente transparente y desenfoca lo que pasa por debajo; en el resto, opaco. El cristal es una capa detrás de su contenido que asoma 2 px por encima, para cubrir el redondeo de las pantallas escaladas.
- **Barra fija arriba**: el icono de la web (el del favicon) y el nombre a la izquierda, que llevan a la principal; a la derecha, el idioma y el tema, sin etiqueta visible (la tienen para los lectores de pantalla). En pantallas estrechas, el idioma y el tema se recogen, con sus etiquetas, en un menú hamburguesa que baja de la barra sobre un velo oscuro que tapa la página, como un diálogo: la página de detrás queda inerte, y el menú se cierra con Esc, con el botón o tocando el velo. Admite más enlaces en el futuro.
- **Saltar la barra**: el primer Tab muestra «Saltar a la rueda» y el segundo «Saltar a las pinturas» (en créditos, «Saltar al contenido»). Llevan el foco al primer control de su destino: el anillo de la rueda o el color elegido. Es el patrón estándar: cambiar el orden del foco para saltarse la barra rompería WCAG 2.4.3.
- **Tema**: el mismo selector segmentado que los de la rueda, con tres iconos (sistema, claro y oscuro), con su nombre accesible y su nombre en una etiqueta flotante al pasar el ratón o al llegar con el teclado. Lo aplica el atributo `data-theme` de `<html>`, y el CSS lo convierte en `color-scheme` para la web y en `--cw-color-scheme` para la rueda (docs/05 §6.6). Sin elección, el del sistema.
- **Iconos del tema animados**: cada icono hace su propio gesto. Al pasar el ratón por una opción no elegida, o al llegar con el teclado, el sol gira 45°, la luna se balancea y el monitor sube un poco, como si se encendiera; la opción elegida se queda quieta. Al elegirlo, los rayos del sol salen uno tras otro desde el centro, la luna da una vuelta entera y crece un poco antes de asentarse y el monitor se enciende: su pantalla se abre desde una línea, como una tele de tubo; al cargar la página no se anima ninguno. Al pulsar, el icono se hunde. Sin movimiento si el sistema pide reducirlo.
- **Cambio de tema**: el tema nuevo crece en un círculo desde la opción pulsada y, dentro del círculo, se funde con el anterior (View Transitions). Sin soporte o con movimiento reducido, cambia al momento.
- **Sin parpadeo**: cada página declara `<meta name="color-scheme" content="light dark">` antes de la hoja de estilos, para que el navegador no pinte en blanco mientras la carga, también al pasar de una página a otra. El script en línea (§6) aplica el tema guardado, en `data-theme` y en esa etiqueta, antes de pintar nada.
- **Color de acento**: magenta (`#be185d` en claro y `#f9a8d4` en oscuro, AA en los dos temas y con el texto de los botones). Es un primario de la mezcla sustractiva de pigmentos y queda lejos en la rueda del azul del foco, así que nunca se confunden.
- **Foco del teclado**: tiene su propio color (`--focus`), separado del acento (`--accent`) que usan los enlaces, la pestaña elegida, las casillas y el botón principal. Así el foco se distingue junto a lo pintado con el acento, y el acento puede cambiar sin tocarlo. Es el azul convencional del foco, con contraste AA en los dos temas, y la rueda lo toma también (`--cw-focus`), así que se define una sola vez.
- **Iconos**: `sun`, `moon`, `monitor`, `menu`, `x`, `info`, `external-link`, `plus`, `minus`, `arrow-left`, `refresh-cw`, `chevron-left` y `chevron-right` de Lucide, copiados como en `color-wheel`, con su aviso de licencia, y `chevron-down` en los desplegables y `check` en las casillas, dibujados en el CSS como en la rueda (docs/05 §6.6).

## 12. Páginas y rutas

| Página             | Ruta                                  |
| ------------------ | ------------------------------------- |
| Elegir idioma      | `/`                                   |
| Rueda y pinturas   | `/es/`, `/pt-br/`…                    |
| Créditos y fuentes | `/es/creditos/`, `/de/danksagungen/`… |

- **El idioma va delante**, en minúsculas (`pt-BR` → `/pt-br/`). El nombre de la página de créditos va en el idioma de la página (`CREDITS_SLUGS` de `pages.ts`), por el SEO: `creditos`, `credits`, `kredituak`, `danksagungen`, `crediti`… Ruso, chino, japonés y coreano usan `credits`, en inglés, para no mezclar dos alfabetos en la ruta.
- **Sin la `/` final**, cada página se sirve igual y con el estado 200, sin redirigir: `/es` muestra la página de `/es/`, también sin conexión. La URL canónica sigue siendo la de la `/` final, así que los buscadores no la cuentan dos veces, y los enlaces de la web son absolutos para que funcionen desde cualquiera de las dos. El servidor de desarrollo y `vite preview` responden igual, y el servidor estático de cada entorno tiene que configurarse para servir `<ruta>/index.html` sin redirigir.
- **El nombre del fichero no es una dirección**: `/es/index.html` redirige con un 301 a `/es/`, como hacen los alojamientos estáticos con las URL limpias, para que los buscadores unifiquen las dos. `/es/404.html` responde «Página no encontrada» con el estado 404. Lo hace el servidor estático de cada entorno; el servidor de desarrollo y `vite preview` no lo necesitan.
- **`/`** lleva al idioma guardado o al detectado sin pintar nada antes: la página queda en blanco hasta que redirige (y se muestra igualmente a los 3 segundos si la aplicación no llega a ejecutarse). Sin JavaScript, enlaza a los 13 idiomas.
- **Página no encontrada**: cualquier otra dirección responde con el estado HTTP 404 y la página «Página no encontrada», en el idioma de la dirección si empieza por uno (`/es/lo-que-sea/`) y en inglés si no, con un botón a la rueda de ese idioma. Su ilustración es una rueda de 12 tonos a la que le falta uno, con el 404 en el centro: al entrar, los tonos aparecen uno tras otro y una aguja, como la plantilla de la rueda, barre el anillo hasta el hueco y se queda buscando en él. Lleva `noindex` y no tiene URL canónica ni alternativas. El build la escribe en `dist/404.html` y `dist/<idioma>/404.html`; el servidor de desarrollo y `vite preview` responden igual, y el servidor estático de cada entorno tiene que configurarse para servir esos ficheros con el estado 404.
- **`sitemap.xml` y `robots.txt`**: los escribe el build, con las 27 páginas y sus alternativas de idioma, y el servidor de desarrollo sirve los mismos.
- **Enlaces normales**, sin router en el cliente: cada página es un HTML completo y, sin conexión, sale del precaché.
- **Fundido entre páginas**, en todos los navegadores: al pulsar un enlace a otra página de la web, o al cambiar de idioma, el contenido se funde hacia fuera y entonces se navega. La página nueva entra con un fundido, que el script en línea del `<head>` marca antes de pintar, solo si se llega desde un enlace de la web: al abrirla o al volver atrás aparece sin más. La barra de navegación no se anima. Los enlaces con una tecla modificadora, a otro sitio o con destino propio funcionan como siempre. Sin movimiento si el sistema pide reducirlo.

## 13. Créditos y fuentes

- **Fuentes del catálogo**: cada una con su título, quién la publica, su enlace, su copia archivada, su licencia, su atribución y la fecha de consulta, y lo que aporta: los colores de qué marcas y gamas, y cuántas sustituciones y equivalencias oficiales (`sourceContributions`). Todo sale de `catalog.json`. En pantallas estrechas cada dato va bajo su nombre.
- **Enlaces a otros sitios** (las fuentes, sus copias archivadas y los repositorios): se abren en una pestaña nueva, con `rel="noopener noreferrer nofollow"` para no pasarles autoridad en los buscadores, y llevan delante el icono `external-link` de Lucide. Su texto dice qué abren y dónde («Ver la fuente en github.com»), no la dirección entera, y los lectores de pantalla oyen además que se abren en una pestaña nueva.
- **Código de terceros**: cada paquete que acaba en el código distribuido (la web y el service worker), con su versión, su licencia, su repositorio y el texto de su licencia, plegado y en el idioma original. Además, los avisos `@license` del código propio (los iconos de Lucide). Un plugin de Vite los saca del bundle en cada build, así que la lista siempre coincide con lo que se distribuye.

## 14. Tests

- **Node**: el reductor, las preferencias, las rutas, la cabecera, la carga del catálogo, la búsqueda, los textos de los 13 idiomas, la plantilla HTML con la CSP, el plugin de licencias y el prerenderizado de las 27 páginas.
- **Navegador** (modo navegador de Vitest con Playwright): que el navegador toma el HTML prerenderizado sin diferencias, las pestañas con teclado y sus nombres numerados, los filtros, «Ver más», la vista, el tema, el menú con su velo, los enlaces para saltar la barra, las preferencias guardadas, el buscador de pinturas (las sugerencias desde 3 letras, «Ver más» con el teclado, la pintura elegida la primera de su marca aunque sea metálica, el aviso de RYB, «Volver a…» y la pintura guardada) y el error de red, con axe-core (WCAG 2.2 A y AA) en varios estados.
- **De extremo a extremo** (`@playwright/test`), en Chromium completo, no en la versión recortada para tests, que no pinta como un navegador real:
  - sobre la web compilada (en Chromium, y lo que no depende del service worker también en Firefox): que se sirven todas las rutas en su idioma, el fundido entre páginas, el contenido sin JavaScript, que `/` va al idioma detectado, el selector de idioma, que el tema guardado se aplica antes de pintar y que la página declara `color-scheme` antes de la hoja de estilos, que nunca se ven los valores por defecto con preferencias guardadas (fotograma a fotograma), el funcionamiento sin conexión y el aviso de versión nueva;
  - sobre el servidor de desarrollo: que cada página sale con sus estilos antes de que arranque el JavaScript, y que el navegador la toma sin errores.

## 15. Buscador de pinturas

Para empezar desde una pintura que se tiene: se busca y su color pasa a ser la base de la rueda ([ADR-0029](adr/0029-buscador-pinturas-mvp.md)). Qué encuentra y en qué orden está en docs/06 §9.

- **Encima de la rueda**, con el ancho máximo de la rueda: la etiqueta («Empieza por una pintura que tengas»), una línea de ayuda siempre visible («Al menos 3 letras del nombre, el código o la marca.») y el campo. Sin texto de ejemplo dentro del campo: no cabe en el móvil y desaparece al escribir.
- **Patrón _combobox_ con lista de sugerencias** de la APG, con `useCombobox` de [Downshift](https://github.com/downshift-js/downshift): Downshift da el estado, el teclado (las flechas, Intro y Esc) y el ARIA (`aria-expanded`, `aria-activedescendant`…), y la web, el marcado y el estilo. La web no controla el texto del campo, porque con el texto controlado Downshift rompe la escritura con IME (#1452). Salir del campo no elige nada.
- **Desde 3 caracteres**: con menos, la lista no se abre. El campo está desactivado hasta que el catálogo se carga.
- **Cada sugerencia**, de dos líneas:
  - la muestra (la de la web, cuadrada con las esquinas redondeadas); el nombre y, tras un «·», el tipo en cursiva y atenuado, con «metálica» si lo es («Hammered Copper · _Estándar, metálica_»);
  - debajo, en pequeño y atenuado, la marca, la gama y el código («Vallejo · Game Color · 72.059»), en el orden del bote.
  - Lo escrito va en negrita, en el nombre, la marca, la gama y el código (docs/06 §9.1).
- **8 sugerencias**, y una última, «Ver más pinturas (8 de 83)», con el aspecto de «Ver más pinturas» de los resultados, que añade 8 más; el foco pasa a la primera nueva, y las nuevas entran una tras otra. La lista flota sobre la página y solo se desplaza por dentro si se piden más de las que caben. Sin coincidencias, dice «Ninguna pintura coincide con lo escrito.».
- **Lector de pantalla**: una región `role="status"` dice cuántas hay («Pinturas: 8 de 83.») o que no hay ninguna, y al elegir, cuál es la base.
- **Al elegir una pintura**:
  - su hex pasa a la rueda, que viaja hasta él (docs/05 §6.2), y la web pasa a la pestaña Base;
  - el campo muestra el nombre, con la muestra de la pintura dentro, que aparece con un pequeño rebote, y debajo, la marca, la gama y el código, que el campo da como descripción;
  - en la pestaña Base, la pintura va la primera de su marca, y en «Las más parecidas», la primera de todas, aunque los filtros la excluyan, sin repetirse y con la ficha «Elegida» (docs/06 §6.3). La pastilla de la marca de la rueda sigue diciendo «Base»: con el nombre y la marca no cabría en el móvil.
- **Mientras la base sea la pintura**: cambiar de armonía, de luz o de modelo no la cambia. Arrastrar la rueda, usar sus teclas o el campo Hex sí: el campo se vacía y, donde estaban la marca y la gama, aparece «Volver a Lothern Blue», que la vuelve a elegir. La «×» del campo lo vacía y olvida la pintura, sin mover la rueda.
- **Si la rueda RYB no alcanza la pintura** (ΔE mayor que 1 entre su hex y la base, `colorDifference` de docs/06 §2), bajo el campo, con el aspecto del aviso de color aproximado: «La rueda RYB no llega a este color: usa el más parecido (ΔE 8,6). Usar la rueda digital». El enlace cambia el modelo y la base vuelve a ser la pintura exacta ([ADR-0021](adr/0021-cambio-modelo-conserva-color.md)). Con el catálogo actual pasa con 124 pinturas, sobre todo cianes y azules intensos.
- **Sin JavaScript** el campo sale desactivado, con su etiqueta y su ayuda.

## 16. Prototipos

Artifacts privados de claude.ai, hechos al decidir la maquetación. Solo los abre su propietario.

- [Maquetación](https://claude.ai/artifact/3MRGjAajcEhsFgiWgo2uEF): pestañas, secciones o tarjetas.
- [Filtros](https://claude.ai/artifact/VXyKeBZE3MZ6oQC9owb5YC): desplegable, diálogo o marcas a la vista.
- [Fila de pintura](https://claude.ai/artifact/ELpjDrkX8fRJpNfrLpWJ4G): la leyenda de la muestra partida.
- [Aviso de color aproximado](https://claude.ai/artifact/UftcxvvbGsMVGCFEekniTg): general, por pintura o según el caso.
- [Barra de navegación](https://claude.ai/artifact/PU2TyarkuDLXY6HySxdiR2): fija o no, con el menú hamburguesa.
- [Buscador de pinturas](https://claude.ai/artifact/8sMCKuUSoYVxbvsADQmdJy): con el HTML, el CSS y la rueda de la web compilada.
