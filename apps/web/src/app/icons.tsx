/**
 * @license
 * Icons "sun", "moon", "monitor", "menu", "x", "info", "external-link", "plus", "minus", "arrow-left", "refresh-cw", "rotate-ccw", "chevron-left" and "chevron-right" copied from Lucide v1.71.0
 * (https://lucide.dev), and "chevron-down" and "check" (with a thicker
 * line), copied in app.css; "moon", "monitor", "x", "info", "chevron-down"
 * and "check" are derived from Feather (https://feathericons.com).
 *
 * ISC License. Copyright (c) 2026 Lucide Icons and Contributors.
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * The MIT License (MIT). Copyright (c) 2013-present Cole Bemis.
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions: The above copyright notice and this permission
 * notice shall be included in all copies or substantial portions of the
 * Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
 * NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// The web's icons (docs/07 §11), copied like those of color-wheel instead of
// depending on a library for a few icons, and "wheel", the web's own: the
// circle and the triangle of its icon, drawn on the grid and with the line of
// Lucide (docs/07 §16). Decorative: the controls that use them have their own
// accessible name.

import type { CSSProperties, ReactNode } from "react";

function Icon({
  children,
  name,
}: {
  readonly children: ReactNode;
  /** Adds `icon-{name}`, for the CSS that animates its parts. */
  readonly name?: string;
}) {
  return (
    <svg
      className={name === undefined ? "icon" : `icon icon-${name}`}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Each ray knows its place, so that they can come out one after another. */
const ray = (index: number) => ({ "--ray": index }) as CSSProperties;

export const SunIcon = () => (
  <Icon name="sun">
    <circle cx="12" cy="12" r="4" />
    <path className="ray" style={ray(0)} d="M12 2v2" />
    <path className="ray" style={ray(4)} d="M12 20v2" />
    <path className="ray" style={ray(7)} d="m4.93 4.93 1.41 1.41" />
    <path className="ray" style={ray(3)} d="m17.66 17.66 1.41 1.41" />
    <path className="ray" style={ray(6)} d="M2 12h2" />
    <path className="ray" style={ray(2)} d="M20 12h2" />
    <path className="ray" style={ray(5)} d="m6.34 17.66-1.41 1.41" />
    <path className="ray" style={ray(1)} d="m19.07 4.93-1.41 1.41" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon name="moon">
    <path
      className="moon-body"
      d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
    />
  </Icon>
);

export const MonitorIcon = () => (
  <Icon name="monitor">
    <rect className="screen" width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </Icon>
);

export const MenuIcon = () => (
  <Icon>
    <path d="M4 5h16" />
    <path d="M4 12h16" />
    <path d="M4 19h16" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);

export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </Icon>
);

/** Its arrow is a group of its own, so that the CSS can move it. */
export const ExternalLinkIcon = () => (
  <Icon>
    <g className="icon-arrow">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </g>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Icon>
);

export const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
);

export const ArrowLeftIcon = () => (
  <Icon name="arrow-left">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Icon>
);

export const RefreshIcon = () => (
  <Icon name="refresh">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </Icon>
);

/** The wheel of the web's icon: «make it the base of the wheel». */
export const WheelIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6.5 16.8 14.8H7.2Z" />
  </Icon>
);

export const RotateCcwIcon = () => (
  <Icon>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);

export const ChevronLeftIcon = () => (
  <Icon>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const ChevronRightIcon = () => (
  <Icon>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
