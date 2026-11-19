/**
 * The browser takes over the prerendered page (docs/07 §10): same page, same
 * data, so the first render matches the HTML.
 */
import "@chromatic-wheel/color-wheel/style.css";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import "./app/app.css";
import { App } from "./app/App.tsx";
import { PAGE_DATA_ID, type PageData } from "./app/page-data.ts";
import { pageOf } from "./app/pages.ts";
import { captureInstallPrompt } from "./features/pwa/install.ts";

// Before anything else: the browser can offer installing as soon as it loads.
captureInstallPrompt();

const root = document.getElementById("root");
const dataText = document.getElementById(PAGE_DATA_ID)?.textContent;
const data =
  dataText === undefined ? undefined : (JSON.parse(dataText) as PageData);
// «Page not found» answers at any address: its data says which page it is.
const page =
  data?.kind === "not-found"
    ? ({ kind: "not-found", locale: data.locale } as const)
    : pageOf(location.pathname);
if (root === null || page === undefined || data === undefined) {
  throw new Error(`Not a page of the app: ${location.pathname}`);
}

hydrateRoot(
  root,
  <StrictMode>
    <App page={page} data={data} />
  </StrictMode>,
);
