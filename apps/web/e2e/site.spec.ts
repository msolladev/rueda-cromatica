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
  expect(paths).toHaveLength(27);
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

test("serves each page also without the final `/`, without redirecting", async ({
  page,
}) => {
  for (const [path, title] of [
    ["/es", "Encuentra la pintura de cada color de tu esquema"],
    ["/en/credits", "Credits and sources"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(response?.request().redirectedFrom(), path).toBeNull();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    // The canonical URL is still the one with the final `/`.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${path}/$`),
    );
  }
  // The links are absolute, so they work from either address.
  await page.getByRole("link", { name: "Back to the wheel" }).click();
  await expect(page).toHaveURL(/\/en\/$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the home page shows the example with its paints", async ({ page }) => {
    await page.goto("/es/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Encuentra la pintura de cada color de tu esquema",
    );
    // The six colors, one after the other, each with its paints.
    await expect(page.locator(".panel")).toHaveCount(6);
    for (const panel of await page.locator(".panel").all())
      await expect(panel).toBeVisible();
    await expect(
      page.locator(".paint-name", { hasText: "Moot Green" }).first(),
    ).toBeVisible();
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
    for (const chart of [
      "Game Color chart (CC266)",
      "Warpaints Fanatic Conversion Chart",
    ]) {
      await expect(page.getByRole("heading", { name: chart })).toBeVisible();
    }
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

test("`/` shows nothing before going to the language", async ({ page }) => {
  // On every frame at `/`, whether the list of languages could be seen.
  await page.addInitScript(() => {
    if (location.pathname !== "/") return;
    const check = () => {
      const visible = getComputedStyle(document.body).visibility === "visible";
      if (visible) sessionStorage.setItem("seen-root", "1");
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/en\/$|\/[a-z-]+\/$/);
  expect(await page.evaluate(() => sessionStorage.getItem("seen-root"))).toBe(
    null,
  );
});

test.describe("an unknown address", () => {
  test("answers 404 with «Page not found» in the language of the address", async ({
    page,
  }) => {
    for (const [path, title] of [
      ["/es/inventada/", "Página no encontrada"],
      ["/de/danksagungen/mehr", "Seite nicht gefunden"],
      ["/no-existe", "Page not found"],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex",
      );
    }
  });

  test("leads to the wheel in its language", async ({ page }) => {
    await page.goto("/es/inventada/");
    await page.getByRole("link", { name: "Ir a la rueda" }).click();
    await expect(page).toHaveURL(/\/es\/$/);
  });
});

test("the language selector goes to the same page in another language", async ({
  page,
}) => {
  await page.goto("/es/creditos/");
  await page.getByLabel("Idioma · Language").selectOption("de");
  await expect(page).toHaveURL(/\/de\/danksagungen\/$/);
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
    await page.goto("/es/creditos/");
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
    await page.goto("/es/creditos/");
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
    const seenFrames = () =>
      page.evaluate(() => (window as unknown as { seen: string[] }).seen);
    // Firefox slows down the frames of a window in the background (several
    // tests run at once): wait for one painted frame before looking.
    await expect
      .poll(async () => (await seenFrames()).length)
      .toBeGreaterThan(0);
    const seen = await seenFrames();
    expect(seen.filter((frame) => frame !== "2 tabs")).toEqual([]);
  });

  test("the tabs stop saying there are more once the saved harmony has fewer", async ({
    page,
  }) => {
    // The prerendered page has the six colors of the scheme, which do not
    // fit on a phone; the saved harmony has two, which do.
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addInitScript((value) => {
      localStorage.setItem(
        "rueda-cromatica.preferences.v1",
        JSON.stringify(value),
      );
    }, saved);
    await page.goto("/es/");
    await expect(page.locator('[role="tab"]')).toHaveCount(2);
    const bar = page.locator(".tabs-bar");
    await expect(bar).not.toHaveAttribute("data-more-start");
    await expect(bar).not.toHaveAttribute("data-more-end");
  });

  test("without the app, the wheel and the results are hidden for 3 s at most", async ({
    page,
  }) => {
    await page.goto("/es/creditos/");
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

test("choosing the last color tab does not make the tabs scroll on a wide screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/es/");
  await page.locator('[role="tab"]').last().click();
  await page.waitForTimeout(400);
  expect(
    await page
      .locator(".tabs")
      .evaluate((tabs) => tabs.scrollWidth - tabs.clientWidth),
  ).toBe(0);
});

test("moving between pages fades the content out and the new page in, without moving the bar", async ({
  page,
}) => {
  await page.goto("/es/");
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    const tick = () => {
      const main = document.querySelector(".main");
      const bar = document.querySelector(".navbar");
      if (main !== null && bar !== null) {
        seen.push(
          `${getComputedStyle(main).opacity}/${getComputedStyle(bar).opacity}`,
        );
      }
      if (seen.length < 40) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.locator('footer a[href="/es/creditos/"]').click();
  await expect(page).toHaveURL(/\/es\/creditos\/$/);
  await page.waitForTimeout(600);
  const seen = await page.evaluate(
    () => (window as unknown as { seen: string[] }).seen,
  );
  const main = seen.map((frame) => Number(frame.split("/")[0]));
  expect(main[0]).toBeLessThan(0.5);
  expect(main.at(-1)).toBe(1);
  expect(seen.every((frame) => frame.endsWith("/1"))).toBe(true);

  // Back from the browser's cache, the page is not left faded out.
  await page.goBack();
  await expect(page).toHaveURL(/\/es\/$/);
  await expect(page.locator(".main")).toHaveCSS("opacity", "1");
});

test("the install banner arrives with the page where the browser installs apps, and moves nothing", async ({
  page,
  browserName,
}) => {
  // Where the heading was on the first paint, before the app runs.
  await page.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      const heading = document.querySelector("h1");
      (window as unknown as { firstTop?: number | undefined }).firstTop =
        heading?.getBoundingClientRect().top;
    });
  });
  await page.goto("/es/");
  await expect(page.locator(".panel:not([hidden]) .paint")).toHaveCount(12);
  const banner = page.locator(".install-banner");
  // Chromium installs web apps; Firefox on the desktop does not.
  if (browserName === "chromium") await expect(banner).toBeVisible();
  else await expect(banner).toBeHidden();
  const firstTop = await page.evaluate(
    () => (window as unknown as { firstTop?: number }).firstTop,
  );
  const top = await page
    .locator("h1")
    .evaluate((heading) => heading.getBoundingClientRect().top);
  expect(top).toBe(firstTop);
});

test("on a phone, the official equivalences of a paint lead to another and back", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/es/");
  const field = page.getByRole("combobox", {
    name: "Empieza por una pintura que tengas",
  });
  await expect(field).toBeEnabled();
  await field.fill("moot green");
  await page
    .getByRole("option", { name: /Moot Green/ })
    .first()
    .tap();
  const official = page.getByRole("region", {
    name: "Equivalencias oficiales",
  });
  await expect(official.locator(".paint-name")).toHaveText([
    "Light Green",
    "Scorpion Green",
    "Leafy Green",
    "Snake Scales",
    "Scorpy Green",
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await official
    .getByRole("button", { name: "Usar Scorpy Green como base de la rueda" })
    .tap();
  await expect(field).toHaveValue("Scorpy Green");
  await page.getByRole("button", { name: "Volver a Moot Green" }).tap();
  await expect(field).toHaveValue("Moot Green");
  await context.close();
});

test("on a phone, a discontinued paint says so, and whether it has a replacement", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/es/");
  const field = page.getByRole("combobox", {
    name: "Empieza por una pintura que tengas",
  });
  await expect(field).toBeEnabled();
  await field.fill("necromancer cloak");
  const option = page.getByRole("option", { name: /Necromancer Cloak/ });
  await expect(option).toContainText("Descatalogada");
  await option.tap();
  await expect(field).toHaveValue("Necromancer Cloak");
  const official = page.getByRole("region", {
    name: "Equivalencias oficiales",
  });
  await expect(official.locator("h5").first()).toHaveText(
    "Necromancer Cloak se sustituye por",
  );
  await expect(official).toContainText(
    "Ningún documento del fabricante nombra una sustituta de Necromancer Cloak.",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await context.close();
});

test("no page is wider than a phone's screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of ["/es/", "/es/creditos/", "/es/no-existe/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      path,
    ).toBe(360);
  }
});

test("the tabs say on which side there are more, and go there when the arrow is pressed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/es/");
  await expect(page.locator(".panel:not([hidden]) .paint")).toHaveCount(12);
  const bar = page.locator(".tabs-bar");
  const start = page.locator(".tabs-more-start");
  const end = page.locator(".tabs-more-end");
  await expect(bar).not.toHaveAttribute("data-more-start");
  await expect(bar).toHaveAttribute("data-more-end");
  await end.click();
  await expect(bar).toHaveAttribute("data-more-start");
  await page.locator(".tabs").evaluate((tabs) => {
    tabs.scrollLeft = tabs.scrollWidth;
  });
  await expect(bar).not.toHaveAttribute("data-more-end");
  await start.click();
  await page.locator(".tabs").evaluate((tabs) => {
    tabs.scrollLeft = 0;
  });
  await expect(bar).not.toHaveAttribute("data-more-start");
  // On a wide screen every tab fits: no fade.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(bar).not.toHaveAttribute("data-more-end");
});
