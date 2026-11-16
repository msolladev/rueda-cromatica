# ADR-0020: La rueda de color como paquete independiente

- **Estado:** aceptada
- **Fecha:** 2026-11-16

## Contexto

La rueda trabaja solo con colores: se dibuja, se gira su plantilla y devuelve los colores que marca. No necesita saber nada de pinturas ni de marcas. La parte propia de Warhammer empieza después, al buscar la pintura más parecida a cada color que devuelve la rueda.

El [ADR-0018](0018-organizacion-codigo-patrones.md) colocaba la rueda dentro de `domain`, en los módulos `color`, `harmony` y `scheme`, junto al catálogo. Miguel propuso separarla como una librería completa que cualquier web pueda usar y sobre la que la nuestra enganche las pinturas.

Además, el [ADR-0019](0019-alcance-minimo-mvp.md) describía el esquema de miniatura como «base, sombra, luz y acento», y CLAUDE.md definía la sombra como una variación oscurecida de la base. Al concretar la etapa 4, Miguel corrigió las dos cosas a partir de su experiencia pintando.

La referencia física es una rueda de pintor como la [Colour Mixing Wheel de AK](https://ak-interactive.com/es/producto/colour-mixing-wheel/): 12 tonos, cada uno con su versión pura, con blanco, con gris y con negro, y un disco central con las plantillas de las armonías. El catálogo, en cambio, está lleno de colores apagados (marrones, grises, verdes militares) que una rueda de colores puros nunca señalaría.

## Decisión

El detalle vigente (ángulos, conversión, mezclas y API) está en [05-rueda-de-color.md](../05-rueda-de-color.md). Aquí se recoge qué se decidió y por qué.

### Paquete

- **`packages/color-wheel`** (`@rueda-cromatica/color-wheel`): la rueda completa, con sus cálculos, su dibujo, su plantilla giratoria y sus controles. Sin depender de `domain` ni de ningún framework. Sus dependencias son culori y spectral.js.
- **Agnóstico**: funciona en cualquier web, use el framework o la librería que use, o ninguno.
- **No se publica en npm por ahora**, pero se diseña como si fuera a publicarse: API pública en `index.ts`, tests y ningún concepto de pinturas.
- **Dependencias**: `apps/web` usa `color-wheel` y `domain`; `catalog-builder` usa `domain`. Entre `color-wheel` y `domain` no hay dependencia.
- **La búsqueda de la pintura más parecida (ΔE CIEDE2000) sigue en `domain`**, en el módulo `matching`, porque necesita el catálogo.

### Componente

- **Se inicializa sobre un contenedor**, con su configuración en JavaScript, como Leaflet o Chart.js.
- **Completo**: trae sus propios controles para todo lo que recibe (color base, también en hex, modelo, armonía y tipo de luz) y muestra los colores resultantes.
- **Flexible**: cada control se puede ocultar y desactivar, y todo lo que hace el usuario se puede hacer desde código.
- **Parámetros como propiedades** (`wheel.color = "#c01411"`), que validan al asignarse igual que lo haría un método. Las acciones son métodos (`hideControl`, `update`, `destroy`).
- **Eventos estándar del navegador sobre la propia rueda**: la clase hereda de `EventTarget` y emite `input` mientras se arrastra y `change` al terminar, como un campo de formulario.
- **Resultado**: una lista de colores con su papel (`base`, `shadow`, `triad`…), en un orden fijo con sentido en cada armonía.
- **Textos en 10 idiomas** incluidos en el paquete (en, es, fr, de, it, pt-BR, ru, zh-Hans, ja y ko), y la web puede sustituir cualquiera.
- **Estilos en un fichero CSS aparte**, adaptable con variables CSS.
- **Funciones de cálculo exportadas**, para obtener los colores sin dibujar nada.

### Rueda continua con triángulo

- **Anillo de tono continuo** y, dentro, un **triángulo** con vértices en el color puro, el blanco y el negro.
- **La base puede ser cualquier color**, apagado incluido: un marrón es un naranja con bastante negro.
- **Las armonías giran el tono y conservan las proporciones de blanco y negro de la base.** Así la tríada de un marrón sale igual de apagada, y aparecen las pinturas apagadas del catálogo.
- **Se dibuja con Canvas**: el anillo continuo y el degradado de tres vértices del triángulo no se pueden dibujar bien con SVG.

### Armonías

- Complementario, complementario dividido, análogos, análogos con acento, tríada, tétrada rectangular, cuadrado y monocromático, además del esquema de miniatura.
- **Ángulos fijos, los de la rueda de 12 tonos**: las fuentes definen las armonías por posiciones en esa rueda (vecinos, opuestos, parejas de opuestos), y un paso son 30°.
- **Monocromático, como las ventanas de la rueda de AK**: la base con blanco, con gris y con negro.

Ejemplo: rojo, complementario. En RYB devuelve verde; en digital, cian.

### Modelos RYB y digital

- **No existe un RYB estándar.** La referencia más citada es el cubo de [Gossett y Chen (2004)](https://bahamas10.github.io/ryb/assets/ryb.pdf), que asigna un color de pantalla a cada esquina.
- **Solo se convierte el tono**: la posición en el anillo pasa de una rueda a la otra, y las proporciones de blanco y negro no cambian. Los tonos puros de la rueda RYB salen de las esquinas de ese cubo.
- Es exacta en los dos sentidos, y el anillo y el triángulo funcionan igual en los dos modelos.

### Mezclas

- **Kubelka-Munk, con [spectral.js](https://github.com/rvanwijnen/spectral.js)**, para la sombra, la luz y las variaciones del monocromático.
- La pintura no se mezcla como la luz: amarillo y azul dan verde, y dos complementarios dan un neutro apagado. Solo un modelo de pigmentos lo reproduce. Miguel comparó cuatro métodos con colores del catálogo, y el de pigmentos es el que más se parece a lo que obtiene al pintar.
- Sirve también para las mezclas que están en «Futuro».

### Esquema de miniatura

- **Entrada**: el color base, el modelo y el tipo de luz (cálida o fría).
- **Salida, en este orden**: la base, su sombra, su luz, los otros dos colores de su tríada y su complementario. La sombra y la luz son solo de la base y van siempre detrás de ella.
- **Sombra**: la base mezclada con su complementario. Mezclar complementarios apaga el color y lo oscurece.
- **Luz**: la base mezclada con su color vecino en la rueda, aclarado:
  - cálida: el vecino en dirección al amarillo;
  - fría: el vecino en dirección al azul.
- **Casos límite**:
  - Si la base ya es amarilla y la luz es cálida, se mezcla con un amarillo más claro.
  - Si la base ya es azul y la luz es fría, se aclara con blanco.
- **Proporciones**: cuánto complementario lleva la sombra y cuánto vecino la luz son constantes con un valor de partida. Se ajustan al ver los resultados en la etapa 5. Ninguna fuente da cifras.

Ejemplo: verde en RYB con luz cálida. Tríada: naranja y violeta. Complementario: rojo. Sombra: verde con un poco de rojo, un verde oscuro y grisáceo. Luz: verde con un poco de verde-amarillo claro, un verde claro tirando a lima.

### Entrega y herramientas

- **Compilado a JavaScript**, con las declaraciones de tipos (`.d.ts`) que genera el compilador. Quien no use TypeScript las ignora; quien lo use, importa el paquete sin escribir nada.
- **Dos ficheros**, como Chart.js: uno para npm, sin sus dependencias, y otro para `<script src>`, con todo dentro. Quien instala con npm no duplica culori si ya lo usa.
- **Vite en modo librería** genera los dos ficheros, y `tsc` los `.d.ts`, con un solo script `build`. Vite ya está en el repositorio, y Vitest se construye sobre él.
- **Tests del dibujo en un navegador real**, con el modo navegador de Vitest y Playwright, en local y en la CI. Los cálculos se prueban en Node.

### Fuentes

- Armonías: [Sensational Color](https://www.sensationalcolor.com/creating-color-harmony/) (rueda de 12 tonos, análogos sin saltar colores, tétradas como dos parejas de opuestos sin vecinos), [color-meanings](https://www.color-meanings.com/rectangular-tetradic-color-schemes) (ejemplos de tétrada rectangular) y [Wikipedia](https://en.wikipedia.org/wiki/Color_scheme) (análogos con acento: «accented with the direct complement»).
- Modelo RYB: Gossett y Chen (2004), apéndice A; y la documentación de [ColorAide](https://facelessuser.github.io/coloraide/colors/ryb/), que advierte que «there is no standard RYB color model».
- Mezclas: [Sochorová y Jamriška (2021)](https://dcgi.fel.cvut.cz/wp-content/wpallimport-dist/publications/pdf/publications-2021-sochorova-tog-pigments-paper.pdf), sobre Kubelka-Munk en pintura digital, y la documentación de spectral.js.
- Sombra y luz:
  - El método del curso de pintura de Miguel: un verde se sombreó con rojo y se iluminó con un toque de amarillo lima.
  - [Green Stuff World](https://www.greenstuffworld.com/en/module-blog?id=157): para oscurecer «in many cases it also works better to use a complementary color». El amarillo se ilumina con amarillos más claros o crema, sin perder saturación.
  - [TourBox](https://www.tourboxtech.com/en/news/hue-shift-guide.html), sobre el _hue shift_: con una fuente de luz, las luces tienden a tonos más cálidos y las sombras a tonos más fríos.
  - [Draw Paint Academy](https://drawpaintacademy.com/how-to-paint-under-different-light-sources/): lo cálido y lo frío son relativos, y el blanco enfría el color al aclararlo.
- Idiomas: los conjuntos habituales de localización, EFIGS y CJK ([Pangea](https://www.pangea.global/?p=57871)), más portugués y ruso ([AppTweak](https://www.apptweak.com/en/aso-blog/how-to-decide-which-languages-to-localize-your-game-into?format=md)).

## Alternativas descartadas

- **Paquete y componente**:
  - **La rueda dentro de `domain`**, como preveía el ADR-0018: la frontera entre la rueda y el catálogo dependería de la disciplina. Un paquete propio la hace obligatoria.
  - **Publicarla ya en npm**: obliga a versionar cada cambio de la API, elegir licencia y mantener un proceso de publicación mientras el diseño todavía cambia. No aporta nada a la app.
  - **Dibujar la rueda en `apps/web`, o dejar fuera sus controles**: repartiría la rueda entre dos sitios, y cualquier otra web tendría que completarla.
  - **Un componente de un framework concreto**: ataría la rueda a ese framework.
  - **Una etiqueta HTML propia (_custom element_)**: es un estándar del navegador, pero un patrón menos habitual. Sus atributos solo admiten texto y su nombre es global en la página.
  - **Eventos con un sistema propio (`on`/`off`)**: es lo habitual en librerías anteriores a 2020, cuando el navegador no permitía heredar de `EventTarget`. Hoy obliga a escribir código que el navegador ya trae.
  - **Una función `onChange` en la configuración**: solo admite un oyente.
  - **Eventos sobre el contenedor**: se escucharía al contenedor en lugar de a la rueda.
  - **Un resultado con forma distinta por armonía**: la web necesitaría un caso por armonía, y cada armonía nueva la obligaría a cambiar.
  - **Que la rueda descargue los textos desde una URL**: la caché es la misma la haga quien la haga, y la rueda tendría que resolver la espera, los fallos y los permisos entre dominios. La web lo hace con una línea.
  - **Estilos metidos por JavaScript**: una política de seguridad (CSP) estricta los bloquea.
  - **Estilos aislados (_Shadow DOM_)**: la web no podría adaptar el aspecto.
- **Rueda**:
  - **Por segmentos, como la física**: con la base limitada a 12 colores puros, las pinturas apagadas del catálogo casi nunca aparecerían.
  - **Anillos de puro, blanco, gris y negro, como la rueda de AK**: solo da cuatro niveles fijos de variación por tono.
  - **SVG**: no dibuja bien el anillo continuo ni el triángulo.
  - **Ángulos ajustables, como en Adobe Color**: más complejo de usar y de programar. Queda en «Futuro».
- **Armonías y mezclas**:
  - **Devolver todas las armonías a la vez**: quien usa la rueda elige una plantilla, como en una rueda física, y solo necesita sus colores.
  - **El esquema de miniatura como una armonía más**: responde a otra pregunta (cómo pintar una zona) y lleva sombra y luz, que no salen de girar la plantilla.
  - **Sombra como la base oscurecida y luz como la base aclarada con colores fijos**: no es como se pinta. Las fuentes coinciden en que el tono se desplaza, no solo la luminosidad.
  - **El espacio RYB completo de Gossett y Chen**: su inversa es aproximada, convierte mal los colores que la pintura no alcanza y no tiene negro.
  - **Mezclar en RGB u OKLab** (culori): mezclan como la luz. Amarillo y azul dan gris, y la sombra no sale como la pinta un pintor.
  - **Mixbox**: es de mejor calidad, pero su licencia (CC BY-NC) no permite el uso comercial e impediría publicar el paquete.
- **Herramientas**:
  - **Compilar solo con `tsc`**: no genera el fichero único para `<script>`.
  - **tsdown**: es una dependencia nueva, y su versión 0.x todavía no es estable.
  - **Un solo fichero con culori dentro**: obliga a `type="module"` en el `<script>` y duplica culori en las webs que ya lo usan, como la nuestra.
  - **happy-dom o jsdom**: no calculan posiciones ni tamaños, así que el arrastre se probaría con medidas inventadas.
  - **Navegador real en local y simulado en la CI**: la CI dejaría pasar fallos reales del arrastre, y esos tests habría que escribirlos dos veces.

## Consecuencias

- Los módulos `color`, `harmony` y `scheme` que el ADR-0018 situaba en `domain` pasan a `color-wheel`. `domain` conserva `catalog` y `matching`, que incluye el ΔE. El resto del ADR-0018 sigue vigente.
- El esquema de miniatura del ADR-0019 («base, sombra, luz y acento») queda precisado por este ADR.
- `apps/web` no dibuja la rueda ni sus controles: la inicializa, escucha `change` y busca las pinturas más parecidas a los colores del resultado.
- Los tests son obligatorios también en `color-wheel`, y la CI necesita descargar Chromium, con caché.
- Dependencias nuevas, con versión exacta al implementarlas: spectral.js, el modo navegador de Vitest y Playwright. spectral.js no trae tipos, así que el paquete incluye su declaración.
- Mostrar al usuario qué pinturas mezclar para conseguir la sombra o la luz es la funcionalidad de mezclas, que sigue en «Futuro». En el MVP se muestra el color resultante y la pintura más cercana.
- Los ángulos ajustables de la plantilla quedan en «Futuro».
- Publicar el paquete en npm requerirá un ADR nuevo.
