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
const page = pageOf(location.pathname);
const dataText = document.getElementById(PAGE_DATA_ID)?.textContent;
if (root === null || page === undefined || dataText === undefined) {
  throw new Error(`Not a page of the app: ${location.pathname}`);
}
const data = JSON.parse(dataText) as PageData;

hydrateRoot(
  root,
  <StrictMode>
    <App page={page} data={data} />
  </StrictMode>,
);
