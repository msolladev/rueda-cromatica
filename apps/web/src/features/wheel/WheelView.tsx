/**
 * The wheel of `color-wheel` inside React (docs/07 §5): not controlled. The
 * wheel owns its state; React creates it on mount, destroys it on unmount,
 * and only reads the result of its events. Writing to the wheel never answers
 * one of its events, so there is no loop.
 */
import {
  ColorWheel,
  type ColorWheelEventDetail,
  type Locale,
  type Result,
} from "@chromatic-wheel/color-wheel";
import { useEffect, useEffectEvent, useRef } from "react";
import type { WheelPreferences } from "../../app/state.ts";
import { DEFAULT_COLOR, DEFAULT_HARMONY } from "./defaults.ts";

export interface WheelViewProps {
  readonly locale: Locale;
  /** Applied once, when the saved preferences are read. */
  readonly restore: WheelPreferences | null;
  /** Every result: while dragging (`final` false) and after each change. */
  readonly onResult: (result: Result, final: boolean) => void;
  /** After each change (not while dragging), with what to save. */
  readonly onChange: (wheel: WheelPreferences) => void;
}

export function WheelView({
  locale,
  restore,
  onResult,
  onChange,
}: WheelViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const wheel = useRef<ColorWheel | null>(null);

  const handleInput = useEffectEvent((detail: ColorWheelEventDetail) => {
    onResult(detail.result, false);
  });
  const handleChange = useEffectEvent((detail: ColorWheelEventDetail) => {
    onResult(detail.result, true);
    const { color, model, harmony, light } = detail.state;
    onChange({ color, model, harmony, light });
  });
  const handleReady = useEffectEvent((result: Result) => {
    onResult(result, true);
  });

  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    const created = new ColorWheel(element, {
      color: DEFAULT_COLOR,
      harmony: DEFAULT_HARMONY,
      locale,
      // The web shows the colors in its own tabs (docs/07 §1).
      hiddenControls: ["results"],
    });
    created.addEventListener("input", (event) => {
      handleInput(event.detail);
    });
    created.addEventListener("change", (event) => {
      handleChange(event.detail);
    });
    wheel.current = created;
    handleReady(created.getResult());
    return () => {
      created.destroy();
      wheel.current = null;
    };
  }, [locale]);

  useEffect(() => {
    if (restore !== null) wheel.current?.update(restore);
  }, [restore]);

  return <div className="wheel-host" ref={host} />;
}
