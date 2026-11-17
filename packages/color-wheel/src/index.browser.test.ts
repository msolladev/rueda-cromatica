// Checks that the browser project works: the public calculations run in
// Chromium. The `ui` tests will come with the component.
import { expect, it } from "vitest";

import { compute } from "./index.ts";

it("computes the miniature scheme in the browser", () => {
  const result = compute({ color: "#3daf44" });
  expect(result.colors).toHaveLength(6);
  // Without the DOM library in the types: it only checks there is a document.
  expect(typeof (globalThis as { document?: unknown }).document).toBe("object");
});
