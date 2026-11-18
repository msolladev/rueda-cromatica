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

test.describe("the theme from the first paint", () => {
  test("every page declares the color scheme before its stylesheet", async ({
    request,
  }) => {
    for (const path of paths) {
      const html = await (await request.get(path)).text();
      const meta = html.indexOf(
        '<meta name="color-scheme" content="light dark" />',
      );
      const css = html.indexOf('rel="stylesheet"');
      expect(meta, path).toBeGreaterThan(-1);
      expect(meta, path).toBeLessThan(css);
    }
  });

  test("the saved theme is applied before the page shows", async ({
    browser,
  }) => {
    // The system in dark and «Light» chosen: the page must start light.
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/es/");
    await page.evaluate(() => {
      localStorage.setItem(
        "rueda-cromatica.preferences.v1",
        JSON.stringify({ theme: "light" }),
      );
    });
    // Read before any script of the app runs: only the inline one has.
    await page.route("**/assets/*.js", (route) => route.abort());
    await page.goto("/es/credits/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      "light",
    );
    expect(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    ).toBe("rgb(246, 247, 249)");
    await context.close();
  });
});

test.describe("saved preferences", () => {
  const saved = {
    filters: {
      excludedBrands: ["vallejo"],
      extraTypes: [],
      includeMetallic: false,
      includeDiscontinued: false,
    },
    view: "by-brand",
    theme: "system",
    locale: null,
    installDismissed: false,
    wheel: {
      color: "#dc212f",
      model: "ryb",
      harmony: "complementary",
      light: "warm",
    },
  };

  test("the defaults of the prerendered page are never seen", async ({
    page,
  }) => {
    await page.goto("/es/credits/");
    // Once the page has saved its own (default) preferences, so that it does
    // not overwrite these.
    await page.waitForFunction(
      () => localStorage.getItem("rueda-cromatica.preferences.v1") !== null,
    );
    await page.evaluate((value) => {
      localStorage.setItem(
        "rueda-cromatica.preferences.v1",
        JSON.stringify(value),
      );
    }, saved);
    // On every frame from the start, note whether the wheel and the results
    // were visible with the defaults (the six colors of the scheme).
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { seen: string[] }).seen = seen;
      const check = () => {
        const workspace = document.querySelector(".workspace");
        if (
          workspace !== null &&
          getComputedStyle(workspace).visibility === "visible"
        ) {
          seen.push(
            `${String(document.querySelectorAll('[role="tab"]').length)} tabs`,
          );
        }
        if (seen.length < 200) requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    await page.goto("/es/");
    await expect(page.locator('[role="tab"]')).toHaveCount(2);
    await expect(page.locator("html")).not.toHaveAttribute("data-restoring");
    await expect(
      page.locator(".panel:not([hidden]) .brand-heading"),
    ).toHaveCount(3);
    const seen = await page.evaluate(
      () => (window as unknown as { seen: string[] }).seen,
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((frame) => frame !== "2 tabs")).toEqual([]);
  });

  test("without the app, the wheel and the results are hidden for 3 s at most", async ({
    page,
  }) => {
    await page.goto("/es/credits/");
    // Once the page has saved its own (default) preferences, so that it does
    // not overwrite these.
    await page.waitForFunction(
      () => localStorage.getItem("rueda-cromatica.preferences.v1") !== null,
    );
    await page.evaluate((value) => {
      localStorage.setItem(
        "rueda-cromatica.preferences.v1",
        JSON.stringify(value),
      );
    }, saved);
    await page.route("**/assets/*.js", (route) => route.abort());
    await page.goto("/es/");
    await expect(page.locator("html")).toHaveAttribute("data-restoring", "");
    await expect(page.locator(".workspace")).toBeHidden();
    await expect(page.locator(".workspace")).toBeVisible({ timeout: 5000 });
  });
});
