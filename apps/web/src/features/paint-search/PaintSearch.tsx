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
  type PaintSearchHighlights,
  type PaintSearchIndex,
  type Range,
  type TextRange,
} from "@chromatic-wheel/domain";
import { useCombobox } from "downshift";
import {
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  CloseIcon,
  InfoIcon,
  PlusIcon,
  RotateCcwIcon,
} from "../../app/icons.tsx";
import { format, formatDeltaE, SEPARATOR } from "../../i18n/i18n.ts";
import type { Messages } from "../../i18n/messages.ts";

/** How many suggestions are shown at first, and added by «See more». */
export const PAGE = 8;

/** Above this ΔE the RYB wheel visibly does not reach the paint (docs/06 §3). */
export const RYB_NOTICE_LIMIT = 1;

/** The field's ID, to give it the focus back after emptying it. */
const INPUT_ID = "paint-search-input";

/** A paint as the search shows it: from a search, or the chosen one. */
export interface PaintChoice {
  readonly paint: Paint;
  readonly brand: Brand;
  readonly range: Range;
  /** Where what was written appears, only in a suggestion. */
  readonly highlights?: PaintSearchHighlights;
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

const itemToString = (item: Item | null): string =>
  item === null || item === MORE ? "" : item.paint.name;

/** Tells Downshift not to do its own work for this event (for «See more»). */
function skipDownshift(event: SyntheticEvent): void {
  event.preventDefault();
  (
    event.nativeEvent as Event & { preventDownshiftDefault?: boolean }
  ).preventDownshiftDefault = true;
}

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
  const moreIndex = hits.length > shown ? visible.length : null;
  const items: Item[] = moreIndex === null ? [...visible] : [...visible, MORE];

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
      // Leaving the field chooses nothing: the choice is explicit.
      if (type === useCombobox.stateChangeTypes.InputBlur) {
        return {
          ...changes,
          selectedItem: state.selectedItem,
          inputValue: state.inputValue,
        };
      }
      // With fewer letters there is nothing to show.
      const text = changes.inputValue ?? state.inputValue;
      return changes.isOpen === true && !isSearchable(text)
        ? { ...changes, isOpen: false }
        : changes;
    },
  });

  const open = isOpen && isSearchable(inputValue);
  const showMore = (event: SyntheticEvent) => {
    skipDownshift(event);
    setShown(shown + PAGE);
    // The focus goes on to the first new suggestion.
    setHighlightedIndex(visible.length);
  };
  // The suggestions «See more» added, which enter one after another.
  const enteringFrom = shown > PAGE ? shown - PAGE : null;
  const chosenShown =
    chosen !== null && inputValue === chosen.paint.name ? chosen : null;
  const counted = {
    shown: String(visible.length),
    total: String(hits.length),
  };

  return (
    <search
      className="paint-search"
      data-chosen={chosenShown === null ? undefined : ""}
    >
      <label className="paint-search-label" {...getLabelProps()}>
        {m.search.label}
      </label>
      <p className="paint-search-hint" id="paint-search-hint">
        {format(m.search.hint, { min: String(MIN_QUERY_LENGTH) })}
      </p>
      <div className="paint-search-field">
        <span
          className="swatch"
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
            placeholder: m.search.placeholder,
            "aria-describedby":
              chosenShown === null
                ? "paint-search-hint"
                : "paint-search-hint paint-search-meta",
            onKeyDown: (event) => {
              if (
                event.key === "Enter" &&
                open &&
                highlightedIndex === moreIndex
              ) {
                showMore(event);
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
            items.map((item, at) => {
              const active = highlightedIndex === at ? "" : undefined;
              if (item === MORE) {
                return (
                  <li
                    key={MORE}
                    className="paint-search-more"
                    data-active={active}
                    {...getItemProps({ item, index: at, onClick: showMore })}
                  >
                    <span className="link-button">
                      <PlusIcon />
                      <span className="link-text">
                        {format(m.search.seeMore, counted)}
                      </span>
                    </span>
                  </li>
                );
              }
              const entering = enteringFrom !== null && at >= enteringFrom;
              return (
                <li
                  key={item.paint.id}
                  className="paint-search-option"
                  data-active={active}
                  data-enter={entering ? "" : undefined}
                  style={
                    entering
                      ? ({ "--enter": at - enteringFrom } as CSSProperties)
                      : undefined
                  }
                  {...getItemProps({ item, index: at })}
                >
                  <Suggestion choice={item} messages={m} />
                </li>
              );
            })}
        </ul>
      </div>
      {chosenShown !== null ? (
        <p className="paint-search-chosen" id="paint-search-meta">
          <PaintDetails choice={chosenShown} />
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
      {chosenShown !== null &&
        rybDeltaE !== null &&
        rybDeltaE > RYB_NOTICE_LIMIT && (
          <div className="notice notice-warn paint-search-ryb">
            <InfoIcon />
            <p>
              {format(m.search.rybNotice, {
                deltaE: formatDeltaE(rybDeltaE, locale),
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
        {open
          ? hits.length === 0
            ? m.search.noMatches
            : format(m.search.count, counted)
          : chosenShown !== null
            ? format(m.search.chosen, {
                name: chosenShown.paint.name,
                brand: chosenShown.brand.name,
                range: chosenShown.range.name,
              })
            : ""}
      </p>
    </search>
  );
}

/** One suggestion: its swatch, its name and type, and its details. */
function Suggestion({
  choice,
  messages: m,
}: {
  readonly choice: PaintChoice;
  readonly messages: Messages;
}) {
  const { paint, highlights } = choice;
  const type = m.paintTypes[paint.type];
  return (
    <>
      <span
        className="swatch"
        style={{ background: paint.color?.hex }}
        aria-hidden="true"
      />
      <span className="paint-search-text">
        <span className="paint-search-name">
          <Highlighted text={paint.name} ranges={highlights?.name} />
        </span>
        <span className="paint-search-type">
          {SEPARATOR}
          <i>
            {paint.metallic ? format(m.search.typeMetallic, { type }) : type}
          </i>
        </span>
        <span className="paint-search-meta">
          <PaintDetails choice={choice} />
        </span>
      </span>
    </>
  );
}

/** The brand, the range and the code, in the order of the bottle. */
function PaintDetails({ choice }: { readonly choice: PaintChoice }) {
  const { brand, range, paint, highlights } = choice;
  const parts = [
    <Highlighted key="brand" text={brand.name} ranges={highlights?.brand} />,
    <Highlighted key="range" text={range.name} ranges={highlights?.range} />,
  ];
  if (paint.manufacturerCode !== null) {
    parts.push(
      <Highlighted
        key="code"
        text={paint.manufacturerCode}
        ranges={highlights?.code}
      />,
    );
  }
  return parts.flatMap((part, at) => (at === 0 ? [part] : [SEPARATOR, part]));
}

/** The text with what was written in bold (docs/06 §9.1). */
function Highlighted({
  text,
  ranges = [],
}: {
  readonly text: string;
  readonly ranges?: readonly TextRange[] | undefined;
}): ReactNode {
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
