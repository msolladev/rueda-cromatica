// Automatic accessibility check with axe-core, on the WCAG 2.2 A and AA rules.

import axe from "axe-core";
import { expect } from "vitest";

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export async function expectNoAxeViolations(context: Element): Promise<void> {
  const { violations } = await axe.run(context, {
    runOnly: { type: "tag", values: WCAG_AA },
  });
  expect(
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
}
