import { expect, test } from "@playwright/test";

test("the development server shows each page with its styles before any script runs", async ({
  page,
}) => {
  // What the browser shows before the app's JavaScript runs.
  await page.route(/\/src\/entry-client\.tsx|@vite\/client/, (route) =>
    route.abort(),
  );
  for (const path of ["/es/", "/es/creditos/"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () =>
          getComputedStyle(document.querySelector(".navbar") as Element)
            .position,
      ),
      path,
    ).toBe("sticky");
  }
});

test("the development server takes over each page without errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/es/");
  await expect(page.locator(".panel:not([hidden]) .paint")).toHaveCount(12);
  expect(errors).toEqual([]);
});

test("the development server serves the sitemap and answers 404 at unknown addresses", async ({
  page,
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.headers()["content-type"]).toContain("xml");
  expect(await sitemap.text()).toContain("/es/creditos/</loc>");
  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect((await request.get("/es")).status()).toBe(200);
  expect((await request.get("/es/creditos")).status()).toBe(200);
  const response = await page.goto("/es/inventada/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Página no encontrada",
  );
});
