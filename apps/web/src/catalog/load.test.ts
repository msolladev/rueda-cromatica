import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "./load.ts";

const catalogText = readFileSync(
  new URL("../../public/catalog.json", import.meta.url),
  "utf8",
);

describe("loadCatalog", () => {
  it("validates and indexes the catalog of the app", async () => {
    const load = await loadCatalog(() => Promise.resolve(catalogText));
    expect(load.status).toBe("ready");
    if (load.status === "ready") expect(load.catalog.brands().length).toBe(4);
  });

  it("reports a network error", async () => {
    const load = await loadCatalog(() => Promise.reject(new Error("HTTP 503")));
    expect(load).toEqual({
      status: "error",
      error: { kind: "network", detail: "Error: HTTP 503" },
    });
  });

  it("reports malformed JSON as invalid data", async () => {
    const load = await loadCatalog(() => Promise.resolve("{"));
    expect(load.status === "error" && load.error.kind).toBe("invalid");
  });

  it("reports another schema version as an outdated app", async () => {
    const other = JSON.stringify({ meta: { schemaVersion: 99 } });
    const load = await loadCatalog(() => Promise.resolve(other));
    expect(load).toMatchObject({
      status: "error",
      error: { kind: "version", found: 99, supported: 1 },
    });
  });

  it("reports a catalog that does not validate, with its issues", async () => {
    const broken = JSON.parse(catalogText) as { paints: { rangeId: string }[] };
    const first = broken.paints[0];
    if (first === undefined) throw new Error("fixture");
    first.rangeId = "nobody/nothing";
    const load = await loadCatalog(() =>
      Promise.resolve(JSON.stringify(broken)),
    );
    expect(load.status === "error" && load.error.kind).toBe("invalid");
    expect(
      load.status === "error" && "detail" in load.error && load.error.detail,
    ).toContain("integrity");
  });
});
