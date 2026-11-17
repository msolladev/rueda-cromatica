// Comprueba que el proyecto de navegador funciona: los cálculos públicos se
// ejecutan en Chromium. Los tests de `ui` llegarán con el componente.
import { expect, it } from "vitest";

import { compute } from "./index.ts";

it("computes the miniature scheme in the browser", () => {
  const result = compute({ color: "#3daf44" });
  expect(result.colors).toHaveLength(6);
  // Sin la librería DOM en los tipos: solo se comprueba que hay un documento.
  expect(typeof (globalThis as { document?: unknown }).document).toBe("object");
});
