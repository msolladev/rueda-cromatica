/**
 * The closest paints of each color of the wheel (docs/07 §1-3): the view
 * selector, the filters, the approximate-color notice, one tab per color, the
 * legend of the split swatch and the panel of the selected color.
 */
import {
  colorNames,
  type Labels,
  type Role,
} from "@chromatic-wheel/color-wheel";
import { DEFAULT_LIMIT } from "@chromatic-wheel/domain";
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  OVERALL,
  type Action,
  type Filters as FilterState,
  type View,
} from "../../app/state.ts";
import type { CatalogLoadError } from "../../catalog/load.ts";
import { CatalogError } from "../../catalog/CatalogError.tsx";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  MinusIcon,
  PlusIcon,
} from "../../app/icons.tsx";
import { useSlidingIndicator } from "../../app/sliding-indicator.ts";
import { format } from "../../i18n/i18n.ts";
import type { Messages } from "../../i18n/messages.ts";
import {
  entranceIndex,
  isLeaving,
  useEntrance,
  useListHeight,
  type Entrance,
} from "./entrance.ts";
import { Filters, type BrandOption } from "./Filters.tsx";
import { PaintRow } from "./PaintRow.tsx";
import type { ColorResults, PaintView } from "./search.ts";

/** What a color's panel shows. */
export type PanelContent =
  | { readonly kind: "results"; readonly results: ColorResults }
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: CatalogLoadError }
  /** A tab that is not selected, once the page is interactive. */
  | { readonly kind: "empty" };

export interface ResultsProps {
  readonly colors: readonly { readonly role: Role; readonly hex: string }[];
  /** One per color, in the same order. */
  readonly panels: readonly PanelContent[];
  readonly tab: number;
  readonly view: View;
  readonly filters: FilterState;
  readonly brands: readonly BrandOption[];
  readonly dispatch: (action: Action) => void;
  readonly messages: Messages;
  readonly wheelLabels: Labels;
  readonly locale: string;
  /** Whether the wheel is being dragged: the colors change without blending. */
  readonly dragging: boolean;
  /** A tab under the mouse or the focus, or `null` when it leaves. */
  readonly onPreview: (index: number | null) => void;
  /** Where the notice's «Sources» link goes. */
  readonly creditsPath: string;
  readonly onRetry: () => void;
  readonly onUpdate: () => void;
}

const shownPaints = (
  results: ColorResults,
  view: View,
): readonly PaintView[] =>
  view === "overall"
    ? results.overall
    : results.byBrand.flatMap((brand) => brand.paints);

export function Results(props: ResultsProps) {
  const {
    colors,
    panels,
    tab,
    view,
    filters,
    brands,
    dispatch,
    messages: m,
  } = props;
  const active = panels[tab];
  const shown =
    active?.kind === "results" ? shownPaints(active.results, view) : [];
  const { entrance, start, leave } = useEntrance();
  const viewOptions = useRef<HTMLDivElement>(null);
  useSlidingIndicator(viewOptions, "label:has(input:checked)", view);
  // Picking a tab or «See more» makes rows enter; the rest goes as is.
  const act = (action: Action) => {
    if (action.type === "select-tab" && action.index !== tab) {
      start({ kind: "panel" });
    } else if (action.type === "show-more" && active?.kind === "results") {
      const from =
        action.key === OVERALL
          ? active.results.overall.length
          : (active.results.byBrand.find((b) => b.brandId === action.key)
              ?.paints.length ?? 0);
      start({ kind: "more", key: action.key, from });
    } else if (action.type === "show-less") {
      // The added rows leave first; then they are removed.
      leave(action.key, DEFAULT_LIMIT, () => {
        dispatch(action);
      });
      return;
    }
    dispatch(action);
  };
  const withEntrance = { ...props, dispatch: act };
  const approximate = shown.filter((paint) => paint.reasons.length > 0).length;
  // docs/07 §3: a general notice if all are approximate; if they are mixed,
  // the notice explains the chip and only the approximate ones carry it.
  const mixed = approximate > 0 && approximate < shown.length;
  const names = colorNames(colors, props.wheelLabels);

  return (
    <div className="results" data-dragging={props.dragging ? "" : undefined}>
      <div className="toolbar">
        <fieldset className="segmented">
          <legend>{m.results.show}</legend>
          <div className="segmented-options" ref={viewOptions}>
            {(
              [
                ["by-brand", m.results.byBrand],
                ["overall", m.results.overall],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="view"
                  value={value}
                  checked={view === value}
                  onChange={() => {
                    dispatch({ type: "set-view", view: value });
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Filters
          brands={brands}
          filters={filters}
          dispatch={dispatch}
          messages={m}
        />
      </div>
      {approximate > 0 && (
        // One line; the explanation opens below it.
        <details className="notice notice-approx">
          <summary>
            <InfoIcon />
            <span>
              {mixed ? m.approximate.someTitle : m.approximate.allTitle}
              <span aria-hidden="true"> ≈</span>
            </span>
          </summary>
          <p>
            {mixed ? m.approximate.some : m.approximate.all}{" "}
            <a href={props.creditsPath}>{m.approximate.sources}</a>
          </p>
        </details>
      )}
      <ColorTabs {...withEntrance} />
      <p className="legend">
        <span className="split split-mini" aria-hidden="true">
          <span style={{ background: colors[tab]?.hex }} />
          <span className="split-any" />
        </span>
        <span>
          {m.results.legendStart}
          <strong>{m.results.legendWheel}</strong>
          {m.results.legendMiddle}
          <strong>{m.results.legendPaint}</strong>
          {m.results.legendEnd}
        </span>
      </p>
      {panels.map((panel, index) => {
        const color = colors[index];
        if (color === undefined) return null;
        return (
          <section
            key={index}
            className="panel"
            role="tabpanel"
            id={`panel-${String(index)}`}
            aria-labelledby={`tab-${String(index)}`}
            data-inactive={index === tab ? undefined : ""}
            hidden={panel.kind === "empty"}
          >
            <h3 className="panel-heading">
              <span
                className="swatch"
                style={{ background: color.hex }}
                aria-hidden="true"
              />
              {names[index]} <code>{color.hex}</code>
            </h3>
            <PanelBody
              {...withEntrance}
              entrance={index === tab ? entrance : null}
              panel={panel}
              target={color.hex}
              mixed={mixed}
            />
          </section>
        );
      })}
    </div>
  );
}

function ColorTabs({
  colors,
  tab,
  dispatch,
  messages: m,
  wheelLabels,
  onPreview,
}: ResultsProps) {
  const list = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const names = colorNames(colors, wheelLabels);
  useStuck(bar);
  useOverflowEdges(bar, list);
  // An arrow scrolls the tabs by most of what is seen.
  const scrollTabs = (direction: 1 | -1) => {
    const element = list.current;
    if (element === null) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  useSlidingIndicator(
    list,
    '[aria-selected="true"]',
    `${String(tab)}/${String(colors.length)}`,
  );
  const select = (index: number) => {
    dispatch({ type: "select-tab", index });
    list.current
      ?.querySelector<HTMLButtonElement>(`#tab-${String(index)}`)
      ?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const last = colors.length - 1;
    const next =
      event.key === "ArrowRight"
        ? tab === last
          ? 0
          : tab + 1
        : event.key === "ArrowLeft"
          ? tab === 0
            ? last
            : tab - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };
  return (
    <div className="tabs-bar" ref={bar}>
      <div
        className="tabs"
        role="tablist"
        aria-label={m.results.colors}
        ref={list}
        onKeyDown={onKeyDown}
      >
        {colors.map((color, index) => {
          const role = names[index] ?? "";
          return (
            <button
              key={index}
              type="button"
              role="tab"
              id={`tab-${String(index)}`}
              aria-selected={index === tab}
              aria-controls={`panel-${String(index)}`}
              aria-label={format(m.results.colorTab, { role, hex: color.hex })}
              tabIndex={index === tab ? 0 : -1}
              // «Skip to the paints» lands here (SkipLinks.tsx).
              data-skip-focus={index === tab ? "" : undefined}
              onClick={() => {
                select(index);
              }}
              // Only when the mouse really moves over it: when the list scrolls
              // under a still mouse (a tab picked on a narrow screen), the
              // browser says it entered another tab.
              onPointerMove={(event) => {
                if (event.pointerType === "mouse") onPreview(index);
              }}
              onPointerLeave={() => {
                onPreview(null);
              }}
              onFocus={() => {
                onPreview(index);
              }}
              onBlur={() => {
                onPreview(null);
              }}
            >
              <span
                className="swatch"
                style={{ background: color.hex }}
                aria-hidden="true"
              />
              <span aria-hidden="true">{role}</span>
            </button>
          );
        })}
      </div>
      {/* docs/07 §1: where tabs are hidden on a side, a fade with an arrow
          says so; pressed, it scrolls. Not for the keyboard, which moves
          between the tabs with the arrows. */}
      <button
        type="button"
        className="tabs-more tabs-more-start"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          scrollTabs(-1);
        }}
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        className="tabs-more tabs-more-end"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          scrollTabs(1);
        }}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

interface PanelBodyProps extends ResultsProps {
  readonly panel: PanelContent;
  readonly entrance: Entrance | null;
  readonly target: string;
  readonly mixed: boolean;
}

function PanelBody(props: PanelBodyProps): ReactNode {
  const {
    panel,
    view,
    dispatch,
    messages: m,
    target,
    mixed,
    locale,
    entrance,
  } = props;
  switch (panel.kind) {
    case "empty":
      return null;
    case "loading":
      // Rows with the shape of the results while the catalog arrives; the
      // text is for screen readers.
      return (
        <div className="skeleton" role="status">
          <span className="visually-hidden">{m.results.loading}</span>
          {[0, 1, 2].map((row) => (
            <div className="skeleton-row" key={row} aria-hidden="true">
              <span className="skeleton-block skeleton-swatch" />
              <span className="skeleton-lines">
                <span className="skeleton-block" />
                <span className="skeleton-block skeleton-short" />
              </span>
              <span className="skeleton-block skeleton-label" />
            </div>
          ))}
        </div>
      );
    case "error":
      return (
        <CatalogError
          error={panel.error}
          messages={m}
          onRetry={props.onRetry}
          onUpdate={props.onUpdate}
        />
      );
    case "results":
      break;
  }
  const { results } = panel;
  const row = (
    paint: PaintView,
    showBrand: boolean,
    key: string,
    index: number,
  ) => (
    <PaintRow
      key={paint.id}
      enter={entranceIndex(entrance, key, index)}
      leaving={isLeaving(entrance, key, index)}
      paint={paint}
      target={target}
      showBrand={showBrand}
      markApproximate={mixed}
      messages={m}
      locale={locale}
    />
  );
  // «See more» while there are more, and «See less» once it showed more.
  const moreOrLess = (key: string, hasMore: boolean, shown: number) =>
    hasMore || shown > DEFAULT_LIMIT ? (
      <div className="more-less">
        {hasMore && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              dispatch({ type: "show-more", key });
            }}
          >
            <PlusIcon />
            <span className="link-text">{m.results.seeMore}</span>
          </button>
        )}
        {shown > DEFAULT_LIMIT && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              dispatch({ type: "show-less", key });
            }}
          >
            <MinusIcon />
            <span className="link-text">{m.results.seeLess}</span>
          </button>
        )}
      </div>
    ) : null;
  if (results.byBrand.length === 0) {
    return <p className="empty">{m.results.noBrands}</p>;
  }
  if (view === "overall") {
    return (
      <div className="brand-group">
        <PaintList
          entrance={entrance}
          groupKey={OVERALL}
          count={results.overall.length}
        >
          {results.overall.map((paint, i) => row(paint, true, OVERALL, i))}
        </PaintList>
        {moreOrLess(OVERALL, results.overallHasMore, results.overall.length)}
      </div>
    );
  }
  return (
    <div className="brand-groups">
      {results.byBrand.map((brand) => (
        <div className="brand-group" key={brand.brandId}>
          <h4 className="brand-heading">{brand.brandName}</h4>
          {brand.paints.length === 0 ? (
            <p className="empty">{m.results.noPaints}</p>
          ) : (
            <PaintList
              entrance={entrance}
              groupKey={brand.brandId}
              count={brand.paints.length}
            >
              {brand.paints.map((paint, i) =>
                row(paint, false, brand.brandId, i),
              )}
            </PaintList>
          )}
          {moreOrLess(brand.brandId, brand.hasMore, brand.paints.length)}
        </div>
      ))}
    </div>
  );
}

/** The paints of a brand, whose height follows «See more» and «See less». */
function PaintList({
  entrance,
  groupKey,
  count,
  children,
}: {
  readonly entrance: Entrance | null;
  readonly groupKey: string;
  readonly count: number;
  readonly children: ReactNode;
}) {
  const list = useRef<HTMLOListElement>(null);
  useListHeight(list, entrance, groupKey, count);
  return (
    <ol className="paints" ref={list}>
      {children}
    </ol>
  );
}

/**
 * Marks the tabs with `data-stuck` while they stay fixed under the
 * navigation bar, so that the CSS gives them a shadow (docs/07 §1). It looks
 * at their place on each scroll, at most once per frame: fixed, they sit on
 * the line of their sticky `top`.
 */
function useStuck(tabs: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = tabs.current;
    if (element === null) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const top = parseFloat(getComputedStyle(element).top) || 0;
      const box = element.getBoundingClientRect();
      element.toggleAttribute(
        "data-stuck",
        Math.abs(box.top - top) < 1 && window.scrollY > 0,
      );
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(check);
    };
    check();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, [tabs]);
}

/**
 * Marks the bar of the tabs with `data-more-start` and `data-more-end` while
 * there are tabs hidden on that side (docs/07 §1), so that the CSS shows its
 * fade and arrow; each goes away once the tabs are scrolled to that end.
 */
function useOverflowEdges(
  bar: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const element = list.current;
    const container = bar.current;
    if (element === null || container === null) return;
    const check = () => {
      const start = Math.abs(element.scrollLeft);
      const hidden = element.scrollWidth - element.clientWidth;
      container.toggleAttribute("data-more-start", start > 1);
      container.toggleAttribute("data-more-end", hidden - start > 1);
    };
    check();
    element.addEventListener("scroll", check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(element);
    for (const tab of element.children) observer.observe(tab);
    return () => {
      element.removeEventListener("scroll", check);
      observer.disconnect();
    };
  });
}
