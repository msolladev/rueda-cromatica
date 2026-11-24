import type { Curated, Tombstones } from "@chromatic-wheel/catalog-builder";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import {
  draftFiles,
  paintPartRecords,
  paintRecords,
  rootRecords,
  sourceAndRangeRecords,
  type DraftFiles,
  type Ids,
} from "./draft-rows.ts";

/** How long a write of the whole draft may take: about 15 000 rows. */
const WHOLE_DRAFT_TIMEOUT_MS = 60_000;

const byPosition = { orderBy: { position: "asc" } } as const;

/**
 * The draft of the catalog (ADR-0043): the only place that writes its tables,
 * so that the history of session 7 can be written here, in the same
 * transaction, and nowhere else.
 */
@Injectable()
export class DraftService {
  constructor(private readonly prisma: PrismaService) {}

  /** The draft, as the files of `data/`. */
  async read(
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<DraftFiles> {
    const [
      sources,
      downloads,
      rows,
      equivalences,
      replacements,
      reasons,
      ignoredGroups,
      ignoredKeys,
      colorPolicy,
      brands,
      ranges,
      paints,
      paintKeys,
      rejectedColors,
      tombstones,
    ] = await Promise.all([
      client.source.findMany(byPosition),
      client.sourceDownload.findMany(byPosition),
      client.sourceRow.findMany(byPosition),
      client.sourceEquivalence.findMany(byPosition),
      client.sourceReplacement.findMany(byPosition),
      client.ignoreReason.findMany(byPosition),
      client.ignoredGroup.findMany(byPosition),
      client.ignoredKey.findMany(byPosition),
      client.colorPolicyEntry.findMany(byPosition),
      client.brand.findMany(byPosition),
      client.range.findMany(byPosition),
      client.paint.findMany(byPosition),
      client.paintKey.findMany(byPosition),
      client.rejectedColor.findMany(byPosition),
      client.tombstone.findMany(byPosition),
    ]);
    return draftFiles({
      sources,
      downloads,
      rows,
      equivalences,
      replacements,
      reasons,
      ignoredGroups,
      ignoredKeys,
      colorPolicy,
      brands,
      ranges,
      paints,
      paintKeys,
      rejectedColors,
      tombstones,
    });
  }

  /**
   * Replaces the whole draft with validated curated data, in one
   * transaction: the load from `data/` (ADR-0043).
   */
  async replace(curated: Curated, tombstones: Tombstones): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await clear(tx);
        await write(tx, curated, tombstones);
      },
      { timeout: WHOLE_DRAFT_TIMEOUT_MS },
    );
  }
}

/** Deletes every row of the draft, what points to something first. */
async function clear(tx: Prisma.TransactionClient): Promise<void> {
  await tx.tombstone.deleteMany();
  await tx.rejectedColor.deleteMany();
  await tx.paintKey.deleteMany();
  await tx.paint.deleteMany();
  await tx.range.deleteMany();
  await tx.brand.deleteMany();
  await tx.colorPolicyEntry.deleteMany();
  await tx.ignoredKey.deleteMany();
  await tx.ignoredGroup.deleteMany();
  await tx.sourceReplacement.deleteMany();
  await tx.sourceEquivalence.deleteMany();
  await tx.sourceRow.deleteMany();
  await tx.sourceDownload.deleteMany();
  await tx.source.deleteMany();
  await tx.ignoreReason.deleteMany();
}

/**
 * Rows per insert. PostgreSQL takes 32 767 parameters per statement at most;
 * above that, Prisma splits an insert and sends the parts at once over the
 * same connection of the transaction, which `pg` deprecates. With 1000 rows
 * and at most 18 columns, every insert stays below the limit.
 */
const BATCH_ROWS = 1000;

/** Writes the rows in batches, one after another, and returns what each one gives. */
async function inBatches<T, R>(
  rows: readonly T[],
  write: (batch: T[]) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < rows.length; i += BATCH_ROWS) {
    results.push(await write(rows.slice(i, i + BATCH_ROWS)));
  }
  return results;
}

/** The internal IDs of rows just written, by one of their columns. */
const idsBy = <T extends { readonly id: bigint }>(
  batches: readonly (readonly T[])[],
  key: (row: T) => string,
): Ids => new Map(batches.flat().map((row) => [key(row), row.id]));

const byCatalogId = (row: { readonly catalogId: string }) => row.catalogId;

/** Writes the curated data, what is pointed to first. */
async function write(
  tx: Prisma.TransactionClient,
  curated: Curated,
  tombstones: Tombstones,
): Promise<void> {
  const roots = rootRecords(curated);
  const ids = {
    reasons: idsBy(
      await inBatches(roots.reasons, (data) =>
        tx.ignoreReason.createManyAndReturn({ data }),
      ),
      (reason) => reason.slug,
    ),
    sources: idsBy(
      await inBatches(roots.sources, (data) =>
        tx.source.createManyAndReturn({ data }),
      ),
      byCatalogId,
    ),
    brands: idsBy(
      await inBatches(roots.brands, (data) =>
        tx.brand.createManyAndReturn({ data }),
      ),
      byCatalogId,
    ),
  };

  const parts = sourceAndRangeRecords(curated, ids);
  await inBatches(parts.downloads, (data) =>
    tx.sourceDownload.createMany({ data }),
  );
  await inBatches(parts.rows, (data) => tx.sourceRow.createMany({ data }));
  await inBatches(parts.equivalences, (data) =>
    tx.sourceEquivalence.createMany({ data }),
  );
  await inBatches(parts.replacements, (data) =>
    tx.sourceReplacement.createMany({ data }),
  );
  await inBatches(parts.ignoredGroups, (data) =>
    tx.ignoredGroup.createMany({ data }),
  );
  await inBatches(parts.ignoredKeys, (data) =>
    tx.ignoredKey.createMany({ data }),
  );
  await inBatches(parts.colorPolicy, (data) =>
    tx.colorPolicyEntry.createMany({ data }),
  );
  const ranges = idsBy(
    await inBatches(parts.ranges, (data) =>
      tx.range.createManyAndReturn({ data }),
    ),
    byCatalogId,
  );

  const paints = idsBy(
    await inBatches(paintRecords(curated, { ...ids, ranges }), (data) =>
      tx.paint.createManyAndReturn({ data }),
    ),
    byCatalogId,
  );

  const paintParts = paintPartRecords(curated, tombstones, { ...ids, paints });
  await inBatches(paintParts.paintKeys, (data) =>
    tx.paintKey.createMany({ data }),
  );
  await inBatches(paintParts.rejectedColors, (data) =>
    tx.rejectedColor.createMany({ data }),
  );
  await inBatches(paintParts.tombstones, (data) =>
    tx.tombstone.createMany({ data }),
  );
}
