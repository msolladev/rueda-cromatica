/**
 * What the inline script of the `<head>` and the app share
 * (build/inline-script.ts): it runs before the first paint, before the app.
 */

/** The `localStorage` key of the preferences, with the version of their format. */
export const STORAGE_KEY = "rueda-cromatica.preferences.v1";

/**
 * The `<html>` data attribute that hides the wheel and the results while the
 * saved preferences are applied (docs/07 §6), so that the defaults of the
 * prerendered page are never seen.
 */
export const RESTORING = "restoring";
