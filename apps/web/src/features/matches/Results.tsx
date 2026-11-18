/**
 * The closest paints of each color of the wheel (docs/07 §1-3): the view
 * selector, the filters, the approximate-color notice, one tab per color, the
 * legend of the split swatch and the panel of the selected color.
 */
import type { Labels, Role } from "@chromatic-wheel/color-wheel";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import {
  OVERALL,
  type Action,
  type Filters as FilterState,
  type View,
} from "../../app/state.ts";
import type { CatalogLoadError } from "../../catalog/load.ts";
import { CatalogError } from "../../catalog/CatalogError.tsx";
import { format } from "../../i18n/i18n.ts";
import type { Messages } from "../../i18n/messages.ts";
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
  const approximate = shown.filter((paint) => paint.reasons.length > 0).length;
  // docs/07 §3: a general notice if all are approximate; if they are mixed,
  // the notice explains the chip and only the approximate ones carry it.
  const mixed = approximate > 0 && approximate < shown.length;

  return (
    <div className="results">
      <div className="toolbar">
        <fieldset className="segmented">
          <legend>{m.results.show}</legend>
          <div className="segmented-options">
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
        <p className="notice notice-approx">
          <span aria-hidden="true">≈</span>
          <span>
            {mixed ? m.approximate.some : m.approximate.all}{" "}
            <a href="credits/">{m.approximate.sources}</a>
          </span>
        </p>
      )}
      <ColorTabs {...props} />
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
              {props.wheelLabels.role[color.role]} <code>{color.hex}</code>
            </h3>
            <PanelBody
              {...props}
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
}: ResultsProps) {
  const list = useRef<HTMLDivElement>(null);
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
    <div
      className="tabs"
      role="tablist"
      aria-label={m.results.colors}
      ref={list}
      onKeyDown={onKeyDown}
    >
      {colors.map((color, index) => {
        const role = wheelLabels.role[color.role];
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
            onClick={() => {
              select(index);
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
  );
}

interface PanelBodyProps extends ResultsProps {
  readonly panel: PanelContent;
  readonly target: string;
  readonly mixed: boolean;
}

function PanelBody(props: PanelBodyProps): ReactNode {
  const { panel, view, dispatch, messages: m, target, mixed, locale } = props;
  switch (panel.kind) {
    case "empty":
      return null;
    case "loading":
      return (
        <p className="loading" role="status">
          {m.results.loading}
        </p>
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
  const row = (paint: PaintView, showBrand: boolean) => (
    <PaintRow
      key={paint.id}
      paint={paint}
      target={target}
      showBrand={showBrand}
      markApproximate={mixed}
      messages={m}
      locale={locale}
    />
  );
  const more = (key: string) => (
    <button
      type="button"
      className="link-button"
      onClick={() => {
        dispatch({ type: "show-more", key });
      }}
    >
      {m.results.seeMore}
    </button>
  );
  if (results.byBrand.length === 0) {
    return <p className="empty">{m.results.noBrands}</p>;
  }
  if (view === "overall") {
    return (
      <div className="brand-group">
        <ol className="paints">
          {results.overall.map((paint) => row(paint, true))}
        </ol>
        {results.overallHasMore && more(OVERALL)}
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
            <ol className="paints">
              {brand.paints.map((paint) => row(paint, false))}
            </ol>
          )}
          {brand.hasMore && more(brand.brandId)}
        </div>
      ))}
    </div>
  );
}
