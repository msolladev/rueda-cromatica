# @chromatic-wheel/color-wheel

La rueda de color de la app, completa y sin pinturas: los modelos RYB y digital, las armonías, el esquema de miniatura (con mezclas que simulan pigmentos) y el componente que la dibuja, con su plantilla giratoria y sus controles. No depende de ningún framework ni del resto del monorepo, y se maneja con ratón, teclado y pantalla táctil.

Los cálculos no usan el DOM, así que también funcionan en Node.

## Ejemplo

```ts
import { ColorWheel, compute } from "@chromatic-wheel/color-wheel";
import "@chromatic-wheel/color-wheel/style.css";

const wheel = new ColorWheel(document.querySelector<HTMLElement>("#wheel")!, {
  color: "#3daf44",
  harmony: "miniature-scheme",
});

wheel.addEventListener("change", (event) => {
  for (const { role, hex } of event.detail.result.colors) {
    console.log(role, hex);
  }
});

// Los mismos colores, sin el componente:
console.log(compute({ color: "#3daf44", harmony: "triad" }).colors);
```

## Documentación

- Especificación: [docs/05](../../docs/05-rueda-de-color.md), con el porqué en el [ADR-0020](../../docs/adr/0020-rueda-paquete-independiente.md).
- Referencia de la API: se genera con `pnpm docs:api` ([README de la raíz](../../README.md#comandos)).
