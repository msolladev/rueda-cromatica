import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  CuratedFiles,
  ReleaseCatalog,
} from "@chromatic-wheel/catalog-builder/data";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/app.ts";
import { loadCatalog, prepareCatalog } from "../../../test/catalog.ts";
import { PrismaService } from "../../core/database/prisma.service.ts";
import { CatalogBuildService } from "./catalog-build.service.ts";
import { DraftService } from "./draft.service.ts";
import { LoadCatalogService } from "./load-catalog.service.ts";

const REPO = join(import.meta.dirname, "../../../../..");
const versioned = (path: string) => readFile(join(REPO, path), "utf8");

let app: NestExpressApplication;
let prisma: PrismaService;
let files: CuratedFiles;
let release: ReleaseCatalog;

const load = () => loadCatalog(app, { files, release });

async function build() {
  return app.get(CatalogBuildService).build();
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  ({ files, release } = await prepareCatalog(app));
});

afterAll(async () => {
  await app.close();
});

describe("the catalog generated from the database (ADR-0043)", () => {
  it("is identical, byte for byte, to the versioned catalog.json and reports", async () => {
    const built = await build();
    if (!built.ok) throw new Error(JSON.stringify(built.error));
    expect(built.value.json).toBe(
      await versioned("apps/web/public/catalog.json"),
    );
    expect(built.value.discrepanciesJson).toBe(
      await versioned(
        "packages/catalog-builder/reports/color-discrepancies.json",
      ),
    );
    expect(built.value.disabledSourcesJson).toBe(
      await versioned("packages/catalog-builder/reports/disabled-sources.json"),
    );
  });

  it("keeps every file of data/ as it is in the draft", async () => {
    const draft = await app.get(DraftService).read();
    expect(draft).toEqual(files);
  });
});

describe("the load from data/ (ADR-0043)", () => {
  it("stores the latest release as the first publication, without a draft", async () => {
    const publications = await prisma.publication.findMany({
      include: { catalogs: true },
    });
    expect(publications).toHaveLength(1);
    const [first] = publications;
    expect(first?.releaseTag).toBe(release.tag);
    expect(first?.publishedAt).toEqual(release.releasedAt);
    expect(first?.draft).toBeNull();
    expect(first?.catalogs.map((c) => c.content)).toEqual([release.text]);
  });

  it("can be repeated: the same draft, and publications untouched", async () => {
    const before = await prisma.publication.findMany();
    const loaded = await load();
    expect(loaded.publication).toBe("kept");
    expect(await prisma.publication.findMany()).toEqual(before);
    expect(await app.get(DraftService).read()).toEqual(files);
  });

  it("refuses data that its schemas reject, writing nothing", async () => {
    const broken: CuratedFiles = {
      ...files,
      tombstones: { name: "tombstones.json", content: { paints: [] } },
    };
    const loaded = await app.get(LoadCatalogService).load(broken, release);
    expect(loaded.ok).toBe(false);
    expect(await app.get(DraftService).read()).toEqual(files);
  });
});

describe("the ID stability against the latest publication (docs/03 §7)", () => {
  it("fails when a tombstoned ID is in the draft", async () => {
    await prisma.tombstone.create({
      data: {
        collection: "paints",
        catalogId: "citadel/base/abaddon-black",
        position: 0,
        reason: "For the test.",
      },
    });
    try {
      const built = await build();
      expect(built.ok ? null : built.error).toMatchObject({
        kind: "unstable-ids",
        report: expect.stringContaining(
          "paints citadel/base/abaddon-black: tombstoned",
        ) as unknown,
      });
    } finally {
      await prisma.tombstone.deleteMany();
    }
  });

  it("fails when an ID of the latest publication is missing from the draft", async () => {
    const catalog = JSON.parse(release.text) as { paints: { id: string }[] };
    catalog.paints.push({ id: "citadel/base/never-made" });
    const publication = await prisma.publication.create({
      data: {
        publishedAt: new Date(),
        catalogs: {
          create: {
            schemaVersion: 1,
            dataVersion: "sha256:test",
            content: JSON.stringify(catalog),
          },
        },
      },
    });
    try {
      const built = await build();
      expect(built.ok ? null : built.error).toMatchObject({
        kind: "unstable-ids",
        report: expect.stringContaining(
          "paints citadel/base/never-made: published but missing.",
        ) as unknown,
      });
    } finally {
      await prisma.publicationCatalog.deleteMany({
        where: { publicationId: publication.id },
      });
      await prisma.publication.delete({ where: { id: publication.id } });
    }
  });
});
