-- CreateTable
CREATE TABLE "sources" (
    "id" BIGSERIAL NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "url" TEXT,
    "archive_url" TEXT,
    "retrieved_at" DATE NOT NULL,
    "license" TEXT NOT NULL,
    "attribution" TEXT,
    "disabled_note" TEXT,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_files" (
    "id" BIGSERIAL NOT NULL,
    "source_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,

    CONSTRAINT "source_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_rows" (
    "id" BIGSERIAL NOT NULL,
    "source_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "hex" TEXT,
    "gradient_dark" TEXT,
    "gradient_light" TEXT,
    "measured_hex" TEXT,
    "finish" TEXT,
    "colourless" BOOLEAN NOT NULL,

    CONSTRAINT "source_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_equivalences" (
    "id" BIGSERIAL NOT NULL,
    "source_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "from_key" TEXT NOT NULL,
    "to_key" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "source_equivalences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_replacements" (
    "id" BIGSERIAL NOT NULL,
    "source_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "from_key" TEXT NOT NULL,
    "to_key" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "source_replacements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ignore_reasons" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "ignore_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ignored_groups" (
    "id" BIGSERIAL NOT NULL,
    "source_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "group" TEXT NOT NULL,
    "reason_id" BIGINT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ignored_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ignored_keys" (
    "id" BIGSERIAL NOT NULL,
    "source_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "reason_id" BIGINT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ignored_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "color_policy" (
    "id" BIGSERIAL NOT NULL,
    "origin" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "source_id" BIGINT NOT NULL,

    CONSTRAINT "color_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" BIGSERIAL NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranges" (
    "id" BIGSERIAL NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "brand_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paints" (
    "id" BIGSERIAL NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "brand_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "range_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "manufacturer_code" TEXT,
    "type" TEXT NOT NULL,
    "metallic" BOOLEAN NOT NULL,
    "status_kind" TEXT NOT NULL,
    "replacement_choice_source_id" BIGINT,
    "replacement_choice_note" TEXT,
    "color_choice_source_id" BIGINT,
    "color_choice_origin" TEXT,
    "color_choice_hex" TEXT,
    "color_choice_note" TEXT,
    "note" TEXT,

    CONSTRAINT "paints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paint_keys" (
    "id" BIGSERIAL NOT NULL,
    "paint_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "source_id" BIGINT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "paint_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rejected_colors" (
    "id" BIGSERIAL NOT NULL,
    "paint_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "source_id" BIGINT NOT NULL,
    "origin" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "reason_id" BIGINT NOT NULL,
    "note" TEXT,

    CONSTRAINT "rejected_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tombstones" (
    "id" BIGSERIAL NOT NULL,
    "collection" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "remaining_paint_id" BIGINT,

    CONSTRAINT "tombstones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "release_tag" TEXT,
    "draft" JSONB,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_catalogs" (
    "id" BIGSERIAL NOT NULL,
    "publication_id" BIGINT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "data_version" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "publication_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_catalog_id_key" ON "sources"("catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "sources_position_key" ON "sources"("position");

-- CreateIndex
CREATE UNIQUE INDEX "source_files_source_id_position_key" ON "source_files"("source_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "source_files_source_id_name_key" ON "source_files"("source_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "source_rows_source_id_key_key" ON "source_rows"("source_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "source_rows_source_id_position_key" ON "source_rows"("source_id", "position");

-- CreateIndex
CREATE INDEX "source_equivalences_source_id_to_key_idx" ON "source_equivalences"("source_id", "to_key");

-- CreateIndex
CREATE UNIQUE INDEX "source_equivalences_source_id_position_key" ON "source_equivalences"("source_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "source_equivalences_source_id_from_key_to_key_key" ON "source_equivalences"("source_id", "from_key", "to_key");

-- CreateIndex
CREATE INDEX "source_replacements_source_id_to_key_idx" ON "source_replacements"("source_id", "to_key");

-- CreateIndex
CREATE UNIQUE INDEX "source_replacements_source_id_position_key" ON "source_replacements"("source_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "source_replacements_source_id_from_key_to_key_key" ON "source_replacements"("source_id", "from_key", "to_key");

-- CreateIndex
CREATE UNIQUE INDEX "ignore_reasons_slug_key" ON "ignore_reasons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ignore_reasons_position_key" ON "ignore_reasons"("position");

-- CreateIndex
CREATE INDEX "ignored_groups_reason_id_idx" ON "ignored_groups"("reason_id");

-- CreateIndex
CREATE UNIQUE INDEX "ignored_groups_source_id_group_key" ON "ignored_groups"("source_id", "group");

-- CreateIndex
CREATE UNIQUE INDEX "ignored_groups_source_id_position_key" ON "ignored_groups"("source_id", "position");

-- CreateIndex
CREATE INDEX "ignored_keys_reason_id_idx" ON "ignored_keys"("reason_id");

-- CreateIndex
CREATE UNIQUE INDEX "ignored_keys_source_id_key_key" ON "ignored_keys"("source_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ignored_keys_source_id_position_key" ON "ignored_keys"("source_id", "position");

-- CreateIndex
CREATE INDEX "color_policy_source_id_idx" ON "color_policy"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "color_policy_origin_source_id_key" ON "color_policy"("origin", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "color_policy_origin_position_key" ON "color_policy"("origin", "position");

-- CreateIndex
CREATE UNIQUE INDEX "brands_catalog_id_key" ON "brands"("catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_position_key" ON "brands"("position");

-- CreateIndex
CREATE UNIQUE INDEX "ranges_catalog_id_key" ON "ranges"("catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranges_brand_id_position_key" ON "ranges"("brand_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "paints_catalog_id_key" ON "paints"("catalog_id");

-- CreateIndex
CREATE INDEX "paints_range_id_idx" ON "paints"("range_id");

-- CreateIndex
CREATE INDEX "paints_replacement_choice_source_id_idx" ON "paints"("replacement_choice_source_id");

-- CreateIndex
CREATE INDEX "paints_color_choice_source_id_idx" ON "paints"("color_choice_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "paints_brand_id_position_key" ON "paints"("brand_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "paint_keys_paint_id_position_key" ON "paint_keys"("paint_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "paint_keys_paint_id_source_id_key" ON "paint_keys"("paint_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "paint_keys_source_id_key_key" ON "paint_keys"("source_id", "key");

-- CreateIndex
CREATE INDEX "rejected_colors_source_id_idx" ON "rejected_colors"("source_id");

-- CreateIndex
CREATE INDEX "rejected_colors_reason_id_idx" ON "rejected_colors"("reason_id");

-- CreateIndex
CREATE UNIQUE INDEX "rejected_colors_paint_id_position_key" ON "rejected_colors"("paint_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "rejected_colors_paint_id_source_id_origin_key" ON "rejected_colors"("paint_id", "source_id", "origin");

-- CreateIndex
CREATE INDEX "tombstones_remaining_paint_id_idx" ON "tombstones"("remaining_paint_id");

-- CreateIndex
CREATE UNIQUE INDEX "tombstones_collection_catalog_id_key" ON "tombstones"("collection", "catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "tombstones_collection_position_key" ON "tombstones"("collection", "position");

-- CreateIndex
CREATE UNIQUE INDEX "publications_uuid_key" ON "publications"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "publication_catalogs_publication_id_schema_version_key" ON "publication_catalogs"("publication_id", "schema_version");

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_rows" ADD CONSTRAINT "source_rows_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_equivalences" ADD CONSTRAINT "source_equivalences_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_equivalences" ADD CONSTRAINT "source_equivalences_source_id_from_key_fkey" FOREIGN KEY ("source_id", "from_key") REFERENCES "source_rows"("source_id", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_equivalences" ADD CONSTRAINT "source_equivalences_source_id_to_key_fkey" FOREIGN KEY ("source_id", "to_key") REFERENCES "source_rows"("source_id", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_replacements" ADD CONSTRAINT "source_replacements_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_replacements" ADD CONSTRAINT "source_replacements_source_id_from_key_fkey" FOREIGN KEY ("source_id", "from_key") REFERENCES "source_rows"("source_id", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_replacements" ADD CONSTRAINT "source_replacements_source_id_to_key_fkey" FOREIGN KEY ("source_id", "to_key") REFERENCES "source_rows"("source_id", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignored_groups" ADD CONSTRAINT "ignored_groups_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignored_groups" ADD CONSTRAINT "ignored_groups_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "ignore_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignored_keys" ADD CONSTRAINT "ignored_keys_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignored_keys" ADD CONSTRAINT "ignored_keys_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "ignore_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "color_policy" ADD CONSTRAINT "color_policy_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranges" ADD CONSTRAINT "ranges_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paints" ADD CONSTRAINT "paints_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paints" ADD CONSTRAINT "paints_range_id_fkey" FOREIGN KEY ("range_id") REFERENCES "ranges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paints" ADD CONSTRAINT "paints_replacement_choice_source_id_fkey" FOREIGN KEY ("replacement_choice_source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paints" ADD CONSTRAINT "paints_color_choice_source_id_fkey" FOREIGN KEY ("color_choice_source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paint_keys" ADD CONSTRAINT "paint_keys_paint_id_fkey" FOREIGN KEY ("paint_id") REFERENCES "paints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paint_keys" ADD CONSTRAINT "paint_keys_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejected_colors" ADD CONSTRAINT "rejected_colors_paint_id_fkey" FOREIGN KEY ("paint_id") REFERENCES "paints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejected_colors" ADD CONSTRAINT "rejected_colors_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejected_colors" ADD CONSTRAINT "rejected_colors_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "ignore_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tombstones" ADD CONSTRAINT "tombstones_remaining_paint_id_fkey" FOREIGN KEY ("remaining_paint_id") REFERENCES "paints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_catalogs" ADD CONSTRAINT "publication_catalogs_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
