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
// Types of the Playwright provider: `cdp()` with the DevTools protocol.
import type {} from "@vitest/browser-playwright";
import { cdp, userEvent } from "vitest/browser";
import { createRenderer } from "../entry-server.tsx";
import "./app.css";
import { App } from "./App.tsx";
import type { Page } from "./pages.ts";
import { STORAGE_KEY } from "./before-paint.ts";
import { captureInstallPrompt } from "../features/pwa/install.ts";

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

afterEach(async () => {
  // A theme change's view transition takes every pointer event while it
  // lasts: the next test starts once it is over.
  await vi.waitFor(() => {
    expect(
      document.documentElement.classList.contains("theme-transition"),
    ).toBe(false);
  });
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

/** Waits for the animations that end, so that nothing is read halfway. */
async function animationsFinished(): Promise<void> {
  await Promise.all(
    document
      .getAnimations()
      .filter(
        (animation) => animation.effect?.getTiming().iterations !== Infinity,
      )
      .map((animation) => animation.finished.catch(() => undefined)),
  );
}

/** Chooses a theme as a person would: on a narrow screen, from the menu. */
async function chooseTheme(theme: string): Promise<void> {
  const burger = query(".burger", HTMLButtonElement);
  if (getComputedStyle(burger).display !== "none")
    await userEvent.click(burger);
  await userEvent.click(
    query(`input[name="theme"][value="${theme}"]`, HTMLInputElement),
  );
  // The theme's reveal and the icon's entrance end before anything is
  // measured, so that no color is read halfway.
  await animationsFinished();
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
    const summary = query(".filters-summary", HTMLElement);
    expect(summary.classList.contains("changed")).toBe(false);
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
    expect(summary.textContent).toContain("3 de 4 marcas");
    // A small jump confirms the change (docs/07 §1).
    expect(summary.classList.contains("changed")).toBe(true);
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
    await userEvent.click(button("Ver más pinturas"));
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

  it("marks the icon of the picked theme once the page has it, only on a press", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        filters: {
          excludedBrands: [],
          extraTypes: [],
          includeMetallic: false,
          includeDiscontinued: false,
        },
        view: "by-brand",
        theme: "light",
        locale: null,
        installDismissed: false,
        wheel: null,
      }),
    );
    mount(ES);
    const picked = () =>
      [...container.querySelectorAll(".theme-options [data-picked] input")].map(
        (input) => (input as HTMLInputElement).value,
      );
    await vi.waitFor(() => {
      expect(document.documentElement.dataset["theme"]).toBe("light");
    });
    // Restoring the saved theme marks nothing.
    expect(picked()).toEqual([]);
    // The theme the page had when the icon was marked: its entrance must
    // start inside the transition, with the new theme.
    let themeWhenMarked: string | undefined;
    const observer = new MutationObserver(() => {
      if (picked().length > 0 && themeWhenMarked === undefined)
        themeWhenMarked = document.documentElement.dataset["theme"];
    });
    observer.observe(container, { attributes: true, subtree: true });
    await chooseTheme("dark");
    // The transition changes the theme a moment after the press.
    await vi.waitFor(() => {
      expect(picked()).toEqual(["dark"]);
    });
    observer.disconnect();
    expect(themeWhenMarked).toBe("dark");
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
    // The summary changed, but nobody changed a filter: no jump.
    expect(
      query(".filters-summary", HTMLElement).classList.contains("changed"),
    ).toBe(false);
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

  it("covers the page with the menu open, and closes it on a press outside", async () => {
    mount(ES);
    const burger = query(".burger", HTMLButtonElement);
    await userEvent.click(burger);
    expect(query(".main", HTMLElement).inert).toBe(true);
    await userEvent.click(query(".nav-backdrop", HTMLElement), {
      position: { x: 10, y: 300 },
    });
    expect(burger.getAttribute("aria-expanded")).toBe("false");
    expect(query(".main", HTMLElement).inert).toBe(false);
  });

  it("skips the bar: the first stop goes to the wheel's ring", async () => {
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelector(".cw-ring")).not.toBeNull();
    });
    const [toWheel, toPaints] = [
      ...container.querySelectorAll<HTMLAnchorElement>(".skip-link"),
    ];
    expect(toWheel?.textContent).toBe("Saltar a la rueda");
    toWheel?.click();
    expect(document.activeElement).toBe(query(".cw-ring", HTMLElement));
    toPaints?.click();
    expect(document.activeElement).toBe(
      query('[role="tab"][aria-selected="true"]', HTMLElement),
    );
  });

  it("points at the selected color on the wheel, and at a tab under the mouse", async () => {
    mount(ES);
    const shownName = () =>
      [...container.querySelectorAll(".cw-mark-label[data-shown]")].map(
        (label) => label.textContent,
      );
    await vi.waitFor(() => {
      expect(shownName()).toEqual(["Base"]);
    });
    const tabs = [
      ...container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ];
    await userEvent.click(tabs[3] ?? tabs[0] ?? container);
    await vi.waitFor(() => {
      expect(shownName()).toEqual(["Tríada 1"]);
    });
    await userEvent.hover(tabs[5] ?? container);
    await vi.waitFor(() => {
      expect(shownName()).toEqual(["Complementario"]);
    });
    // Away from the tabs: next to them there is another tab.
    await userEvent.hover(query("h1", HTMLElement));
    await vi.waitFor(() => {
      expect(shownName()).toEqual(["Tríada 1"]);
    });
  });

  it("numbers the colors whose role repeats", async () => {
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(6);
    });
    const names = [...container.querySelectorAll('[role="tab"]')].map(
      (tab) => tab.textContent,
    );
    expect(names).toEqual([
      "Base",
      "Sombra",
      "Luz",
      "Tríada 1",
      "Tríada 2",
      "Complementario",
    ]);
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

describe("how the colors arrive", () => {
  // docs/07 §1: every change of colors goes through one function, which
  // blends them on a jump and follows a drag at once.
  const results = () => query(".results", HTMLElement);
  const baseSwatch = () => query("#tab-0 .swatch", HTMLElement);
  const blending = () =>
    baseSwatch()
      .getAnimations()
      .some(
        (animation) =>
          animation instanceof CSSTransition &&
          animation.transitionProperty === "background-color",
      );

  async function ready(): Promise<HTMLCanvasElement> {
    mount(ES);
    const canvas = await vi.waitFor(() => query("canvas", HTMLCanvasElement));
    await vi.waitFor(() => {
      expect(activePanel().querySelector(".paint")).not.toBeNull();
    });
    return canvas;
  }

  /** Real mouse input, in fractions of the canvas, with the button held as a person does. */
  function mouseOn(canvas: HTMLCanvasElement) {
    // On screen, or the input lands outside it (an earlier test may scroll).
    canvas.scrollIntoView({ block: "center" });
    const rect = canvas.getBoundingClientRect();
    const frame = window.frameElement as HTMLElement | null;
    const box = frame?.getBoundingClientRect();
    const scale =
      frame === null || box === undefined ? 1 : box.width / frame.offsetWidth;
    const send = (
      type: "mouseMoved" | "mousePressed" | "mouseReleased",
      x: number,
      y: number,
      buttons: number,
    ) =>
      cdp().send("Input.dispatchMouseEvent", {
        type,
        x: (box?.left ?? 0) + (rect.left + rect.width * x) * scale,
        y: (box?.top ?? 0) + (rect.top + rect.height * y) * scale,
        button: "left",
        buttons,
        clickCount: 1,
      });
    return {
      press: async (x: number, y: number) => {
        await send("mouseMoved", x, y, 0);
        await send("mousePressed", x, y, 1);
      },
      move: (x: number, y: number) => send("mouseMoved", x, y, 1),
      release: (x: number, y: number) => send("mouseReleased", x, y, 0),
    };
  }

  it("blends the tabs into the new colors after a click on the wheel", async () => {
    const canvas = await ready();
    const before = baseSwatch().style.background;
    const mouse = mouseOn(canvas);
    // The top of the ring, red in RYB, pressed for as long as a person does.
    await mouse.press(0.5, 0.06);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await mouse.release(0.5, 0.06);
    await vi.waitFor(() => {
      expect(baseSwatch().style.background).not.toBe(before);
    });
    expect(results().hasAttribute("data-following")).toBe(false);
    expect(blending()).toBe(true);
  });

  it("blends them after the hex field too", async () => {
    await ready();
    const hex = query("input.cw-input", HTMLInputElement);
    await userEvent.clear(hex);
    await userEvent.type(hex, "#ff0000{Enter}");
    await vi.waitFor(() => {
      expect(blending()).toBe(true);
    });
    expect(results().hasAttribute("data-following")).toBe(false);
  });

  it("follows a drag at once, and blends again once it ends", async () => {
    const canvas = await ready();
    const mouse = mouseOn(canvas);
    await mouse.press(0.5, 0.06);
    for (const x of [0.55, 0.6, 0.65, 0.7]) await mouse.move(x, 0.08);
    await vi.waitFor(() => {
      expect(results().hasAttribute("data-following")).toBe(true);
    });
    await mouse.release(0.7, 0.08);
    await vi.waitFor(() => {
      expect(results().hasAttribute("data-following")).toBe(false);
    });
  });
});

describe("the paint search", () => {
  const field = () => query(".paint-search-input", HTMLInputElement);
  const options = () => [
    ...container.querySelectorAll<HTMLElement>(
      '.paint-search-list [role="option"]',
    ),
  ];
  const firstOf = (brand: string) =>
    [...activePanel().querySelectorAll(".brand-group")]
      .find(
        (group) => group.querySelector(".brand-heading")?.textContent === brand,
      )
      ?.querySelector(".paint");

  async function ready(): Promise<void> {
    mount(ES);
    await vi.waitFor(() => {
      expect(field().disabled).toBe(false);
    });
  }

  async function choose(text: string): Promise<void> {
    await userEvent.click(field());
    await userEvent.keyboard(text);
    await vi.waitFor(() => {
      expect(options().length).toBeGreaterThan(0);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
  }

  it("suggests from 3 letters, and the paint becomes the base, first of its brand", async () => {
    await ready();
    await userEvent.click(field());
    await userEvent.keyboard("lo");
    expect(field().getAttribute("aria-expanded")).toBe("false");
    expect(options()).toHaveLength(0);
    await userEvent.keyboard("thern");
    await vi.waitFor(() => {
      expect(options().map((option) => option.textContent)).toEqual([
        "Lothern Blue · CapaWarhammer Colour · Layer",
      ]);
    });
    await animationsFinished();
    await expectNoAxeViolations();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(field().value).toBe("Lothern Blue");
    await vi.waitFor(() => {
      expect(query(".paint-search-chosen", HTMLElement).textContent).toBe(
        "Warhammer Colour · Layer",
      );
      expect(query('[role="tab"][aria-selected="true"]', HTMLElement).id).toBe(
        "tab-0",
      );
      expect(firstOf("Warhammer Colour")?.textContent).toContain("Elegida");
    });
    await animationsFinished();
    await expectNoAxeViolations();
  });

  it("offers the digital wheel when RYB does not reach the paint, and reaches it there", async () => {
    await ready();
    await choose("lothern");
    const notice = await vi.waitFor(() =>
      query(".paint-search-ryb", HTMLElement),
    );
    expect(notice.textContent).toContain("ΔE 6,8");
    await userEvent.click(query(".paint-search-ryb button", HTMLButtonElement));
    await vi.waitFor(() => {
      expect(container.querySelector(".paint-search-ryb")).toBeNull();
      expect(
        activePanel().querySelector(".panel-heading code")?.textContent,
      ).toBe("#3394c3");
    });
  });

  it("shows the chosen paint whatever the filters: a metallic one too", async () => {
    await ready();
    await choose("hammered");
    await vi.waitFor(() => {
      const row = firstOf("Vallejo");
      expect(row?.querySelector(".paint-name")?.textContent).toBe(
        "Hammered Copper",
      );
      expect(row?.textContent).toContain("Metálica");
      expect(row?.querySelector(".chip-chosen")).not.toBeNull();
    });
  });

  it("shows 8 suggestions and 8 more with «See more», from the keyboard", async () => {
    await ready();
    await userEvent.click(field());
    await userEvent.keyboard("red");
    await vi.waitFor(() => {
      expect(options()).toHaveLength(9);
    });
    expect(options().at(-1)?.textContent).toBe("Ver más pinturas (8 de 89)");
    await userEvent.keyboard("{ArrowUp}{Enter}");
    await vi.waitFor(() => {
      expect(options()).toHaveLength(17);
    });
    expect(field().getAttribute("aria-activedescendant")).toBe(
      options()[8]?.id,
    );
    expect(field().value).toBe("red");
  });

  it("forgets the paint when the base changes, and goes back to it", async () => {
    await ready();
    await choose("moot green");
    await vi.waitFor(() => {
      expect(field().value).toBe("Moot Green");
    });
    const hex = query("input.cw-input", HTMLInputElement);
    await userEvent.clear(hex);
    await userEvent.type(hex, "#ff0000{Enter}");
    await vi.waitFor(() => {
      expect(field().value).toBe("");
    });
    const back = query(".paint-search-back button", HTMLButtonElement);
    expect(back.textContent).toBe("Volver a Moot Green");
    await userEvent.click(back);
    await vi.waitFor(() => {
      expect(field().value).toBe("Moot Green");
    });
  });

  it("shows the official equivalences of the chosen paint, and jumps to one and back (docs/07 §16)", async () => {
    await ready();
    await choose("moot green");
    const official = () => query(".official", HTMLElement);
    const names = () =>
      [...official().querySelectorAll(".paint .paint-name")].map(
        (name) => name.textContent,
      );
    await vi.waitFor(() => {
      expect(names()).toEqual([
        "Light Green",
        "Leafy Green",
        "Snake Scales",
        "Scorpy Green",
      ]);
    });
    expect(official().querySelector("h4")?.textContent).toBe(
      "Equivalencias oficiales",
    );
    expect(official().textContent).toContain(
      "Ningún documento propone otra pintura para Moot Green.",
    );
    const scorpy = [...official().querySelectorAll(".paint")].at(-1);
    expect(scorpy?.querySelector(".paint-sources")?.textContent).toBe(
      "Según Acrylicos Vallejo, en Game Color chart (CC266).",
    );
    expect(scorpy?.querySelector(".paint-quality")?.textContent).toContain(
      "ΔE",
    );
    await animationsFinished();
    await expectNoAxeViolations();

    const use = scorpy?.querySelector(".use-as-base");
    if (!(use instanceof HTMLButtonElement)) throw new Error("No button");
    expect(use.getAttribute("aria-label")).toBe(
      "Usar Scorpy Green como base de la rueda",
    );
    await userEvent.click(use);
    await vi.waitFor(() => {
      expect(field().value).toBe("Scorpy Green");
      expect(names()).toEqual([
        "Moot Green",
        "Light Green",
        "Mouldy Clothes",
        "Snake Scales",
      ]);
    });
    const back = query(".paint-search-back button", HTMLButtonElement);
    expect(back.textContent).toBe("Volver a Moot Green");
    await userEvent.click(back);
    await vi.waitFor(() => {
      expect(field().value).toBe("Moot Green");
      expect(container.querySelector(".paint-search-back")).toBeNull();
    });
  });

  it("says so when the chosen paint has no official equivalences", async () => {
    await ready();
    await choose("brassy");
    await vi.waitFor(() => {
      expect(query(".official", HTMLElement).textContent).toBe(
        "Equivalencias oficialesNingún fabricante publica una equivalencia para Brassy Brass (Vallejo · Game Color · 72.058).",
      );
    });
  });

  it("lists the official equivalences of a row in its «Details»", async () => {
    await ready();
    await choose("moot green");
    const row = await vi.waitFor(() => {
      const found = firstOf("Warhammer Colour");
      if (found === undefined || found === null) throw new Error("No row");
      return found;
    });
    await userEvent.click(
      query(".brand-group .paint-details summary", HTMLElement),
    );
    const links = row.querySelector(".official-links");
    expect(links?.querySelector("p")?.textContent).toBe(
      "Moot Green se propone para",
    );
    expect(
      [...(links?.querySelectorAll(".official-link-name") ?? [])].map(
        (name) => name.textContent,
      ),
    ).toEqual(["Light Green", "Leafy Green", "Snake Scales", "Scorpy Green"]);
  });

  it("marks a discontinued paint, after the active ones, and says whether it has a replacement (docs/07 §15-16)", async () => {
    await ready();
    await userEvent.click(field());
    await userEvent.keyboard("necromancer cloak");
    await vi.waitFor(() => {
      expect(options().map((option) => option.textContent)).toEqual([
        "Necromancer Cloak · EstándarThe Army Painter · Warpaints · WP1443Descatalogada",
      ]);
    });
    await animationsFinished();
    await expectNoAxeViolations();
    await userEvent.clear(field());
    await userEvent.keyboard("matt white");
    await vi.waitFor(() => {
      const [fanatic, original] = options().map((o) => o.textContent);
      expect(fanatic).toContain("Warpaints Fanatic");
      expect(fanatic).not.toContain("Descatalogada");
      expect(original).toContain("Warpaints · WP1102Descatalogada");
    });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await vi.waitFor(() => {
      expect(query(".paint-search-chosen", HTMLElement).textContent).toBe(
        "The Army Painter · Warpaints · WP1102Descatalogada",
      );
      const official = query(".official", HTMLElement);
      expect(official.querySelector("h5")?.textContent).toBe(
        "Matt White se sustituye por",
      );
      expect(official.textContent).toContain(
        "Ningún documento del fabricante nombra una sustituta de Matt White.",
      );
    });
    await animationsFinished();
    await expectNoAxeViolations();
  });

  describe("a paint without colour (docs/07 §15)", () => {
    /**
     * The catalog the page downloads, with the original Snake Scales
     * without colour and, if asked, replaced by Moot Green: fictitious,
     * because the catalog has no such paint yet.
     */
    async function withoutColor(replaced: boolean): Promise<string> {
      const real = window.fetch.bind(window);
      const catalog = (await (await real("/catalog.json")).json()) as {
        paints: {
          id: string;
          color: { hex: string } | null;
          status: unknown;
        }[];
      };
      const find = (id: string) => {
        const paint = catalog.paints.find((p) => p.id === id);
        if (paint === undefined) throw new Error(`No ${id}`);
        return paint;
      };
      const snake = find("the-army-painter/warpaints/snake-scales");
      snake.color = null;
      snake.status = {
        kind: "discontinued",
        replacement: replaced
          ? {
              paintId: "citadel/layer/moot-green",
              sourceId: "the-army-painter-warpaints-conversion-chart",
            }
          : null,
      };
      vi.spyOn(window, "fetch").mockImplementation(async (...args) => {
        const [input] = args;
        const url = input instanceof Request ? input.url : input.toString();
        return url.endsWith("/catalog.json")
          ? new Response(JSON.stringify(catalog))
          : real(...args);
      });
      return find("citadel/layer/moot-green").color?.hex ?? "";
    }

    const baseHex = () =>
      query('[role="tabpanel"] .panel-heading code', HTMLElement).textContent;

    it("is striped in the search, and the wheel takes its replacement's colour", async () => {
      const moot = await withoutColor(true);
      await ready();
      await userEvent.click(field());
      await userEvent.keyboard("snake scales");
      await vi.waitFor(() => {
        expect(options()).toHaveLength(1);
      });
      const option = options()[0];
      expect(option?.querySelector(".swatch-none")).not.toBeNull();
      expect(option?.textContent).toContain("sin color");
      await animationsFinished();
      await expectNoAxeViolations();
      await userEvent.keyboard("{ArrowDown}{Enter}");
      await vi.waitFor(() => {
        expect(field().value).toBe("Snake Scales");
        expect(query(".paint-search-standin", HTMLElement).textContent).toBe(
          "Mostrando Moot Green, su sustituta según The Army Painter.",
        );
        expect(baseHex()).toBe(moot);
        const official = query(".official", HTMLElement);
        expect(official.querySelector("h5")?.textContent).toBe(
          "Snake Scales se sustituye por",
        );
        // Not measured against the wheel: whole swatches, without ΔE.
        expect(official.querySelectorAll(".split-whole").length).toBe(
          official.querySelectorAll(".paint").length,
        );
        expect(official.querySelector(".paint-quality")).toBeNull();
      });
      await animationsFinished();
      await expectNoAxeViolations();
    });

    it("leaves the wheel where it is with several equivalents, and says to use one", async () => {
      await withoutColor(false);
      await ready();
      const before = baseHex();
      await choose("snake scales");
      await vi.waitFor(() => {
        expect(field().value).toBe("Snake Scales");
        expect(activePanel().textContent).toContain(
          "Snake Scales no tiene color en el catálogo. Usa una de sus equivalencias como base de la rueda.",
        );
      });
      expect(baseHex()).toBe(before);
      expect(container.querySelector(".paint-search-standin")).toBeNull();
      expect(activePanel().querySelector(".brand-groups")).toBeNull();
      await animationsFinished();
      await expectNoAxeViolations();
    });
  });

  it("keeps the chosen paint for the next visit", async () => {
    await ready();
    await choose("lothern");
    await vi.waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toContain(
        "citadel/layer/lothern-blue",
      );
    });
    root?.unmount();
    container.remove();
    await ready();
    await vi.waitFor(() => {
      expect(field().value).toBe("Lothern Blue");
    });
  });
});

describe("the install banner", () => {
  beforeAll(() => {
    captureInstallPrompt();
  });

  afterEach(() => {
    // Forgets the prompt of the test, and what the inline script decided.
    dispatchEvent(new Event("appinstalled"));
    document.documentElement.removeAttribute("data-install");
  });

  /** What Chromium does when the app can be installed. */
  function offerInstall() {
    const prompt = vi.fn(() => Promise.resolve());
    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) },
    );
    dispatchEvent(event);
    return { event, prompt };
  }

  const banner = () => query(".install-banner", HTMLElement);
  const shown = () => getComputedStyle(banner()).display !== "none";
  const installButton = () => {
    const found = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Instalar",
    );
    if (found === undefined) throw new Error("Missing «Instalar»");
    return found;
  };

  it("is in the page from the first paint where the inline script offered it, and moves nothing", async () => {
    document.documentElement.dataset["install"] = "prompt";
    mount(ES);
    // Before the app takes over: the prerendered HTML already shows it.
    expect(shown()).toBe(true);
    const heading = query("h1", HTMLElement).getBoundingClientRect().top;
    await vi.waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    offerInstall();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(query("h1", HTMLElement).getBoundingClientRect().top).toBe(heading);
    await expectNoAxeViolations();
  });

  it("is hidden where the inline script did not offer it", () => {
    mount(ES);
    expect(shown()).toBe(false);
  });

  it("opens the browser's prompt, and goes away once installed", async () => {
    document.documentElement.dataset["install"] = "prompt";
    mount(ES);
    const { event, prompt } = offerInstall();
    // The browser's own mini bar is replaced by the banner.
    expect(event.defaultPrevented).toBe(true);
    // A plain click: «Instalar la aplicación», in the footer, has the same
    // start, and the browser's locator would find both.
    installButton().click();
    expect(prompt).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(shown()).toBe(false);
    });
  });

  it("says how to install from the menu if the browser has not offered it yet", async () => {
    document.documentElement.dataset["install"] = "prompt";
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    await userEvent.click(installButton());
    await vi.waitFor(() => {
      expect(banner().textContent).toContain("Tu navegador aún no la ofrece");
    });
  });

  it("goes away for good when closed, and the footer still offers it", async () => {
    document.documentElement.dataset["install"] = "prompt";
    mount(ES);
    await vi.waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    offerInstall();
    await userEvent.click(
      query('.install-banner [aria-label="Cerrar"]', HTMLButtonElement),
    );
    await vi.waitFor(() => {
      expect(shown()).toBe(false);
    });
    // The preference is saved in an effect, which may run after the banner
    // is hidden.
    await vi.waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
        installDismissed?: boolean;
      };
      expect(saved.installDismissed).toBe(true);
    });
    await vi.waitFor(() => {
      expect(container.querySelector(".footer .link-button")?.textContent).toBe(
        "Instalar la aplicación",
      );
    });
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

  it("opens other sites in a new tab, without passing them standing", () => {
    mount({ kind: "credits", locale: "es" });
    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>(
        ".credits .external-link",
      ),
    ];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.target).toBe("_blank");
      expect(link.rel.split(" ")).toEqual(
        expect.arrayContaining(["noopener", "nofollow"]),
      );
      expect(link.querySelector("svg")).not.toBeNull();
      expect(link.textContent).toMatch(
        /^Ver .+ en \S+ \(se abre en una pestaña nueva\)$/,
      );
    }
  });
});
