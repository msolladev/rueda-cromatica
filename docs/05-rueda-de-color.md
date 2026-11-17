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
- **Interacción**: arrastrar en el anillo cambia el tono, y arrastrar en el triángulo cambia las proporciones.
- **Canvas**, con nitidez ajustada a la densidad de la pantalla. La rueda ocupa el ancho de su contenedor, hasta `--cw-wheel-max-size`.
  - El anillo es un degradado cónico por las seis esquinas del modelo, y el triángulo, el negro más dos degradados lineales que se suman (el puro y el blanco, cada uno desde su vértice hasta el lado opuesto). Las dos cosas son exactas: los colores puros de los dos modelos varían de forma lineal entre esquinas (§3), y en un triángulo equilátero cada degradado es el peso de su vértice (§2).
  - Las marcas y el punto de la base son blancos con un halo oscuro, para que se vean sobre cualquier color.
- **Ratón, teclado y pantalla táctil**, todo con la misma precisión:
  - **Ratón y lápiz**, con Pointer Events: el punto va a donde está el puntero.
  - **Táctil**, con Pointer Events: el punto no salta bajo el dedo. Se mueve lo mismo que el dedo, esté donde esté el dedo, así que sigue a la vista. En el anillo, el tono gira lo mismo que gira el dedo alrededor del centro. Un toque sin desplazamiento (menos de 6 px) sí coloca el punto donde cae, para los saltos grandes.
  - **Teclado**: el anillo y el triángulo son deslizadores (`role="slider"`) que reciben el foco, y el foco se dibuja alrededor de su forma.
    - Anillo: ← y ↓ restan 1°, → y ↑ suman 1°; con Mayúsculas, 10°. Re Pág y Av Pág mueven 30°, un paso de la rueda de 12 tonos.
    - Triángulo: → y ← suben o bajan el color puro un 1 % y conservan la relación entre blanco y negro; ↑ y ↓ pasan un 1 % del negro al blanco, o al revés, y conservan el color puro. Con Mayúsculas, un 10 %. Los ejes significan siempre lo mismo, gire como gire el triángulo.
    - El lector de pantalla anuncia el tono («30°») y las proporciones («45 % puro, 10 % blanco, 45 % negro»), y cada deslizador enlaza su explicación de teclas con `aria-describedby`.
- **HTML semántico**: los controles son elementos nativos (`<input>`, `<select>`, `<details>`, `<label>`) y la lista de resultados es una lista (`<ol>`). Todo tiene nombre accesible. Los cambios de un control que cambian los colores se anuncian en una región `role="status"` («6 colores: Esquema de miniatura.»); los del anillo y el triángulo los anuncian los propios deslizadores.
- **Adaptable**: un único marcado, con consultas de contenedor, no de pantalla.
  - Con el contenedor estrecho, todo va en una columna. Desde 40rem de ancho del contenedor, la rueda a la izquierda y el panel a la derecha, centrados y cada uno con su ancho máximo (`--cw-wheel-max-size` y `--cw-panel-max-size`). El componente entero mide como mucho `--cw-max-size` y se centra.
  - Controles: Hex y Modelo en la primera fila, y Armonía y Luz, cada una a todo el ancho, porque los nombres de las armonías son los más largos en todos los idiomas. Ningún texto se corta ni se parte.
  - Resultados: una lista de filas, con la muestra, el papel y el hex. Una columna, salvo con el contenedor estrecho pero de 28rem o más, donde van en dos.

### 6.3. Controles

| Control   | Qué hace                                                                   |
| --------- | -------------------------------------------------------------------------- |
| `hex`     | Campo para leer o escribir el color base en hex                            |
| `model`   | Selector segmentado de modelo: RYB o digital                               |
| `harmony` | Selector de armonía, con las de `harmonies`                                |
| `light`   | Selector segmentado de luz cálida o fría. Solo con el esquema de miniatura |
| `results` | Lista de los colores resultantes, con su papel                             |
| `help`    | «Cómo se usa», plegado y con icono: el manejo con puntero, dedo y teclado  |

El anillo y el triángulo no se pueden ocultar: son la rueda.

- **Selectores segmentados** para los controles de pocas opciones (`model` y `light`): botones de opción nativos (`<input type="radio">` en un `<fieldset>` con `<legend>`), que se ven todos a la vez, se cambian de un toque y se recorren con las flechas. La armonía, con nueve opciones, es un `<select>`.

- **`light`** solo es visible con el esquema de miniatura: `isControlVisible("light")` es `false` con las demás armonías, aunque no esté oculto.
- **Desactivar** `hex`, `model`, `harmony` y `light` desactiva su elemento nativo; `help` no se puede desplegar; `results` atenúa las muestras. Con la rueda desactivada, además, el anillo y el triángulo no responden y salen del orden de tabulación.
- **El hex** se aplica al confirmarlo (Intro o al salir del campo). Acepta `#rgb` o `#rrggbb`, con o sin `#`. Si no es válido, el campo se marca (`aria-invalid`), muestra el error enlazado con `aria-describedby` y la rueda no cambia.

### 6.4. Opciones y propiedades

Las opciones del constructor y las propiedades son las mismas. Cada propiedad se lee y se asigna, y al asignarse valida el valor.

| Propiedad   | Valor                                         | Por defecto                   |
| ----------- | --------------------------------------------- | ----------------------------- |
| `color`     | hex                                           | Obligatoria en el constructor |
| `model`     | `"ryb"` o `"digital"`                         | `"ryb"`                       |
| `harmony`   | uno de los valores de §4                      | `"miniature-scheme"`          |
| `light`     | `"warm"` o `"cold"`                           | `"warm"`                      |
| `harmonies` | lista de valores de §4 que ofrece el selector | todos                         |
| `models`    | lista de modelos que ofrece el selector       | los dos                       |
| `locale`    | uno de los idiomas de §6.8                    | el del navegador, o `"en"`    |
| `labels`    | objeto con los textos que se sustituyen       | `{}`                          |

Además, en el constructor:

- `hiddenControls` y `disabledControls`: listas de controles de §6.3;
- `disabled`: `true` para desactivar toda la rueda.

Asignar una armonía o un modelo que no esté en `harmonies` o en `models` es un error, y también asignar unas `harmonies` o unos `models` que no incluyan los actuales: para cambiar los dos a la vez está `update`. Si `harmonies` o `models` no incluyen el valor por defecto y no se indica otro, se toma el primero de la lista.

Los valores no válidos, las opciones desconocidas y las listas vacías o con repetidos lanzan un error que dice qué falla (§1), y no se aplica nada. Asignar un valor igual al actual no emite `change`.

**Cambio de modelo** ([ADR-0021](adr/0021-cambio-modelo-conserva-color.md)): la rueda conserva el color base, no su posición. Convierte a la otra rueda el último hex que recibió (por `color`, el campo hex, `update` o `setState`), no el color alcanzado, para que ir y volver no pierda los colores que el triángulo RYB no alcanza. Al arrastrar o usar el teclado, la posición pasa a mandar y ese hex se olvida.

**`color` al leerse** devuelve la base que muestra la rueda: en RYB, el color alcanzado (§3.2).

### 6.5. Métodos

| Método                                        | Qué hace                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `hideControl(name)`, `showControl(name)`      | Oculta o muestra un control                                             |
| `isControlVisible(name)`                      | Dice si un control está visible                                         |
| `disableControl(name)`, `enableControl(name)` | Desactiva o activa un control                                           |
| `isControlEnabled(name)`                      | Dice si un control está activo                                          |
| `disable()`, `enable()`, `isDisabled()`       | Lo mismo para toda la rueda                                             |
| `update(partial)`                             | Cambia varias propiedades a la vez y emite un solo `change`             |
| `getState()`, `setState(state)`               | Lee o restaura todas las propiedades y el estado de los controles       |
| `getResult()`                                 | Devuelve el resultado actual                                            |
| `getEffectiveLabels()`                        | Devuelve los textos que se muestran: los del idioma más los sustituidos |
| `destroy()`                                   | Quita la rueda y sus oyentes. Después, cualquier llamada es un error    |
| `ColorWheel.locales`                          | Propiedad estática con los idiomas incluidos                            |

- **`getState()`** devuelve las propiedades, más `hiddenControls`, `disabledControls` y `disabled`. Su `color` es el último hex recibido (ADR-0021) o, si se movió la rueda, la base.
- **`setState(state)`** necesita un estado completo, como el que devuelve `getState()`.

### 6.6. Eventos

La clase hereda de `EventTarget`, así que se escucha con `addEventListener`.

- **`input`**: se emite continuamente mientras el usuario arrastra en el anillo o en el triángulo.
- **`change`**: se emite al soltar, y con cada cambio que no sea un arrastre: el teclado, los controles, las propiedades, los métodos, `update` y `setState`. Solo se emite si cambian el estado o el resultado, y nunca al crear la rueda.

El `detail` de los dos es `{ result, state, source }`, donde `source` vale `"user"` o `"api"`. Sirve para que la web no responda a sus propios cambios en un bucle.

### 6.7. Resultado

```js
{
  harmony: "miniature-scheme",
  model: "ryb",
  light: "warm",            // solo en el esquema de miniatura
  colors: [
    { role: "base", hex: "#3daf44" },
    { role: "shadow", hex: "#…" },
    { role: "light", hex: "#…" },
    { role: "triad", hex: "#…" },
    { role: "triad", hex: "#…" },
    { role: "complement", hex: "#…" },
  ],
}
```

Los papeles y su orden son los de §4.

### 6.8. Textos e idiomas

- **Idiomas incluidos**: `en`, `es`, `fr`, `de`, `it`, `pt-BR`, `ru`, `zh-Hans`, `ja` y `ko`. Cada uno es un fichero JSON del paquete.
- **El tipo `Labels` es la referencia**: sus claves salen de las listas del código (armonías, papeles, modelos, luces y controles), así que un texto que falte en un JSON es un error de compilación. Los tests comprueban además que todos los idiomas tienen las mismas claves que el inglés. El tipo se entrega en las declaraciones, sin depender de los JSON.
- **Idioma por defecto**: el primero de `navigator.languages` que coincida con uno incluido, primero exacto y después por idioma base (`pt-PT` → `pt-BR`). Si no hay ninguno, inglés.
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

### 6.9. Estilos

- Fichero aparte, `style.css` (en el código, `src/ui/style.css`), que la web incluye con `<link>` o con `import "@chromatic-wheel/color-wheel/style.css"`.
- Clases con el prefijo `cw-`, y el aspecto se adapta con variables CSS con el prefijo `--cw-`: `--cw-font`, `--cw-font-size`, `--cw-text`, `--cw-muted`, `--cw-surface`, `--cw-field`, `--cw-border`, `--cw-focus`, `--cw-error`, `--cw-radius`, `--cw-gap`, `--cw-padding`, `--cw-control-height`, `--cw-wheel-max-size`, `--cw-panel-max-size` y `--cw-max-size`.
- Valores por defecto para tema claro y oscuro, según `prefers-color-scheme`, con contraste AA. La rueda pinta su propio fondo (`--cw-surface`), para que sus textos contrasten en cualquier página.
- Los controles miden al menos 44 px de alto (`--cw-control-height`), para el dedo.
- **Icono de ayuda**: `circle-question-mark` de [Lucide](https://lucide.dev), la librería de iconos del proyecto. Se copia en `src/ui/icons.ts` en lugar de depender de `lucide` por un solo icono: un paquete publicable no gana nada con una dependencia que publica versión casi a diario. La copia indica su origen y versión y conserva los avisos de licencia (ISC de Lucide y MIT de Feather, de donde deriva el icono), que el build mantiene en el `dist/`. Se crea con el DOM, sin texto HTML, y es decorativo (`aria-hidden`). Si `color-wheel` necesitara varios iconos, se reconsideraría la dependencia.
- Los colores de cada muestra se asignan con CSSOM (`element.style`), que una CSP estricta permite.

## 7. Cálculo sin interfaz

El paquete exporta los cálculos, que no usan el DOM:

- `compute({ color, model, harmony, light })`: devuelve el mismo resultado que §6.7.
  - Solo `color` es obligatorio. `model`, `harmony` y `light` toman los valores por defecto del componente (§6.4).
  - `light` se valida siempre, pero solo aparece en el resultado con el esquema de miniatura.
  - Una opción desconocida es un error.
- `toWheelColor(hex, model, previousHue)` y `fromWheelColor(wheelColor, model)`: convierten entre un hex y la representación de §2. `previousHue` es opcional y es el tono que reciben los colores sin tono (§3.2).

Con npm se importan por su nombre (`import { compute } from "@chromatic-wheel/color-wheel"`). En el fichero para `<script src>`, el global `ColorWheel` es la clase, y los cálculos son sus métodos estáticos: `ColorWheel.compute(...)`, `ColorWheel.toWheelColor(...)` y `ColorWheel.fromWheelColor(...)`. En npm también existen esos métodos estáticos, que llaman a las mismas funciones.

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
  i18n/         idiomas en JSON (`texts.ts`) y resolución del idioma (`locales.ts`) (§6.8)
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

La web activa la condición en su servidor de desarrollo, para ver los cambios de la rueda sin compilarla, y la desactiva al generar la versión desplegable, que así usa el `dist/`. Su comprobación de tipos y su lint leen el código fuente. Se configura en la etapa 5.

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
