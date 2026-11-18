import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const SW = new URL("../dist/sw.js", import.meta.url);

test.use({ serviceWorkers: "allow" });

/** Waits until the service worker controls the page. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller === null) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        });
      });
    }
  });
}

test("works offline after the first visit, in any page and language", async ({
  page,
  context,
}) => {
  await page.goto("/es/");
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".panel:not([hidden]) .paint")).toHaveCount(12);
  // The catalog also comes from the precache: changing a filter searches again.
  await page.getByText("Filtros", { exact: true }).click();
  await page.getByLabel("Vallejo").uncheck();
  await expect(page.locator(".panel:not([hidden]) .brand-heading")).toHaveCount(
    3,
  );

  await page.goto("/ja/credits/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "クレジットと出典",
  );
});

test("says there is a new version and updates when asked", async ({ page }) => {
  await page.goto("/en/");
  await waitForServiceWorker(page);

  // A new version: the same service worker with different bytes, as a new
  // build would publish it.
  const original = readFileSync(SW, "utf8");
  writeFileSync(SW, `${original}\n// next version\n`);
  try {
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
  } finally {
    writeFileSync(SW, original);
  }

  const notice = page
    .getByRole("status")
    .filter({ hasText: "There is a new version." });
  await expect(notice).toBeVisible();
  const reloaded = page.waitForEvent("load");
  await notice.getByRole("button", { name: "Update" }).click();
  await reloaded;
  await expect(
    page.getByRole("status").filter({ hasText: "There is a new version." }),
  ).toHaveCount(0);
});
