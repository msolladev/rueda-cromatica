import {
  catalogIds,
  type PublishedCatalog,
} from "@chromatic-wheel/catalog-builder";
import type { ReleaseCatalog } from "@chromatic-wheel/catalog-builder/data";
import {
  err,
  ok,
  parseCatalog,
  SUPPORTED_SCHEMA_VERSION,
  type Result,
} from "@chromatic-wheel/domain";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service.ts";

/** The text of a published catalog, as it is served. */
export interface PublishedText {
  readonly dataVersion: string;
  readonly content: string;
}

/**
 * The publications (ADR-0043): each one keeps the exact text of its catalog
 * and is never modified. The latest one is what the web is built with, and
 * the reference of the IDs (docs/03 §7).
 */
@Injectable()
export class PublicationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The catalog of the latest publication in a schema version, or `null` if
   * nothing is published or the latest publication lacks that version. It
   * never falls back to an older publication, which would be out of date.
   */
  async latestCatalog(schemaVersion: number): Promise<PublishedText | null> {
    const latest = await this.prisma.publication.findFirst({
      orderBy: { id: "desc" },
      select: {
        catalogs: {
          where: { schemaVersion },
          select: { dataVersion: true, content: true },
        },
      },
    });
    return latest?.catalogs[0] ?? null;
  }

  /** The IDs of the latest publication, or `null` before the first one. */
  async latestIds(): Promise<Result<PublishedCatalog | null, string>> {
    const latest = await this.prisma.publication.findFirst({
      orderBy: { id: "desc" },
      select: {
        uuid: true,
        publishedAt: true,
        releaseTag: true,
        catalogs: {
          where: { schemaVersion: SUPPORTED_SCHEMA_VERSION },
          select: { content: true },
        },
      },
    });
    if (latest === null) return ok(null);
    const label = `the publication of ${latest.publishedAt.toISOString()} (${latest.releaseTag ?? latest.uuid})`;
    const [catalog] = latest.catalogs;
    if (catalog === undefined) {
      return err(
        `${label} has no catalog in schema version ${String(SUPPORTED_SCHEMA_VERSION)}`,
      );
    }
    const ids = catalogIds(parseJson(catalog.content));
    return ids.ok
      ? ok({ label, ids: ids.value })
      : err(`${label}: ${ids.error}`);
  }

  /**
   * Stores the catalog of the latest release tag as the first publication,
   * with the date of its commit and without a copy of the draft, whose
   * `data/` had an older format (ADR-0043). Publications are never modified,
   * so once there is one, it does nothing.
   */
  async addFirst(
    release: ReleaseCatalog,
  ): Promise<Result<"added" | "kept", string>> {
    const parsed = parseCatalog(parseJson(release.text));
    if (!parsed.ok) {
      return err(
        `The catalog of ${release.tag} is not valid: ${JSON.stringify(parsed.error)}`,
      );
    }
    const { meta } = parsed.value;
    return this.prisma.$transaction(async (tx) => {
      if ((await tx.publication.count()) > 0) return ok("kept");
      await tx.publication.create({
        data: {
          publishedAt: release.releasedAt,
          releaseTag: release.tag,
          catalogs: {
            create: {
              schemaVersion: meta.schemaVersion,
              dataVersion: meta.dataVersion,
              content: release.text,
            },
          },
        },
      });
      return ok("added");
    });
  }
}

/** The parsed JSON, or `undefined` if it is not JSON, for `parseCatalog` to reject. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
