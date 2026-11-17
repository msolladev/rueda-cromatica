/**
 * @license
 * Icons "circle-question-mark" and "x" copied from Lucide v1.71.0
 * (https://lucide.dev), both derived from Feather (https://feathericons.com).
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

// The icons of the component (docs/05 §6.9), copied instead of depending on
// a library for two icons. Built with the DOM, without HTML strings.

const SVG = "http://www.w3.org/2000/svg";

type IconNode = readonly (readonly [
  tag: string,
  attributes: Record<string, string>,
])[];

const CIRCLE_QUESTION_MARK: IconNode = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
  ["path", { d: "M12 17h.01" }],
];

const X: IconNode = [
  ["path", { d: "M18 6 6 18" }],
  ["path", { d: "m6 6 12 12" }],
];

/** A decorative icon of `1em`, drawn with the color of the text. */
function icon(node: IconNode): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  const attributes: Record<string, string> = {
    class: "cw-icon",
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  };
  for (const [name, value] of Object.entries(attributes)) {
    svg.setAttribute(name, value);
  }
  for (const [tag, childAttributes] of node) {
    const child = document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(childAttributes)) {
      child.setAttribute(name, value);
    }
    svg.append(child);
  }
  return svg;
}

export function helpIcon(): SVGSVGElement {
  return icon(CIRCLE_QUESTION_MARK);
}

export function closeIcon(): SVGSVGElement {
  return icon(X);
}
