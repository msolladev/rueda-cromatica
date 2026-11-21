import type { PaintType } from "@chromatic-wheel/domain";
import { useRef } from "react";
import {
  EXTRA_PAINT_TYPES,
  type Action,
  type Filters as FilterState,
} from "../../app/state.ts";
import { format, SEPARATOR } from "../../i18n/i18n.ts";
import type { Messages } from "../../i18n/messages.ts";

export interface BrandOption {
  readonly id: string;
  readonly name: string;
}

interface FiltersProps {
  readonly brands: readonly BrandOption[];
  readonly filters: FilterState;
  readonly dispatch: (action: Action) => void;
  readonly messages: Messages;
}

function summaryOf(
  brands: readonly BrandOption[],
  filters: FilterState,
  m: Messages,
): string {
  const selected = brands.filter(
    (brand) => !filters.excludedBrands.includes(brand.id),
  ).length;
  const extra = filters.extraTypes.length + (filters.includeMetallic ? 1 : 0);
  return [
    selected === brands.length
      ? m.filters.allBrands
      : format(m.filters.someBrands, { count: selected, total: brands.length }),
    extra === 0
      ? m.filters.opaqueOnly
      : format(m.filters.moreTypes, { count: extra }),
    filters.includeDiscontinued
      ? m.filters.withDiscontinued
      : m.filters.withoutDiscontinued,
  ].join(SEPARATOR);
}

/** The filters, in a disclosure with a summary of what is on (docs/07 §1). */
export function Filters({
  brands,
  filters,
  dispatch,
  messages: m,
}: FiltersProps) {
  const summary = summaryOf(brands, filters, m);
  const summaryText = useRef<HTMLSpanElement>(null);
  // docs/07 §1: each change of a filter changes the summary, which gives a
  // small jump to confirm it, also with the disclosure closed.
  const change = (action: Action) => {
    dispatch(action);
    const element = summaryText.current;
    if (element === null) return;
    // The CSS animation starts again on each change: removed, measured (which
    // applies the removal) and added again.
    element.classList.remove("changed");
    element.getBoundingClientRect();
    element.classList.add("changed");
  };
  return (
    <details className="filters">
      <summary>
        <span className="filters-title">{m.filters.title}</span>{" "}
        <span className="filters-summary" ref={summaryText}>
          {summary}
        </span>
      </summary>
      <div className="filters-body">
        <fieldset>
          <legend>{m.filters.brands}</legend>
          <div className="checks">
            {brands.map((brand) => (
              <label key={brand.id}>
                <input
                  type="checkbox"
                  checked={!filters.excludedBrands.includes(brand.id)}
                  onChange={() => {
                    change({ type: "toggle-brand", brandId: brand.id });
                  }}
                />
                {brand.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{m.filters.addTypes}</legend>
          <div className="checks">
            {EXTRA_PAINT_TYPES.map((type: PaintType) => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={filters.extraTypes.includes(type)}
                  onChange={() => {
                    change({ type: "toggle-type", paintType: type });
                  }}
                />
                {m.paintTypes[type]}
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={filters.includeMetallic}
                onChange={(event) => {
                  change({
                    type: "set-metallic",
                    value: event.target.checked,
                  });
                }}
              />
              {m.filters.metallic}
            </label>
          </div>
        </fieldset>
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={filters.includeDiscontinued}
              onChange={(event) => {
                change({
                  type: "set-discontinued",
                  value: event.target.checked,
                });
              }}
            />
            {m.filters.includeDiscontinued}
          </label>
        </div>
      </div>
    </details>
  );
}
