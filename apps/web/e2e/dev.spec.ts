import { expect, test } from "@playwright/test";

test("the development server shows each page with its styles before any script runs", async ({
  page,
}) => {
  // What the browser shows before the app's JavaScript runs.
  await page.route(/\/src\/entry-client\.tsx|@vite\/client/, (route) =>
    route.abort(),
  );
  for (const path of ["/es/", "/es/credits/"]) {
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
