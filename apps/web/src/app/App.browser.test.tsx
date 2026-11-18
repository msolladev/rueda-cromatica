/**
 * The web in a real browser (docs/07 §14): the browser takes over the
 * prerendered HTML, and then the wheel, the results, the filters, the menu,
 * the theme and the saved preferences work, with the automatic accessibility
 * check of axe-core (WCAG 2.2 A and AA).
 */
import "@chromatic-wheel/color-wheel/style.css";
import axe from "axe-core";
import { StrictMode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createRenderer } from "../entry-server.tsx";
import "./app.css";
import { App } from "./App.tsx";
import type { Page } from "./pages.ts";
import { STORAGE_KEY } from "./before-paint.ts";

let render: ReturnType<typeof createRenderer>;
let container: HTMLElement;
let root: Root | undefined;
let recoverable: unknown[] = [];

beforeAll(async () => {
  const catalog: unknown = await (await fetch("/catalog.json")).json();
  render = createRenderer({
    catalog,
    licenses: [],
    origin: "https://example.org",
  });
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  container.remove();
  localStorage.clear();
  delete document.documentElement.dataset["theme"];
  vi.restoreAllMocks();
});

/** Puts the prerendered HTML of the page in the document and takes it over. */
function mount(page: Page): void {
  const rendered = render(page);
  container = document.createElement("div");
  container.innerHTML = rendered.html;
  document.body.append(container);
  recoverable = [];
  root = hydrateRoot(
    container,
    <StrictMode>
      <App page={page} data={rendered.data} />
    </StrictMode>,
    {
      onRecoverableError: (error) => {
        recoverable.push(error);
      },
    },
  );
}

const query = <T extends Element>(selector: string, type: new () => T): T => {
  const element = container.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing ${selector}`);
  return element;
};

const activePanel = () => query('[role="tabpanel"]:not([hidden])', HTMLElement);

const brandHeadings = () =>
  [...activePanel().querySelectorAll(".brand-heading")].map(
    (h) => h.textContent,
  );

async function expectNoAxeViolations(): Promise<void> {
  const { violations } = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    },
  });
  expect(
    violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
}

const ES: Page = { kind: "home", locale: "es" };

/** Chooses a theme as a person would: on a narrow screen, from the menu. */
async function chooseTheme(theme: string): Promise<void> {
  const burger = query(".burger", HTMLButtonElement);
  if (getComputedStyle(burger).display !== "none")
    await userEvent.click(burger);
  await userEvent.click(
    query(`input[name="theme"][value="${theme}"]`, HTMLInputElement),
  );
}

describe("the home page", () => {
  it("takes over the prerendered HTML without differences", async () => {
    const errors = vi.spyOn(console, "error");
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    expect(recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("shows only the selected color once interactive, and follows the arrow keys", async () => {
    mount(ES);
    await vi.waitFor(() => {
      expect(
        container.querySelectorAll('[role="tabpanel"]:not([hidden])'),
      ).toHaveLength(1);
    });
    const tabs = [
      ...container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ];
    expect(tabs).toHaveLength(6);
    tabs[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(activePanel().id).toBe("panel-1");
    await userEvent.keyboard("{End}");
    expect(activePanel().id).toBe("panel-5");
  });

  it("filters by brand and says so in the summary", async () => {
    mount(ES);
    await vi.waitFor(() => {
      expect(brandHeadings()).toHaveLength(4);
    });
    await userEvent.click(query(".filters summary", HTMLElement));
    const citadel = [
      ...container.querySelectorAll<HTMLLabelElement>(".filters label"),
    ].find((label) => label.textContent === "Warhammer Colour");
    if (citadel === undefined)
      throw new Error("Missing the Warhammer Colour filter");
    await userEvent.click(citadel);
    await vi.waitFor(() => {
      expect(brandHeadings()).toEqual([
        "AK Interactive",
        "The Army Painter",
        "Vallejo",
      ]);
    });
    expect(query(".filters-summary", HTMLElement).textContent).toContain(
      "3 de 4 marcas",
    );
  });

  it("shows three more paints of a brand with «See more»", async () => {
    mount(ES);
    await vi.waitFor(() => {
      expect(activePanel().querySelectorAll(".paint")).toHaveLength(12);
    });
    const more = activePanel().querySelector<HTMLButtonElement>(".link-button");
    if (more === null) throw new Error("Missing «Ver más»");
    await userEvent.click(more);
    await vi.waitFor(() => {
      expect(activePanel().querySelectorAll(".paint")).toHaveLength(15);
    });
  });

  it("takes the added paints away with «See less»", async () => {
    mount(ES);
    await vi.waitFor(() => {
      expect(activePanel().querySelectorAll(".paint")).toHaveLength(12);
    });
    const button = (name: string) => {
      const found = [
        ...activePanel().querySelectorAll<HTMLButtonElement>(".link-button"),
      ].find((b) => b.textContent === name);
      if (found === undefined) throw new Error(`Missing «${name}»`);
      return found;
    };
    await userEvent.click(button("Ver más"));
    await vi.waitFor(() => {
      expect(activePanel().querySelectorAll(".paint")).toHaveLength(15);
    });
    await userEvent.click(button("Ver menos"));
    await vi.waitFor(() => {
      expect(activePanel().querySelectorAll(".paint")).toHaveLength(12);
    });
    expect(
      [...activePanel().querySelectorAll(".link-button")].map(
        (b) => b.textContent,
      ),
    ).not.toContain("Ver menos");
  });

  it("shows the closest of all brands, each with its brand", async () => {
    mount(ES);
    await userEvent.click(
      query('input[name="view"][value="overall"]', HTMLInputElement),
    );
    await vi.waitFor(() => {
      expect(activePanel().querySelectorAll(".paint")).toHaveLength(3);
    });
    expect(activePanel().querySelector(".paint-range")?.textContent).toBe(
      "Warhammer Colour · Layer",
    );
  });

  it("applies and saves the theme", async () => {
    mount(ES);
    await chooseTheme("dark");
    await vi.waitFor(() => {
      expect(document.documentElement.dataset["theme"]).toBe("dark");
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      theme?: string;
    };
    expect(saved.theme).toBe("dark");
  });

  it("restores the saved filters and wheel after taking over", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
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
      }),
    );
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
      expect(brandHeadings()).toEqual([
        "AK Interactive",
        "Warhammer Colour",
        "The Army Painter",
      ]);
    });
  });

  it("opens and closes the menu on narrow screens, with Escape", async () => {
    mount(ES);
    const burger = query(".burger", HTMLButtonElement);
    await userEvent.click(burger);
    expect(burger.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{Escape}");
    expect(burger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(burger);
  });

  it("shows rows with the shape of the results while the catalog arrives", async () => {
    const { promise: pending, resolve: release } =
      Promise.withResolvers<null>();
    const real = window.fetch.bind(window);
    vi.spyOn(window, "fetch").mockImplementation(async (...args) => {
      await pending;
      return real(...args);
    });
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    // Something changed, so the prerendered example no longer applies.
    await userEvent.click(query(".filters summary", HTMLElement));
    await userEvent.click(
      query(".filters input[type=checkbox]", HTMLInputElement),
    );
    const skeleton = query(
      '[role="tabpanel"]:not([hidden]) .skeleton',
      HTMLElement,
    );
    expect(skeleton.getAttribute("role")).toBe("status");
    expect(skeleton.textContent).toBe("Cargando las pinturas…");
    release(null);
    await vi.waitFor(() => {
      expect(activePanel().querySelector(".skeleton")).toBeNull();
    });
  });

  it("says why there are no paints when the catalog cannot be downloaded", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "No se han podido descargar las pinturas.",
      );
    });
    // Only the results: the wheel keeps working.
    expect(container.querySelector("canvas")).not.toBeNull();
    await expectNoAxeViolations();
  });

  it.each([
    ["by default", () => Promise.resolve()],
    [
      "with the filters and a paint's details open",
      async () => {
        await userEvent.click(query(".filters summary", HTMLElement));
        await userEvent.click(query(".paint-details summary", HTMLElement));
      },
    ],
    [
      "with the dark theme",
      async () => {
        await chooseTheme("dark");
      },
    ],
  ])("passes the automatic WCAG 2.2 AA check %s", async (_, act) => {
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    await act();
    await expectNoAxeViolations();
  });
});

describe("the credits page", () => {
  it("takes over without differences and passes the WCAG 2.2 AA check", async () => {
    mount({ kind: "credits", locale: "ja" });
    await vi.waitFor(() => {
      expect(container.querySelector(".credits")).not.toBeNull();
    });
    expect(recoverable).toEqual([]);
    await expectNoAxeViolations();
  });
});
