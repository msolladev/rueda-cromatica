import {
  HARMONIES,
  labelsFor,
  type Locale,
  type Result,
} from "@chromatic-wheel/color-wheel";
import {
  colorDifference,
  colorStandIn,
  paintIdSchema,
  type Catalog,
  type Paint,
} from "@chromatic-wheel/domain";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { endRestoring } from "../../app/restoring.ts";
import { useHydrated } from "../../app/hydrated.ts";
import { pathOf } from "../../app/pages.ts";
import type { HomeData } from "../../app/page-data.ts";
import {
  limitOf,
  type Action,
  type ChosenPaint,
  type ScreenState,
  type WheelPreferences,
} from "../../app/state.ts";
import { useCatalog } from "../../catalog/useCatalog.ts";
import type { Messages } from "../../i18n/messages.ts";
import { PaintSearch, type PaintChoice } from "../paint-search/PaintSearch.tsx";
import { WheelView, type WheelHandle } from "../wheel/WheelView.tsx";
import { useEntrance } from "./entrance.ts";
import { Results, type PanelContent } from "./Results.tsx";
import { searchColor, standInView, type ColorResults } from "./search.ts";

interface HomeProps {
  readonly locale: Locale;
  readonly data: HomeData;
  readonly state: ScreenState;
  readonly dispatch: (action: Action) => void;
  readonly messages: Messages;
  readonly restoreWheel: WheelPreferences | null;
  readonly onUpdate: () => void;
}

/** The paint of a saved choice, if the catalog still has it. */
function paintOf(catalog: Catalog, saved: ChosenPaint | null): Paint | null {
  if (saved === null) return null;
  const id = paintIdSchema.safeParse(saved.id);
  return id.success ? (catalog.paint(id.data) ?? null) : null;
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
  // docs/07 §1: whether the colors are following a drag of the wheel, at
  // once, instead of blending into the new ones. Only `showColors` sets it.
  const [following, setFollowing] = useState(false);
  // Whether a drag already started: its first step is a jump.
  const inGesture = useRef(false);
  // A tab under the mouse or the focus points at its mark meanwhile.
  const [preview, setPreview] = useState<number | null>(null);
  // docs/07 §4: the results follow the drag with low priority, so that the
  // wheel is always drawn first.
  const deferred = useDeferredValue(result);
  const colors = deferred?.colors ?? data.example;
  const tab = Math.min(state.tab, colors.length - 1);
  const { filters, view, paint: saved } = state.preferences;
  const wheel = useRef<WheelHandle>(null);
  const entrance = useEntrance();

  /**
   * The only way new colors reach the tabs and the results (docs/07 §1),
   * whatever changed them: dragging, a click or a tap on the wheel, its keys,
   * its controls, the paint search or «Back to…». A jump (anything but the
   * steps of a drag after the first) blends the swatches and makes the rows
   * enter, while the wheel travels; the steps of a drag follow it at once.
   */
  const showColors = (next: Result, final: boolean) => {
    const follows = !final && inGesture.current;
    inGesture.current = !final;
    if (
      !follows &&
      result !== null &&
      !sameColors(result.colors, next.colors)
    ) {
      entrance.start({ kind: "panel" });
    }
    setFollowing(follows);
    setResult(next);
    dispatch({ type: "colors-changed", count: next.colors.length });
  };

  // docs/07 §15: the paint the base comes from, and the one it came from.
  const ready = load.status === "ready" ? load : null;
  const chosen = useMemo((): PaintChoice | null => {
    if (ready === null) return null;
    const paint = paintOf(ready.catalog, saved);
    const range =
      paint === null ? undefined : ready.catalog.range(paint.rangeId);
    if (paint === null || range === undefined) return null;
    return { paint, brand: ready.catalog.brandOf(paint), range };
  }, [ready, saved]);
  // docs/07 §15: a paint without colour lends the wheel another's.
  const standIn = useMemo(
    () =>
      ready === null || chosen === null
        ? null
        : standInView(ready.catalog, chosen.paint.id),
    [ready, chosen],
  );
  const previous = useMemo(
    () => (ready === null ? null : paintOf(ready.catalog, state.previousPaint)),
    [ready, state.previousPaint],
  );
  const base = result?.colors[0]?.hex;
  const rybDeltaE = useMemo(() => {
    if (saved === null || result?.model !== "ryb" || base === undefined) {
      return null;
    }
    const difference = colorDifference(saved.hex, base);
    return difference.ok ? difference.value : null;
  }, [saved, result?.model, base]);
  /**
   * The only way a paint becomes the base: from the search, from «Back to…»
   * or from an official equivalence (docs/07 §15-16), which remembers the
   * paint it leaves.
   */
  const chooseSaved = (paint: ChosenPaint, remember = false) => {
    dispatch({ type: "choose-paint", paint, remember });
    wheel.current?.update({ color: paint.hex });
  };
  /**
   * A paint by its ID, with the colour the wheel takes: its own; without one,
   * that of its replacement or of its only equivalent; and otherwise the
   * wheel's, which does not move (docs/07 §15).
   */
  const choose = (paintId: string, remember = false) => {
    const id = paintIdSchema.safeParse(paintId);
    const paint =
      ready !== null && id.success ? ready.catalog.paint(id.data) : undefined;
    if (ready === null || paint === undefined) return;
    const hex =
      paint.color?.hex ??
      colorStandIn(ready.catalog, paint.id)?.paint.color?.hex ??
      base;
    if (hex !== undefined) chooseSaved({ id: paint.id, hex }, remember);
  };

  const { more } = state;
  // What the prerendering computed is still right while nothing changed.
  const isExample =
    sameColors(colors, data.example) &&
    filters.excludedBrands.length === 0 &&
    filters.extraTypes.length === 0 &&
    !filters.includeMetallic &&
    !filters.includeDiscontinued &&
    saved === null &&
    Object.keys(more).length === 0;

  const live = useMemo((): ColorResults | null => {
    const color = colors[tab];
    if (!hydrated || load.status !== "ready" || color === undefined)
      return null;
    return searchColor(
      load.catalog,
      load.index,
      color,
      filters,
      (key) => limitOf({ more }, key),
      tab === 0 ? chosen?.paint.id : undefined,
    );
  }, [hydrated, load, colors, tab, filters, more, chosen]);

  // docs/07 §6: what the inline script hid is shown once the wheel has the
  // saved state and the results are searched with the saved filters (or the
  // catalog failed). The wheel's own effect runs before this one.
  const settled = state.restored && (live !== null || load.status === "error");
  useEffect(() => {
    if (settled) endRestoring();
  }, [settled]);

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
        {/* The search is its own landmark, before the wheel's section:
            «Skip to the wheel» goes to the ring (docs/07 §11). */}
        <div className="wheel-column">
          <PaintSearch
            index={hydrated && ready !== null ? ready.searchIndex : null}
            chosen={chosen}
            standIn={standIn}
            previous={previous}
            rybDeltaE={rybDeltaE}
            messages={m}
            locale={locale}
            onChoose={(choice) => {
              choose(choice.paint.id);
            }}
            onClear={() => {
              dispatch({ type: "clear-paint" });
            }}
            onBack={() => {
              if (state.previousPaint !== null)
                chooseSaved(state.previousPaint);
            }}
            onUseDigital={() => {
              wheel.current?.update({ model: "digital" });
            }}
          />
          <section
            id="wheel"
            data-skip-target=""
            aria-labelledby="wheel-heading"
          >
            <h2 id="wheel-heading" className="visually-hidden">
              {m.home.wheelHeading}
            </h2>
            <noscript>
              <p className="notice">{m.home.noscript}</p>
            </noscript>
            <WheelView
              ref={wheel}
              locale={locale}
              highlight={preview ?? tab}
              restore={restoreWheel}
              onResult={showColors}
              onChange={(wheel) => {
                dispatch({ type: "wheel-changed", wheel });
              }}
            />
          </section>
        </div>
        <section
          className="results-column"
          id="paints"
          data-skip-target=""
          aria-labelledby="results-heading"
        >
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
            creditsPath={pathOf({ kind: "credits", locale })}
            onUse={(paintId) => {
              choose(paintId, true);
            }}
            onPreview={setPreview}
            rows={entrance}
            following={following}
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
