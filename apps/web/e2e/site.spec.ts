import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const sitemap = readFileSync(
  new URL("../dist/sitemap.xml", import.meta.url),
  "utf8",
);
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => new URL(m[1] ?? "").pathname,
);

test("serves every page of the sitemap, in its language", async ({
  request,
}) => {
  expect(paths).toHaveLength(21);
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    const lang = /<html lang="([^"]+)">/.exec(html)?.[1];
    // The URL has the language in lower case: /pt-br/ is pt-BR.
    expect(lang?.toLowerCase(), path).toBe(
      path === "/" ? "en" : path.split("/")[1],
    );
    expect(html, path).toContain(`<link rel="canonical"`);
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the home page shows the example with its paints", async ({ page }) => {
    await page.goto("/es/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Rueda cromática para pintar miniaturas",
    );
    // The six colors, one after the other, each with its paints.
    await expect(page.locator(".panel")).toHaveCount(6);
    for (const panel of await page.locator(".panel").all())
      await expect(panel).toBeVisible();
    await expect(page.getByText("Moot Green").first()).toBeVisible();
    // Playwright turns scripts off without changing how <noscript> is
    // parsed, so its text is checked in the HTML.
    expect(await page.content()).toContain(
      "La rueda interactiva necesita JavaScript.",
    );
  });

  test("the credits page shows every source", async ({ page }) => {
    await page.goto("/en/credits/");
    await expect(
      page.getByRole("heading", { name: "Citadel Official Colours Table" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "react", exact: false }).first(),
    ).toBeVisible();
  });
});

test("`/` goes to the detected language", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/fr\/$/);
  await context.close();
});

test("the language selector goes to the same page in another language", async ({
  page,
}) => {
  await page.goto("/es/credits/");
  await page.getByLabel("Idioma · Language").selectOption("de");
  await expect(page).toHaveURL(/\/de\/credits\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  // And `/` remembers it.
  await page.goto("/");
  await expect(page).toHaveURL(/\/de\/$/);
});
