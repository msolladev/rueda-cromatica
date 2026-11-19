/**
 * The only inline script, which runs before the first paint (docs/07 §6,
 * §11 and §12). With saved preferences, it:
 *
 * - applies the saved theme, on `<html data-theme>` for the CSS and on
 *   `<meta name="color-scheme">` for what the browser paints before the CSS
 *   loads, so that the page does not flash in the system's theme;
 * - marks `<html data-restoring>`, which hides the wheel and the results
 *   until the app applies the preferences, so that the defaults of the
 *   prerendered page are not seen;
 * - if the page was reached through a link of the app, marks
 *   `<html data-arriving>`, and the page enters with a fade (docs/07 §12).
 *
 * And always, if the app can be installed here, is not installed and the
 * banner was not closed, marks `<html data-install>`, so that the install
 * banner is there from the first paint (docs/07 §8).
 *
 * The CSP allows it by its hash.
 */
import { createHash } from "node:crypto";
import {
  ARRIVING,
  ARRIVING_KEY,
  INSTALL,
  RESTORING,
  STORAGE_KEY,
} from "../src/app/before-paint.ts";

export const INLINE_SCRIPT = `var r=document.documentElement,p=null;try{p=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));if(p){r.dataset.${RESTORING}="";var t=p.theme;if(t==="light"||t==="dark"){r.dataset.theme=t;document.querySelector('meta[name="color-scheme"]').content=t}}}catch(e){}try{var n=navigator;if(!(p&&p.installDismissed)&&!matchMedia("(display-mode: standalone)").matches&&n.standalone!==true){if("onbeforeinstallprompt" in window)r.dataset.${INSTALL}="prompt";else if("standalone" in n)r.dataset.${INSTALL}="ios"}}catch(e){}try{if(sessionStorage.getItem(${JSON.stringify(ARRIVING_KEY)})){sessionStorage.removeItem(${JSON.stringify(ARRIVING_KEY)});r.dataset.${ARRIVING}=""}}catch(e){}`;

/** The CSP source of the script: `'sha256-…'`. */
export function inlineScriptSource(): string {
  const hash = createHash("sha256").update(INLINE_SCRIPT).digest("base64");
  return `'sha256-${hash}'`;
}
