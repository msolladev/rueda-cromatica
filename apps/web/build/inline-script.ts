/**
 * The only inline script, which runs before the first paint (docs/07 §6 and
 * §11). With saved preferences, it:
 *
 * - applies the saved theme, on `<html data-theme>` for the CSS and on
 *   `<meta name="color-scheme">` for what the browser paints before the CSS
 *   loads, so that the page does not flash in the system's theme;
 * - marks `<html data-restoring>`, which hides the wheel and the results
 *   until the app applies the preferences, so that the defaults of the
 *   prerendered page are not seen.
 *
 * The CSP allows it by its hash.
 */
import { createHash } from "node:crypto";
import { RESTORING, STORAGE_KEY } from "../src/app/before-paint.ts";

export const INLINE_SCRIPT = `try{var r=document.documentElement,p=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));if(p){r.dataset.${RESTORING}="";var t=p.theme;if(t==="light"||t==="dark"){r.dataset.theme=t;document.querySelector('meta[name="color-scheme"]').content=t}}}catch(e){}`;

/** The CSP source of the script: `'sha256-…'`. */
export function inlineScriptSource(): string {
  const hash = createHash("sha256").update(INLINE_SCRIPT).digest("base64");
  return `'sha256-${hash}'`;
}
