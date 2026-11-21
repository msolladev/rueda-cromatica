/**
 * The paint search above the wheel (docs/07 §15): a field with suggestions
 * (the combobox pattern of the APG, with Downshift) that makes a paint the
 * base of the wheel. Under it, while the base is that paint, its brand, range
 * and code; once the wheel moves away, «Back to…»; and, if the RYB wheel does
 * not reach its color, a notice that offers the digital wheel.
 */
import {
  isSearchable,
  MIN_QUERY_LENGTH,
  searchPaints,
  type Brand,
  type Paint,
  type PaintSearchHit,
  type PaintSearchIndex,
  type Range,
  type TextRange,
} from "@chromatic-wheel/domain";
import { useCombobox } from "downshift";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  CloseIcon,
  InfoIcon,
  PlusIcon,
  RotateCcwIcon,
} from "../../app/icons.tsx";
import { format } from "../../i18n/i18n.ts";
import type { Messages } from "../../i18n/messages.ts";

/** How many suggestions are shown at first, and added by «See more». */
export const PAGE = 8;

/** Above this ΔE the RYB wheel visibly does not reach the paint (docs/06 §3). */
export const RYB_NOTICE_LIMIT = 1;

/** A paint as the search shows it: from a search, or the chosen one. */
export interface PaintChoice {
  readonly paint: Paint;
  readonly brand: Brand;
  readonly range: Range;
  /** Where what was written appears, only in a suggestion. */
  readonly highlights?: PaintSearchHit["highlights"];
}

/** The last suggestion, which shows more instead of choosing. */
const MORE = "more";
type Item = PaintChoice | typeof MORE;

export interface PaintSearchProps {
  /** `null` until the catalog is loaded: the field waits, disabled. */
  readonly index: PaintSearchIndex | null;
  /** The paint the base comes from, if it still is the base. */
  readonly chosen: PaintChoice | null;
  /** The paint the base came from until the wheel moved, for «Back to…». */
  readonly previous: Paint | null;
  /** How far the RYB wheel is from the chosen paint, if it is in RYB. */
  readonly rybDeltaE: number | null;
  readonly messages: Messages;
  readonly locale: string;
  readonly onChoose: (choice: PaintChoice) => void;
  readonly onClear: () => void;
  readonly onBack: () => void;
  readonly onUseDigital: () => void;
}

/** The text with what was written in bold. */
function marked(text: string, ranges: readonly TextRange[] = []): ReactNode {
  if (ranges.length === 0) return text;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const { start, end } of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<strong key={start}>{text.slice(start, end)}</strong>);
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

const itemToString = (item: Item | null): string =>
  item === null || item === MORE ? "" : item.paint.name;

/** The field's ID, to give it the focus back after emptying it. */
const INPUT_ID = "paint-search-input";

export function PaintSearch({
  index,
  chosen,
  previous,
  rybDeltaE,
  messages: m,
  locale,
  onChoose,
  onClear,
  onBack,
  onUseDigital,
}: PaintSearchProps) {
  const [query, setQuery] = useState(chosen?.paint.name ?? "");
  const [shown, setShown] = useState(PAGE);
  const hits = useMemo(
    () => (index === null ? [] : searchPaints(index, query)),
    [index, query],
  );
  const visible = hits.slice(0, shown);
  const hasMore = hits.length > shown;
  const items: Item[] = hasMore ? [...visible, MORE] : [...visible];

  const {
    isOpen,
    highlightedIndex,
    inputValue,
    getLabelProps,
    getInputProps,
    getMenuProps,
    getItemProps,
    setHighlightedIndex,
    setInputValue,
  } = useCombobox<Item>({
    items,
    itemToString,
    inputId: INPUT_ID,
    selectedItem: chosen,
    onInputValueChange: ({ inputValue: value }) => {
      setQuery(value);
      setShown(PAGE);
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem === null) onClear();
      else if (selectedItem !== MORE) onChoose(selectedItem);
    },
    stateReducer: (state, { type, changes }) => {
      switch (type) {
        // Leaving the field chooses nothing: the choice is explicit.
        case useCombobox.stateChangeTypes.InputBlur:
          return {
            ...changes,
            selectedItem: state.selectedItem,
            inputValue: state.inputValue,
          };
        default:
          // With fewer letters there is nothing to show.
          return changes.isOpen === true &&
            !isSearchable(changes.inputValue ?? state.inputValue)
            ? { ...changes, isOpen: false }
            : changes;
      }
    },
  });

  const open = isOpen && isSearchable(inputValue);
  const moreIndex = hasMore ? visible.length : -1;
  const showMore = () => {
    setShown(shown + PAGE);
    // The focus goes on to the first new suggestion.
    setHighlightedIndex(visible.length);
  };
  const entering = (at: number) => shown > PAGE && at >= shown - PAGE;
  const isChosenShown = chosen !== null && inputValue === chosen.paint.name;
  const status = open
    ? hits.length === 0
      ? m.search.noMatches
      : format(m.search.count, {
          shown: String(visible.length),
          total: String(hits.length),
        })
    : isChosenShown
      ? format(m.search.chosen, {
          name: chosen.paint.name,
          brand: chosen.brand.name,
          range: chosen.range.name,
        })
      : "";
  const metaOf = (choice: PaintChoice): ReactNode[] => {
    const parts = [
      marked(choice.brand.name, choice.highlights?.brand),
      marked(choice.range.name, choice.highlights?.range),
    ];
    if (choice.paint.manufacturerCode !== null) {
      parts.push(
        marked(choice.paint.manufacturerCode, choice.highlights?.code),
      );
    }
    return parts.flatMap((part, at) => (at === 0 ? [part] : [" · ", part]));
  };
  const typeOf = (paint: Paint): string => {
    const type = m.paintTypes[paint.type];
    return paint.metallic ? format(m.search.typeMetallic, { type }) : type;
  };

  return (
    <div className="paint-search" data-chosen={isChosenShown ? "" : undefined}>
      <label className="paint-search-label" {...getLabelProps()}>
        {m.search.label}
      </label>
      <p className="paint-search-hint" id="paint-search-hint">
        {format(m.search.hint, { min: String(MIN_QUERY_LENGTH) })}
      </p>
      <div className="paint-search-field">
        <span
          className="swatch paint-search-swatch"
          style={{ background: chosen?.paint.color?.hex }}
          aria-hidden="true"
        />
        <input
          className="paint-search-input"
          {...getInputProps({
            disabled: index === null,
            autoComplete: "off",
            autoCapitalize: "off",
            spellCheck: false,
            enterKeyHint: "search",
            "aria-describedby": isChosenShown
              ? "paint-search-hint paint-search-meta"
              : "paint-search-hint",
            onKeyDown: (event) => {
              if (
                event.key === "Enter" &&
                open &&
                highlightedIndex === moreIndex &&
                moreIndex !== -1
              ) {
                event.preventDefault();
                (
                  event.nativeEvent as KeyboardEvent & {
                    preventDownshiftDefault?: boolean;
                  }
                ).preventDownshiftDefault = true;
                showMore();
              }
            },
          })}
        />
        {inputValue !== "" && (
          <button
            type="button"
            className="icon-button paint-search-clear"
            aria-label={m.search.clear}
            onClick={() => {
              setInputValue("");
              onClear();
              document.getElementById(INPUT_ID)?.focus();
            }}
          >
            <CloseIcon />
          </button>
        )}
        <ul
          className="paint-search-list"
          {...getMenuProps({ "aria-label": m.search.paints })}
          hidden={!open}
        >
          {open && hits.length === 0 && (
            <li className="paint-search-empty" role="presentation">
              {m.search.noMatches}
            </li>
          )}
          {open &&
            items.map((item, at) =>
              item === MORE ? (
                <li
                  key={MORE}
                  className="paint-search-more"
                  data-active={highlightedIndex === at ? "" : undefined}
                  {...getItemProps({
                    item,
                    index: at,
                    onClick: (event) => {
                      (
                        event.nativeEvent as MouseEvent & {
                          preventDownshiftDefault?: boolean;
                        }
                      ).preventDownshiftDefault = true;
                      showMore();
                    },
                  })}
                >
                  <span className="link-button">
                    <PlusIcon />
                    <span className="link-text">
                      {format(m.search.seeMore, {
                        shown: String(visible.length),
                        total: String(hits.length),
                      })}
                    </span>
                  </span>
                </li>
              ) : (
                <li
                  key={item.paint.id}
                  className="paint-search-option"
                  data-active={highlightedIndex === at ? "" : undefined}
                  // The ones «See more» added enter one after another.
                  data-enter={entering(at) ? "" : undefined}
                  style={
                    entering(at)
                      ? ({ "--enter": at - (shown - PAGE) } as CSSProperties)
                      : undefined
                  }
                  {...getItemProps({ item, index: at })}
                >
                  <span
                    className="swatch"
                    style={{ background: item.paint.color?.hex }}
                    aria-hidden="true"
                  />
                  <span className="paint-search-text">
                    <span className="paint-search-name">
                      {marked(item.paint.name, item.highlights?.name)}
                    </span>
                    <span className="paint-search-type">
                      {" · "}
                      <i>{typeOf(item.paint)}</i>
                    </span>
                    <span className="paint-search-meta">{metaOf(item)}</span>
                  </span>
                </li>
              ),
            )}
        </ul>
      </div>
      {isChosenShown ? (
        <p className="paint-search-chosen" id="paint-search-meta">
          {metaOf(chosen)}
        </p>
      ) : (
        previous !== null &&
        !open && (
          <p className="paint-search-back">
            <button type="button" className="link-button" onClick={onBack}>
              <RotateCcwIcon />
              <span className="link-text">
                {format(m.search.back, { name: previous.name })}
              </span>
            </button>
          </p>
        )
      )}
      {isChosenShown && rybDeltaE !== null && rybDeltaE > RYB_NOTICE_LIMIT && (
        <div className="notice paint-search-ryb">
          <InfoIcon />
          <p>
            {format(m.search.rybNotice, {
              deltaE: rybDeltaE.toLocaleString(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            })}{" "}
            <button
              type="button"
              className="link-button"
              onClick={onUseDigital}
            >
              <span className="link-text">{m.search.useDigital}</span>
            </button>
          </p>
        </div>
      )}
      <p className="visually-hidden" role="status">
        {status}
      </p>
    </div>
  );
}
