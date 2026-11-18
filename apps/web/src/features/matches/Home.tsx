import {
  HARMONIES,
  labelsFor,
  type Locale,
  type Result,
} from "@chromatic-wheel/color-wheel";
import { useDeferredValue, useMemo, useState } from "react";
import { useHydrated } from "../../app/hydrated.ts";
import type { HomeData } from "../../app/page-data.ts";
import {
  limitOf,
  type Action,
  type ScreenState,
  type WheelPreferences,
} from "../../app/state.ts";
import { useCatalog } from "../../catalog/useCatalog.ts";
import type { Messages } from "../../i18n/messages.ts";
import { WheelView } from "../wheel/WheelView.tsx";
import { Results, type PanelContent } from "./Results.tsx";
import { searchColor, type ColorResults } from "./search.ts";

interface HomeProps {
  readonly locale: Locale;
  readonly data: HomeData;
  readonly state: ScreenState;
  readonly dispatch: (action: Action) => void;
  readonly messages: Messages;
  readonly restoreWheel: WheelPreferences | null;
  readonly onUpdate: () => void;
}

const sameColors = (
  a: readonly { readonly hex: string }[],
  b: readonly { readonly hex: string }[],
) => a.length === b.length && a.every((color, i) => color.hex === b[i]?.hex);

/** The page of the wheel and the closest paints (docs/07 §1-4). */
export function Home({
  locale,
  data,
  state,
  dispatch,
  messages: m,
  restoreWheel,
  onUpdate,
}: HomeProps) {
  const hydrated = useHydrated();
  const { load, retry } = useCatalog();
  const wheelLabels = useMemo(() => labelsFor(locale), [locale]);
  const [result, setResult] = useState<Result | null>(null);
  // docs/07 §4: the results follow the drag with low priority, so that the
  // wheel is always drawn first.
  const deferred = useDeferredValue(result);
  const colors = deferred?.colors ?? data.example;
  const tab = Math.min(state.tab, colors.length - 1);
  const { filters, view } = state.preferences;

  const { more } = state;
  // What the prerendering computed is still right while nothing changed.
  const isExample =
    sameColors(colors, data.example) &&
    filters.excludedBrands.length === 0 &&
    filters.extraTypes.length === 0 &&
    !filters.includeMetallic &&
    !filters.includeDiscontinued &&
    Object.keys(more).length === 0;

  const live = useMemo((): ColorResults | null => {
    const color = colors[tab];
    if (!hydrated || load.status !== "ready" || color === undefined)
      return null;
    return searchColor(load.catalog, load.index, color, filters, (key) =>
      limitOf({ more }, key),
    );
  }, [hydrated, load, colors, tab, filters, more]);

  const panels = colors.map((_, index): PanelContent => {
    const example = data.example[index];
    // Before taking over, the same HTML as the prerendering: every color.
    if (!hydrated) {
      return example === undefined
        ? { kind: "loading" }
        : { kind: "results", results: example };
    }
    if (index !== tab) return { kind: "empty" };
    if (live !== null) return { kind: "results", results: live };
    if (load.status === "error") return { kind: "error", error: load.error };
    if (isExample && example !== undefined) {
      return { kind: "results", results: example };
    }
    return { kind: "loading" };
  });

  return (
    <>
      <h1>{m.home.heading}</h1>
      <p className="lead">{m.home.intro}</p>
      <div className="workspace">
        <section className="wheel-column" aria-labelledby="wheel-heading">
          <h2 id="wheel-heading" className="visually-hidden">
            {m.home.wheelHeading}
          </h2>
          <noscript>
            <p className="notice">{m.home.noscript}</p>
          </noscript>
          <WheelView
            locale={locale}
            restore={restoreWheel}
            onResult={(next) => {
              setResult(next);
              dispatch({ type: "colors-changed", count: next.colors.length });
            }}
            onChange={(wheel) => {
              dispatch({ type: "wheel-changed", wheel });
            }}
          />
        </section>
        <section className="results-column" aria-labelledby="results-heading">
          <h2 id="results-heading">{m.home.resultsHeading}</h2>
          <Results
            colors={colors}
            panels={panels}
            tab={tab}
            view={view}
            filters={filters}
            brands={data.brands}
            dispatch={dispatch}
            messages={m}
            wheelLabels={wheelLabels}
            locale={locale}
            onRetry={retry}
            onUpdate={onUpdate}
          />
        </section>
      </div>
      <section className="harmonies" aria-labelledby="harmonies-heading">
        <h2 id="harmonies-heading">{m.home.harmoniesHeading}</h2>
        <dl>
          {HARMONIES.map((harmony) => (
            <div key={harmony}>
              <dt>{wheelLabels.harmony[harmony]}</dt>
              <dd>{m.home.harmonies[harmony]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
