# Web

Este documento especifica `apps/web`: la PWA que integra la rueda de `color-wheel` y busca, para cada color, las pinturas más parecidas del catálogo con `domain`. La web solo presenta ([ADR-0018](adr/0018-organizacion-codigo-patrones.md)): la lógica de color está en `color-wheel` y la del catálogo y la búsqueda, en `domain`. Por qué se decidió así está en el [ADR-0024](adr/0024-web.md).

## 1. Maquetación

- **Un único marcado**, _mobile first_, que se adapta con CSS:
  - En el móvil, una columna: la barra de navegación, el banner de instalar (§8), el título, la rueda con sus controles y los resultados.
  - Desde 60rem de ancho, la rueda a la izquierda, fija al desplazar, y los resultados a la derecha.
- **La lista de colores de la rueda se oculta** (`hideControl("results")`): la web muestra los colores en sus pestañas, y así cada color aparece una vez.
- **Resultados**, en este orden:
  1. El selector «Mostrar», siempre visible: «Por marca» o «Las más parecidas».
  2. Los filtros, en un desplegable (`<details>`) con un resumen de lo activo: «todas las marcas · opacas · sin descatalogadas». Dentro, las marcas, los tipos que se pueden añadir con las metálicas, y las descatalogadas. Por defecto, todas las marcas, solo las opacas no metálicas y sin descatalogadas (docs/06 §6.1).
  3. El aviso de color aproximado (§3).
  4. Una pestaña por color de la armonía, con su muestra y su papel. En el móvil se quedan fijas bajo la barra de navegación al desplazar. Se recorren con las flechas, Inicio y Fin (patrón `tablist`).
  5. La leyenda de la muestra partida (§2), una línea de texto sin recuadro.
  6. El panel del color elegido.
- **Pinturas por marca**: 3, con un botón «Ver más» que añade 3 cada vez a esa marca. En «Las más parecidas», lo mismo con la lista conjunta. Lo pedido con «Ver más» se reinicia al cambiar de color, de vista o de filtros. Una marca sin candidatas dice «Sin pinturas con estos filtros», y sin ninguna marca elegida, el panel pide elegir una.
- **Debajo**, las armonías explicadas, con el nombre que les da la rueda.

## 2. Cada pintura

- **A primera vista**: la muestra partida, el nombre, la gama (con la marca delante en «Las más parecidas»), las fichas del tipo, «Metálica» y «Descatalogada» si lo es, y la etiqueta de calidad (docs/06 §3).
- **En «Detalles»** (`<details>`): el código del fabricante, el ΔE con un decimal, el hex con su fuente y su origen («#3daf44, de SimoGecko (comunitario)»), que es la fuente breve del color que pide el [ADR-0015](adr/0015-fuentes-trazabilidad-licencias.md), y la razón de que el color sea aproximado (`colorApproximationReasons`) o «Exacto».
- **Muestra partida**: arriba el color de la rueda y abajo el de la pintura, para compararlos sin mover la vista. Es decorativa: su información está en el texto.

## 3. Aviso de color aproximado

Se decide con las pinturas que muestra el panel:

- **Si todas son aproximadas** (hoy siempre, porque todos los hex son comunitarios): un aviso general, sin marcar ninguna pintura.
- **Si se mezclan**: el aviso explica la ficha «≈ Aproximado», y solo la llevan las aproximadas.
- **Si ninguna lo es**: sin aviso.

El aviso enlaza a «Créditos y fuentes» y no nombra las fuentes. La razón concreta de cada pintura está en sus «Detalles».

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
- el color, el modelo, la armonía y la luz de la rueda, al cambiar (no mientras se arrastra).

No se guardan la pestaña, lo pedido con «Ver más» ni si el desplegable está abierto. Lo leído se valida: si no es válido, se descarta entero. Un `localStorage` bloqueado o lleno se ignora. Se leen después de que el navegador tome la página (§10), así que la rueda aparece un instante con el color de partida antes del guardado.

En la fase 6 las preferencias pasarán a la cuenta del usuario ([ADR-0017](adr/0017-arquitectura-objetivo-backend.md)).

## 7. Carga del catálogo y errores

- **La rueda funciona desde el principio**; solo los resultados esperan al catálogo. Mientras se descarga, el panel muestra el ejemplo prerenderizado si nada ha cambiado, o «Cargando las pinturas…», anunciado a los lectores de pantalla.
- **Si falla, el error ocupa el panel** y la rueda sigue funcionando. Nunca se usa un catálogo a medias (docs/02 §5).

| Causa                                              | Mensaje                                                                                                                                                 | Acción            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Sin red (primera visita sin conexión) o error HTTP | **No se han podido descargar las pinturas.** Comprueba la conexión.                                                                                     | Reintentar        |
| `unsupported-schema-version`                       | **Hay una versión nueva de la aplicación.** Actualiza para ver las pinturas.                                                                            | Actualizar (§8)   |
| JSON mal formado, `invalid-structure`, `integrity` | **Los datos de las pinturas tienen un problema.** La rueda sigue funcionando, pero no se pueden buscar pinturas parecidas. Recarga la página más tarde. | Detalles técnicos |

## 8. PWA

- **Precaché**: todas las páginas de todos los idiomas, el código, los iconos y `catalog.json`. Después de la primera visita, todo funciona sin conexión.
- **Versión nueva** (de la web o del catálogo, que llegan igual): un aviso no modal, «Hay una versión nueva», con «Actualizar». Si no se pulsa, se aplica la próxima vez que se abra la web. La primera versión controla la página en cuanto se instala.
- **Instalar**:
  - Un banner, el primer elemento bajo la barra, en el flujo de la página y no modal. Solo aparece si se puede instalar (el navegador emitió `beforeinstallprompt`, o es Safari en iOS, detectado por `navigator.standalone`) y no está instalada. Desaparece al instalarla o al cerrarlo, para siempre.
  - Un botón discreto «Instalar la aplicación» en el pie, para quien cambie de opinión. En iOS, muestra las instrucciones («Compartir» y «Añadir a pantalla de inicio»).
- **Iconos**: provisionales (una rueda de 12 tonos con el triángulo), en `public/icons/`, en SVG y en PNG de 192 y 512 px, y en versión _maskable_.

## 9. Idiomas

- **Los mismos 10 que la rueda**, con la misma detección (`resolveLocale` de `color-wheel`). La rueda y la web van siempre en el mismo idioma.
- **Los textos de la web** están en un diccionario tipado: si falta un texto en un idioma, no compila. Un test comprueba además que ninguno está vacío y que todos conservan los marcadores (`{count}`…). Los nombres de las armonías y los papeles salen de la rueda (`labelsFor`). Los nombres de las pinturas no se traducen.
- **El selector de idioma** muestra cada idioma en su propio idioma, con el rótulo bilingüe «Idioma · Language». Al cambiarlo, carga la misma página en el otro idioma y lo recuerda.
- **Riesgo conocido**: los textos de 8 idiomas los escribió Claude y nadie los ha revisado. Solo el castellano y el inglés están revisados.

## 10. Prerenderizado y SEO

- **Cada página de cada idioma se prerenderiza en el build** como su propio `index.html`, con React en Node. El navegador toma ese HTML (`hydrateRoot`) con los mismos datos, que van en la propia página (`<script type="application/json">`).
- **Sin JavaScript** se ven los metadatos, los textos fijos, las armonías explicadas, un ejemplo real completo (el color de partida, los 6 colores de su esquema de miniatura y las pinturas de cada marca, calculados en el build) y los créditos completos. Los 6 colores salen seguidos, como secciones. En el sitio de la rueda, el aviso «La rueda interactiva necesita JavaScript».
- **En el primer render no se lee nada del navegador** (preferencias, idioma del navegador, catálogo): lo que depende de él se aplica justo después. Un test renderiza todas las páginas en Node para garantizarlo.
- **Cabecera de cada página**: título y descripción en su idioma, `lang`, URL canónica, `hreflang` a los otros 9 idiomas y `x-default` a `/`, metadatos para compartir (Open Graph y la tarjeta de X) y, en la principal, datos estructurados `WebApplication`.
- **`sitemap.xml`** con las alternativas de idioma, y **`robots.txt`**.
- **El origen del sitio** (para las URL absolutas) lo da la variable `SITE_ORIGIN` al compilar. Sin ella, el de `vite preview`.
- **CSP** en una etiqueta `<meta>`: solo scripts propios y el script del tema (§11), autorizado por su hash. Los estilos en línea se permiten porque las muestras del HTML prerenderizado llevan su color en el atributo `style`.

## 11. Barra de navegación y tema

- **Barra fija arriba**: el nombre a la izquierda, que lleva a la principal; a la derecha, el idioma y el tema. En pantallas estrechas, el idioma y el tema se recogen en un menú hamburguesa que se despliega bajo la barra, no modal, con `aria-expanded`, y se cierra con Esc. Admite más enlaces en el futuro.
- **Tema**: un selector segmentado con tres iconos (sistema, claro y oscuro), con su nombre accesible y su texto al pasar el ratón. Lo aplica el atributo `data-theme` de `<html>`, y el CSS lo convierte en `color-scheme` para la web y en `--cw-color-scheme` para la rueda (docs/05 §6.6). Sin elección, el del sistema.
- **Sin parpadeo**: un script mínimo en línea aplica el tema guardado antes de pintar nada.
- **Iconos**: `sun`, `moon`, `monitor`, `menu` y `x` de Lucide, copiados como en `color-wheel`, con su aviso de licencia.

## 12. Páginas y rutas

| Página             | Ruta               |
| ------------------ | ------------------ |
| Elegir idioma      | `/`                |
| Rueda y pinturas   | `/es/`, `/pt-br/`… |
| Créditos y fuentes | `/es/credits/`…    |

- **El idioma va delante**, en minúsculas (`pt-BR` → `/pt-br/`). El nombre de la ruta de créditos es fijo, en inglés.
- **`/`** lleva al idioma guardado o al detectado. Sin JavaScript, enlaza a los 10 idiomas.
- **Enlaces normales**, sin router en el cliente: cada página es un HTML completo y, sin conexión, sale del precaché.

## 13. Créditos y fuentes

- **Fuentes del catálogo**: cada una con su título, quién la publica, su enlace, su copia archivada, su licencia, su atribución y la fecha de consulta, y lo que aporta: los colores de qué marcas y gamas, y cuántas sustituciones y equivalencias oficiales (`sourceContributions`). Todo sale de `catalog.json`.
- **Código de terceros**: cada paquete que acaba en el código distribuido (la web y el service worker), con su versión, su licencia, su repositorio y el texto de su licencia, plegado y en el idioma original. Además, los avisos `@license` del código propio (los iconos de Lucide). Un plugin de Vite los saca del bundle en cada build, así que la lista siempre coincide con lo que se distribuye.

## 14. Tests

- **Node**: el reductor, las preferencias, las rutas, la cabecera, la carga del catálogo, la búsqueda, los textos de los 10 idiomas, la plantilla HTML con la CSP, el plugin de licencias y el prerenderizado de las 21 páginas.
- **Navegador** (modo navegador de Vitest con Playwright): que el navegador toma el HTML prerenderizado sin diferencias, las pestañas con teclado, los filtros, «Ver más», la vista, el tema, el menú, las preferencias guardadas y el error de red, con axe-core (WCAG 2.2 A y AA) en varios estados.
- **De extremo a extremo** (`@playwright/test`), sobre la web compilada: que se sirven todas las rutas en su idioma, el contenido sin JavaScript, que `/` va al idioma detectado, el selector de idioma, el funcionamiento sin conexión y el aviso de versión nueva.

## 15. Prototipos

Artifacts privados de claude.ai, hechos al decidir la maquetación. Solo los abre su propietario.

- [Maquetación](https://claude.ai/artifact/3MRGjAajcEhsFgiWgo2uEF): pestañas, secciones o tarjetas.
- [Filtros](https://claude.ai/artifact/VXyKeBZE3MZ6oQC9owb5YC): desplegable, diálogo o marcas a la vista.
- [Fila de pintura](https://claude.ai/artifact/ELpjDrkX8fRJpNfrLpWJ4G): la leyenda de la muestra partida.
- [Aviso de color aproximado](https://claude.ai/artifact/UftcxvvbGsMVGCFEekniTg): general, por pintura o según el caso.
- [Barra de navegación](https://claude.ai/artifact/PU2TyarkuDLXY6HySxdiR2): fija o no, con el menú hamburguesa.
