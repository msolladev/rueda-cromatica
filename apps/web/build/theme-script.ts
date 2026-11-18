/**
 * The inline script that applies the saved theme before the first paint
 * (docs/07 §11), so that the page does not flash in the system's theme. It is
 * the only inline script; the CSP allows it by its hash.
 */
import { createHash } from "node:crypto";
import { STORAGE_KEY } from "../src/app/storage-key.ts";

export const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).theme;if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** The CSP source of the script: `'sha256-…'`. */
export function themeScriptSource(): string {
  const hash = createHash("sha256").update(THEME_SCRIPT).digest("base64");
  return `'sha256-${hash}'`;
}
