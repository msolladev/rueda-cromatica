# Rueda de color

Este documento especifica el paquete `@chromatic-wheel/color-wheel`: cómo representa los colores, cómo calcula las armonías, el esquema de miniatura y las mezclas, y su API. Por qué se decidió así está en el [ADR-0020](adr/0020-rueda-paquete-independiente.md).

## 1. Principios

- **Solo colores**: el paquete no sabe nada de pinturas, marcas ni catálogo.
- **Agnóstico**: funciona en cualquier web, con o sin framework, y con o sin TypeScript.
- **Completo y controlable**: trae sus controles, y todo lo que hace el usuario se puede hacer también desde código.
- **Los cálculos no tocan el DOM**: solo el módulo `ui` usa el navegador, y el resto se prueba y se usa en Node.
- **Los valores no válidos fallan**: un hex mal escrito o una armonía desconocida lanzan un error que explica qué falla, en lugar de ignorarse.
- **Accesible**: HTML semántico, cumplimiento de WCAG 2.2 nivel AA y manejo completo con ratón, teclado y pantalla táctil (§6.2).
- **Adaptable**: un único marcado que se ajusta con CSS al tamaño de su contenedor, del móvil al escritorio, sin elementos distintos según la pantalla.

## 2. Representación del color

Un color de la rueda tiene dos partes:

- **El tono**: un ángulo de 0° a 360° en el anillo del modelo activo.
- **Las proporciones**: cuánto lleva del color puro de ese tono, de blanco y de negro. Son tres pesos que suman 1.

Ejemplo: un marrón es el tono naranja con, aproximadamente, 0,45 de puro, 0,10 de blanco y 0,45 de negro.

El color resultante es la suma ponderada, en sRGB, del color puro, el blanco (`#ffffff`) y el negro (`#000000`). La suma es lineal para que el triángulo se pueda dibujar píxel a píxel y para que la conversión desde un hex sea exacta. Las mezclas de pintura (§5) usan otro método.

## 3. Modelos y conversión

### 3.1. Digital

El color puro de un tono es el de HSL con saturación 100 % y luminosidad 50 %.

De un hex a la rueda, con los canales entre 0 y 1:

- tono: el de HSV;
- blanco: el canal mínimo;
- puro: el canal máximo menos el mínimo;
- negro: 1 menos el canal máximo.

La conversión es exacta en los dos sentidos.

### 3.2. RYB

No existe un RYB estándar. Los colores puros salen del cubo de [Gossett y Chen (2004)](https://bahamas10.github.io/ryb/assets/ryb.pdf), apéndice A:

| Esquina RYB (R, Y, B) | Color    | sRGB (0-1)          |
| --------------------- | -------- | ------------------- |
| (0, 0, 0)             | blanco   | (1, 1, 1)           |
| (1, 0, 0)             | rojo     | (1, 0, 0)           |
| (0, 1, 0)             | amarillo | (1, 1, 0)           |
| (0, 0, 1)             | azul     | (0.163, 0.373, 0.6) |
| (1, 1, 0)             | naranja  | (1, 0.5, 0)         |
| (0, 1, 1)             | verde    | (0, 0.66, 0.2)      |
| (1, 0, 1)             | violeta  | (0.5, 0, 0.5)       |
| (1, 1, 1)             | negro    | (0.2, 0.094, 0)     |

- **El anillo RYB** recorre las seis esquinas de color: rojo (0°), naranja (60°), amarillo (120°), verde (180°), azul (240°) y violeta (300°). Entre dos esquinas, el color puro se interpola de forma lineal. El artículo propone además una curva que acerca los colores a las esquinas; no se usa, porque rompería la continuidad del anillo.
- **De RYB a digital**: se toma el color puro del tono RYB y se combina con las proporciones (§2).
- **De un hex a la rueda RYB**:
  1. El tono es el ángulo RYB cuyo color puro tiene el mismo tono HSV que el hex. Esa correspondencia es creciente en todo el anillo, así que se invierte sin ambigüedad; los tests lo comprueban.
  2. Las proporciones son las del punto del triángulo más cercano al hex (mínimos cuadrados en sRGB, con pesos no negativos).
  3. Si el hex queda fuera de lo que alcanza el triángulo RYB, como un cian intenso, la rueda toma ese punto más cercano y el campo hex muestra el color alcanzado.
- **Colores sin tono** (blancos, grises y negros puros), en los dos modelos: conservan el tono que tenía la rueda, que la conversión recibe como dato opcional (§7). Si no lo recibe, el tono es 0°.

## 4. Armonías

Los ángulos son los de la rueda de 12 tonos, en la que un paso son 30°. Se aplican en el anillo del modelo activo, y todos los colores conservan las proporciones de la base. El orden de la tabla es el del resultado.

| Armonía                 | `harmony`             | Colores, en orden, con su papel (`role`)                                       |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------ |
| Complementario          | `complementary`       | `base`; `complement` (180°)                                                    |
| Complementario dividido | `split-complementary` | `base`; `split` (150°); `split` (210°)                                         |
| Análogos                | `analogous`           | `base`; `analogous` (−30°); `analogous` (+30°)                                 |
| Análogos con acento     | `accented-analogous`  | `base`; `analogous` (−30°); `analogous` (+30°); `accent` (180°)                |
| Tríada                  | `triad`               | `base`; `triad` (120°); `triad` (240°)                                         |
| Cuadrado                | `square`              | `base`; `complement` (180°); `square` (90°); `square` (270°)                   |
| Tétrada rectangular     | `rectangle`           | `base`; `complement` (180°); `tetrad` (60°); `tetrad` (240°)                   |
| Monocromático           | `monochromatic`       | `base`; `tint` (con blanco); `tone` (con gris); `shade` (con negro)            |
| Esquema de miniatura    | `miniature-scheme`    | `base`; `shadow`; `light`; `triad` (120°); `triad` (240°); `complement` (180°) |

- **Cuadrado y tétrada rectangular**: se agrupan por parejas de opuestos, porque así se construyen.
- **Tétrada rectangular a 60°**: son dos parejas de opuestos sin vecinos. A 30° serían vecinos, y a 90° sería el cuadrado.
- **Monocromático**: las variaciones son mezclas (§5).

## 5. Mezclas

Las mezclas usan Kubelka-Munk con spectral.js (`spectral.mix`), con la fuerza de tinte por defecto. Los factores son constantes internas con un valor de partida, que se ajustan al ver los resultados en la etapa 5. Ninguna fuente da cifras.

| Constante         | Valor de partida | Uso                                                |
| ----------------- | ---------------- | -------------------------------------------------- |
| `SHADOW_RATIO`    | 0,25             | Cuánto complementario lleva la sombra              |
| `LIGHT_RATIO`     | 0,25             | Cuánto vecino aclarado lleva la luz                |
| `LIGHTEN_RATIO`   | 0,5              | Cuánto blanco lleva el vecino al aclararlo         |
| `VARIATION_RATIO` | 0,5              | Cuánto blanco, gris o negro llevan las variaciones |

### 5.1. Sombra

La base mezclada con su complementario (180°, con las proporciones de la base), en la proporción `SHADOW_RATIO`.

### 5.2. Luz

1. **Destino**: el amarillo si la luz es cálida y el azul si es fría. En RYB están a 120° y 240°; en digital, a 60° y 240°.
2. **Vecino**: el tono se desplaza 30° desde la base hacia el destino por el camino más corto, sin pasarse del destino, y conserva las proporciones de la base. Si la base está enfrente del destino y los dos caminos miden 180°, se desplaza hacia los ángulos crecientes (+30°). En los cuatro casos posibles (azul y amarillo en digital, violeta y naranja en RYB), la luz cálida pasa así por el rojo y la fría por el verde.
3. **Casos límite**: si la base está a 15° o menos del destino, es decir, dentro de su segmento en la rueda de 12 tonos:
   - cálida: el vecino es el amarillo puro (`#ffff00` en los dos modelos), sin las proporciones de la base, y se aclara como cualquier vecino;
   - fría: el vecino es el blanco.
4. **Aclarado**: el vecino se mezcla con blanco en la proporción `LIGHTEN_RATIO`.
5. **Luz**: la base mezclada con el vecino aclarado, en la proporción `LIGHT_RATIO`.

### 5.3. Variaciones del monocromático

La base mezclada, en la proporción `VARIATION_RATIO`, con:

- blanco (`#ffffff`) para `tint`;
- gris (`#808080`) para `tone`;
- negro (`#000000`) para `shade`.

## 6. Componente

### 6.1. Uso

```js
const wheel = new ColorWheel(document.querySelector("#rueda"), {
  color: "#3daf44",
  harmony: "miniature-scheme",
});

wheel.addEventListener("change", (e) => {
  for (const { role, hex } of e.detail.result.colors) {
    // la web busca las pinturas más parecidas a cada color
  }
});
```

### 6.2. Dibujo

- **Anillo de tono** continuo y **triángulo** interior con vértices en el color puro del tono de la base, el blanco y el negro. El triángulo gira con el tono.
- **Plantilla**: líneas desde el centro hasta las marcas de cada color de la armonía en el anillo, y un punto en el triángulo que marca la base.
  - **Movimiento**: al cambiar de armonía o de luz, cuando la base no se mueve, cada marca viaja por el arco más corto hasta su nuevo tono en 450 ms; las que sobran vuelven a la base y las nuevas salen de ella. Cuando la base se mueve (al arrastrar, con el teclado, al cambiar el color o el modelo), las marcas la siguen al momento, porque el triángulo gira con ella. Sin movimiento si el sistema pide reducirlo (`prefers-reduced-motion`).
- **Interacción**: arrastrar en el anillo cambia el tono, y arrastrar en el triángulo cambia las proporciones.
- **Canvas**, con nitidez ajustada a la densidad de la pantalla. La rueda ocupa el ancho de su contenedor, hasta `--cw-wheel-max-size`.
  - El anillo es un degradado cónico por las seis esquinas del modelo, y el triángulo, el negro más dos degradados lineales que se suman (el puro y el blanco, cada uno desde su vértice hasta el lado opuesto). Las dos cosas son exactas: los colores puros de los dos modelos varían de forma lineal entre esquinas (§3), y en un triángulo equilátero cada degradado es el peso de su vértice (§2).
  - Las marcas y el punto de la base son blancos con un halo oscuro, para que se vean sobre cualquier color.
  - **Nombre de cada marca**: el de su color, que es su papel, numerado si se repite («Tríada 1», «Tríada 2»; `colorNames`, que la lista de resultados también usa). No se ven todos a la vez, solo:
    - el del color que resalta la página (`highlightColor`), cuya marca lleva además un anillo alrededor. Una web que muestra los colores a su manera, como en pestañas, lo usa para señalar el elegido;
    - los de las marcas bajo el ratón (no con el dedo, que no tiene «pasar por encima»). Si varias marcas se superponen, salen los nombres de todas, apilados.
  - Cada nombre es una pastilla pequeña, blanca sobre fondo oscuro, justo dentro del anillo y en la línea de su marca, con un punto de su color, que distingue las marcas superpuestas. Los que se tocarían se apilan juntos en su tono medio. Aparecen con un fundido y creciendo un poco, y se desvanecen donde estaban. Son solo visuales (el mismo nombre está en los resultados o en la página): se ocultan mientras la plantilla se mueve y casi desaparecen mientras se arrastra.
- **Ratón, teclado y pantalla táctil**, todo con la misma precisión:
  - **Ratón y lápiz**, con Pointer Events: el punto va a donde está el puntero.
  - **Táctil**, con Pointer Events: el punto no salta bajo el dedo. Se mueve lo mismo que el dedo, esté donde esté el dedo, así que sigue a la vista. En el anillo, el tono gira lo mismo que gira el dedo alrededor del centro. Un toque sin desplazamiento (menos de 6 px) sí coloca el punto donde cae, para los saltos grandes.
  - **Teclado**: el anillo y el triángulo son deslizadores (`role="slider"`) que reciben el foco, y el foco se dibuja alrededor de su forma.
    - Anillo: ← y ↓ restan 1°, → y ↑ suman 1°; con Mayúsculas, 10°. Re Pág y Av Pág mueven 30°, un paso de la rueda de 12 tonos.
    - Triángulo: → y ← suben o bajan el color puro un 1 % y conservan la relación entre blanco y negro; ↑ y ↓ pasan un 1 % del negro al blanco, o al revés, y conservan el color puro. Con Mayúsculas, un 10 %. Los ejes significan siempre lo mismo, gire como gire el triángulo.
    - El lector de pantalla anuncia el tono («30°») y las proporciones («45 % puro, 10 % blanco, 45 % negro»), y cada deslizador enlaza su explicación de teclas con `aria-describedby`.
- **HTML semántico**: los controles son elementos nativos (`<input>`, `<select>`, `<button>`, `<fieldset>`, `<label>`) y la lista de resultados es una lista (`<ol>`). Todo tiene nombre accesible. Los cambios de un control que cambian los colores se anuncian en una región `role="status"` («6 colores: Esquema de miniatura.»); los del anillo y el triángulo los anuncian los propios deslizadores.
- **Adaptable**: un único marcado, con consultas de contenedor, no de pantalla.
  - Con el contenedor estrecho, todo va en una columna. Desde 40rem de ancho del contenedor, la rueda a la izquierda y el panel a la derecha, centrados y cada uno con su ancho máximo (`--cw-wheel-max-size` y `--cw-panel-max-size`). El componente entero mide como mucho `--cw-max-size` y se centra.
  - Controles: Hex y Modelo en la primera fila, y Armonía y Luz, cada una a todo el ancho, porque los nombres de las armonías son los más largos en todos los idiomas. Ningún texto se corta ni se parte.
  - Resultados: una lista de filas, con la muestra, el nombre del color y el hex. Una columna, salvo con el contenedor estrecho pero de 28rem o más, donde van en dos.

### 6.3. Controles

| Control   | Qué hace                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------- |
| `hex`     | Campo para leer o escribir el color base en hex                                                           |
| `model`   | Selector segmentado de modelo: RYB o digital                                                              |
| `harmony` | Selector de armonía, con las de `harmonies`                                                               |
| `light`   | Selector segmentado de luz cálida o fría. Solo con el esquema de miniatura                                |
| `results` | Lista de los colores resultantes, con su papel                                                            |
| `help`    | Botón «Cómo se usa», que abre la explicación del manejo con puntero, dedo y teclado, y de los dos modelos |

El anillo y el triángulo no se pueden ocultar: son la rueda.

- **Ayuda** (`help`): un botón con aspecto de enlace (icono y texto subrayado) que abre la explicación en un _popover_ nativo (atributo `popover`), anclado con CSS _anchor positioning_ al bloque de la ayuda, que mide lo mismo que los controles: flota sobre la página sin desplazar nada, tiene el ancho de los controles y se abre debajo o encima, en el lado con más espacio. Mide como mucho la mitad de la pantalla visible (`50dvh`), para que la rueda siga a la vista mientras se lee; si no cabe, el texto se desplaza dentro. Sin _anchor positioning_, el navegador lo centra en la pantalla. Al pasar el ratón o llegar con el teclado, el icono del botón ladea la cabeza con un pequeño rebote. La explicación aparece creciendo un poco desde su botón y se desvanece al cerrarse; sin movimiento si el sistema pide reducirlo.
  - Explica también los modelos: RYB (rojo, amarillo y azul) es la rueda tradicional de la pintura, con sus complementarios (rojo y verde, amarillo y violeta, azul y naranja), y digital, la de la pantalla (RGB), con otros, como azul y amarillo.
  - Es un diálogo no modal (`role="dialog"`, con su título como nombre), así que se puede leer y probar la rueda a la vez: no se cierra al tocar fuera, sino con su botón, con Esc o con la «×» de dentro, que hace falta en el móvil.
  - Si una web quiere mostrar la ayuda de otra forma, oculta el control (`hideControl("help")`) y usa los textos de `getEffectiveLabels()`.
- **Selectores segmentados** para los controles de pocas opciones (`model` y `light`): botones de opción nativos (`<input type="radio">` en un `<fieldset>` con `<legend>`), que se ven todos a la vez, se cambian de un toque y se recorren con las flechas. El fondo de la opción elegida es una pastilla que se desliza hasta la nueva: se mide la opción con el DOM y una transición de CSS la mueve, en todos los navegadores. En los colores forzados usa los de selección del sistema, y no se mueve si el sistema pide reducir el movimiento. La armonía, con nueve opciones, es un `<select>`.
- **Al pasar el ratón**, solo en dispositivos con ratón (`hover: hover`): una opción no elegida de un selector segmentado se marca con una pastilla tenue, y el campo hex y el desplegable de armonía oscurecen su borde (el desplegable, también su flecha). El hex no válido conserva el borde de error.

- **`light`** solo es visible con el esquema de miniatura: `isControlVisible("light")` es `false` con las demás armonías, aunque no esté oculto.
- **Desactivar** `hex`, `model`, `harmony` y `light` desactiva su elemento nativo; `help` desactiva su botón y cierra la explicación; `results` atenúa las muestras. Con la rueda desactivada, además, el anillo y el triángulo no responden y salen del orden de tabulación.
- **El hex** se aplica al confirmarlo (Intro o al salir del campo). Acepta `#rgb` o `#rrggbb`, con o sin `#`. Si no es válido, el campo se marca (`aria-invalid`), muestra el error enlazado con `aria-describedby` y la rueda no cambia.

### 6.4. API

Las opciones, las propiedades, los métodos, los eventos y el resultado, con sus valores válidos, sus valores por defecto y sus errores, están en la referencia de la API, que se genera desde el código con `pnpm docs:api` ([README](../README.md#comandos)). Esta sección recoge solo las reglas de comportamiento.

- **Opciones y propiedades**: son las mismas. Solo el color es obligatorio. Cada propiedad se lee y se asigna, y asignarla equivale a `update` con ella.
- **Validación**: los valores no válidos, las claves desconocidas y las listas vacías o con repetidos lanzan un error que dice qué falla (§1), y no se aplica nada. Asignar un valor igual al actual no emite `change`.
- **Listas de armonías y modelos**: la armonía y el modelo tienen que estar en las listas que ofrecen los selectores. Para cambiar una lista y su valor a la vez está `update`. Si una lista no incluye el valor por defecto y no se indica otro, se toma el primero de la lista.
- **Cambio de modelo** ([ADR-0021](adr/0021-cambio-modelo-conserva-color.md)): la rueda conserva el color base, no su posición. Convierte a la otra rueda el último hex que recibió (por la propiedad, el campo hex, `update` o `setState`), no el color alcanzado, para que ir y volver no pierda los colores que el triángulo RYB no alcanza. Al arrastrar o usar el teclado, la posición pasa a mandar y ese hex se olvida.
- **El color, al leerse**, es la base que muestra la rueda: en RYB, el color alcanzado (§3.2). El estado que se guarda con `getState`, en cambio, lleva el último hex recibido, o la base si se movió la rueda.
- **Eventos**: `input` se emite continuamente mientras se arrastra en el anillo o en el triángulo, y `change`, al soltar y con cualquier otro cambio (teclado, controles, propiedades y métodos). `change` solo se emite si cambian el estado o el resultado, y nunca al crear la rueda. Cada evento dice si el cambio lo hizo la persona o el código, para que la web no responda a sus propios cambios en un bucle.
- **Resultado**: la armonía, el modelo, la luz (solo con el esquema de miniatura) y los colores, cada uno con su papel y su hex, en el orden de §4.
- **Después de `destroy`**, cualquier llamada es un error.

### 6.5. Textos e idiomas

- **Idiomas incluidos**: `en`, `es`, `ca`, `eu`, `gl`, `fr`, `de`, `it`, `pt-BR`, `ru`, `zh-Hans`, `ja` y `ko`. Cada uno es un fichero JSON del paquete.
- **El tipo `Labels` es la referencia**: sus claves salen de las listas del código (armonías, papeles, modelos, luces y controles), así que un texto que falte en un JSON es un error de compilación. Los tests comprueban además que todos los idiomas tienen las mismas claves que el inglés. El tipo se entrega en las declaraciones, sin depender de los JSON.
- **Idioma por defecto**: el primero de `navigator.languages` que coincida con uno incluido, primero exacto y después por idioma base (`pt-PT` → `pt-BR`). Si no hay ninguno, inglés. El paquete exporta esa misma regla (`resolveLocale`), para que una web elija el idioma de sus textos igual que la rueda. También exporta los textos de cada idioma (`labelsFor`), para que una web nombre las armonías y los papeles igual que la rueda sin crearla, por ejemplo al renderizar en el servidor. Y el nombre de cada color de un resultado (`colorNames`): su papel, numerado si se repite.
- **Claves anidadas**, un bloque por grupo de textos (`harmony`, `role`, `model`, `light`, `control` y `wheel`, con los nombres accesibles, los valores anunciados, la ayuda y los avisos). Algunos textos de `wheel` llevan marcadores, como `{hue}` o `{count}`, que se sustituyen por su valor:

  ```json
  {
    "harmony": { "triad": "Tríada" },
    "role": { "light": "Luz" },
    "control": { "light": "Tipo de luz" }
  }
  ```

- **`labels`** sustituye solo los textos que se le pasen, con la misma forma (`{ harmony: { triad: "Paleta" } }`). El resto sale del idioma. Una clave que no existe es un error que la nombra con su ruta completa, por ejemplo `harmony.triadd`.
- **Cargar textos desde una URL** lo hace la web, por ejemplo así:

  ```js
  const labels = await fetch("/i18n/es-custom.json").then((r) => r.json());
  new ColorWheel(el, { color: "#3daf44", locale: "es", labels });
  ```

### 6.6. Estilos

- Fichero aparte, `style.css` (en el código, `src/ui/style.css`), que la web incluye con `<link>` o con `import "@chromatic-wheel/color-wheel/style.css"`.
- Clases con el prefijo `cw-`, y el aspecto se adapta con variables CSS con el prefijo `--cw-`: `--cw-font`, `--cw-font-size`, `--cw-text`, `--cw-muted`, `--cw-surface`, `--cw-elevated` (lo que flota, como la ayuda), `--cw-shadow`, `--cw-field`, `--cw-border`, `--cw-focus`, `--cw-error`, `--cw-color-scheme`, `--cw-radius`, `--cw-gap`, `--cw-padding`, `--cw-control-height`, `--cw-wheel-max-size`, `--cw-panel-max-size` y `--cw-max-size`.
- Valores por defecto para tema claro y oscuro, con contraste AA. La rueda pinta su propio fondo (`--cw-surface`), para que sus textos contrasten en cualquier página.
- **Tema**: la rueda sigue el del sistema (`prefers-color-scheme`) salvo que la página defina `--cw-color-scheme` como `light` o `dark`, que hereda su raíz como `color-scheme`. Así la página elige el tema sin llamar a ninguna API. Cada color se escribe una vez, con `light-dark(claro, oscuro)`. En los navegadores sin `light-dark()` (anteriores a 2024), la rueda se ve siempre en claro.
- El anillo de foco del canvas toma el color de `--cw-focus` ya resuelto para el tema, a través del `color` del propio canvas.
- Los controles miden al menos 44 px de alto (`--cw-control-height`), para el dedo.
- **Iconos**: `circle-question-mark` (ayuda) y `x` (cerrar) de [Lucide](https://lucide.dev), la librería de iconos del proyecto. Se copian en `src/ui/icons.ts` en lugar de depender de `lucide` por dos iconos: un paquete publicable no gana nada con una dependencia que publica versión casi a diario. La copia indica su origen y versión y conserva los avisos de licencia (ISC de Lucide y MIT de Feather, de donde derivan los dos), que el build mantiene en el `dist/`. Se crean con el DOM, sin texto HTML, y son decorativos (`aria-hidden`): el botón de cerrar tiene su nombre accesible. Además, el desplegable de armonía dibuja `chevron-down` en su CSS, como máscara pintada con `--cw-muted`, porque el chevron del navegador queda pegado al borde y no se puede separar; su aviso de licencia está con los otros, en `icons.ts`. En el modo de colores forzados se pinta con el color del texto del sistema. Si `color-wheel` necesitara varios iconos más, se reconsideraría la dependencia.
- Los colores de cada muestra se asignan con CSSOM (`element.style`), que una CSP estricta permite.

## 7. Cálculo sin interfaz

El paquete exporta los cálculos, que no usan el DOM:

- **El cálculo de una armonía** da el mismo resultado que el componente con las mismas propiedades (§6.4). Solo el color es obligatorio, y el resto toma los valores por defecto del componente. La luz se valida siempre, pero solo aparece en el resultado con el esquema de miniatura. Una opción desconocida es un error.
- **Las conversiones** entre un hex y la representación de §2, en los dos sentidos. Al convertir un hex, se puede indicar el tono que reciben los colores sin tono (§3.2).

Con npm se importan por su nombre (`import { compute } from "@chromatic-wheel/color-wheel"`). En el fichero para `<script src>`, el global `ColorWheel` es la clase, y los cálculos son sus métodos estáticos (`ColorWheel.compute`, `ColorWheel.toWheelColor` y `ColorWheel.fromWheelColor`). En npm también existen esos métodos estáticos, que llaman a las mismas funciones.

Por dentro, `compute` y el componente usan el mismo cálculo, que da cada color con su papel, su hex y su posición en la rueda. `compute` quita la posición; el componente la usa para dibujar la plantilla. Los colores que salen de una mezcla (sombra, luz y variaciones del monocromático) se colocan convirtiendo su hex a la rueda.

## 8. Paquete

### 8.1. Módulos

```
packages/color-wheel/src/
  color/        representación (§2) y modelos (§3)
  mixing/       mezclas con spectral.js (§5)
  harmony/      armonías y variaciones del monocromático (§4)
  scheme/       esquema de miniatura (§5.1-5.2)
  calculation/  cálculo común de todas las armonías, valores por defecto, resultado y `compute` (§7)
  i18n/         idiomas en JSON (`texts.ts`) y resolución del idioma (`locales.ts`) (§6.5)
  ui/           componente, dibujo, controles y eventos (§6). El único que usa el DOM
    testing/    ayudas de los tests de navegador: entrada real y axe-core (§8.3)
  errors.ts     ayudas comunes para los mensajes de error (§1)
  index.ts      API pública, para npm
  index.umd.ts  entrada del fichero para `<script src>`: exporta solo la clase (§7)
```

Dependencias entre módulos: `errors.ts` no depende de nada y lo pueden usar todos; `color` y `mixing` no dependen de nada más del paquete; `i18n`, tampoco; `harmony` depende de `color` y `mixing`; `scheme`, de `color`, `mixing` y `harmony`; `calculation`, de `color`, `harmony` y `scheme`; `ui`, de todos; `index.ts` e `index.umd.ts`, de todos. No se admiten ciclos.

Como en el [ADR-0018](adr/0018-organizacion-codigo-patrones.md), la regla de que solo `ui` use el DOM la hacen cumplir las herramientas: `tsconfig.lib.json` compila los cálculos sin la librería DOM y fallaría si uno importara `ui`; `tsconfig.ui.json` añade el DOM para `ui` y las entradas, y `tsconfig.dev.json`, además, los tipos de Vite para los tests de navegador y la página de pruebas.

### 8.2. Compilación

`pnpm build` en el paquete ejecuta Vite en modo librería y después `tsc`, y genera:

- un módulo ESM sin culori ni spectral.js, para las webs que instalan con npm (`dist/color-wheel.js`, desde `src/index.ts`);
- un fichero UMD con todo dentro, para `<script src>`, que es el que sirven los CDN (`dist/color-wheel.umd.js`, desde `src/index.umd.ts`);
- `style.css`, copiado tal cual por un plugin de Vite de pocas líneas (`dist/style.css`, exportado como `./style.css`);
- las declaraciones `.d.ts` de la API pública.

spectral.js no trae tipos, así que el paquete incluye su declaración (`src/mixing/spectral.d.ts`) para compilar. No se entrega, porque la API pública no la usa: no expone objetos de culori ni de spectral.js, solo datos propios (hex y colores de la rueda). Si algún día ofrece mezclas, lo hará con funciones y datos propios, para que un cambio en esas librerías no rompa a quien use el paquete.

Las dos pasadas de Vite (el módulo ESM y el UMD) son necesarias porque cada fichero deja fuera dependencias distintas.

**Dentro del monorepo**, el `exports` del paquete tiene dos rutas:

- la normal, al `dist/`, que es la que recibiría cualquier otra web;
- una condición propia, `@chromatic-wheel/source`, al código fuente (`src/index.ts` y `src/ui/style.css`).

La web activa la condición en su servidor de desarrollo, para ver los cambios de la rueda sin compilarla, y la desactiva al generar la versión desplegable, que así usa el `dist/`. Su comprobación de tipos, su lint y sus tests leen el código fuente ([docs/07](07-web.md)).

### 8.3. Tests

Vitest con dos proyectos:

- **Node**, para `color`, `mixing`, `harmony`, `scheme`, `calculation` e `i18n`;
- **Navegador**, en Chromium con Playwright, para `ui` (ficheros `*.browser.test.ts`), con los estilos cargados.

Los dos corren en local y en la CI. La CI guarda Chromium en caché según la versión de Playwright.

- **Entrada real**: el ratón y el dedo se simulan con el protocolo de DevTools de Chromium (`cdp()` de Vitest, `Input.dispatchMouseEvent` e `Input.dispatchTouchEvent`), así que los eventos pasan por el mismo camino que los de una persona, con coordenadas reales. El contexto del navegador tiene pantalla táctil (`hasTouch`). El teclado usa `userEvent`.
- **Accesibilidad automática**: [axe-core](https://github.com/dequelabs/axe-core) (MPL-2.0, sin dependencias, solo en desarrollo) revisa el componente con las reglas de WCAG 2.2 A y AA en varios estados: por defecto, desactivado, con controles desactivados, con un hex no válido, en japonés y con el tema oscuro. Es el motor de referencia (el de Lighthouse) y se usa directamente, sin adaptadores. No revisa el contenido del canvas ni sustituye las pruebas a mano con teclado y lector de pantalla.

### 8.4. Página de pruebas

`pnpm --filter @chromatic-wheel/color-wheel dev` sirve `playground/` con Vite. Carga el código fuente, no el `dist/`, y se recarga con cada cambio. Tiene la rueda, un registro de los eventos con su `source`, y controles para el ancho del contenedor, el idioma, ocultar y desactivar cada control, desactivar la rueda, `getState`, `setState` y `destroy`. No se entrega en el paquete.

Para abrirla desde el móvil, Vite tiene que escuchar en la red: `pnpm --filter @chromatic-wheel/color-wheel dev --host`. En WSL 2 hace falta, además, el modo de red `mirrored` (`networkingMode=mirrored` en `.wslconfig`) o reenviar el puerto desde Windows.

## 9. Prototipos

Demos hechas al diseñar la rueda, con código reutilizable. Son artifacts privados de claude.ai: solo los abre su propietario. Usan el modelo digital y no siguen todas las reglas de este documento.

- [Rueda segmentada o continua](https://claude.ai/artifact/Hrto4CEvdkXeKM4nZqGvEn): compara una rueda de 12 segmentos con una continua, y la base limitada a un segmento frente a la base exacta.
- [Rueda con variaciones](https://claude.ai/artifact/Vn7s24dhM7PVzAYS2rM8Lk): la rueda de anillos de AK frente a la del anillo de tono con triángulo, que es la elegida. Su dibujo en Canvas y su interacción son casi la versión final.
- [Comparador de mezclas](https://claude.ai/artifact/BBABt2imHVGbrZQgxuxh79): la misma mezcla en RGB, RGB lineal, OKLab y con Kubelka-Munk (spectral.js), con colores del catálogo.
