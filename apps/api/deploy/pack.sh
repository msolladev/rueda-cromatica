#!/usr/bin/env bash
# Packs the built API for its image (docs/08): its `dist`, its migrations and
# only its production dependencies, with the layout of the monorepo. The
# packages of the monorepo it uses (domain, catalog-builder) are TypeScript,
# which Node only runs outside `node_modules`, so they stay in `packages/`,
# linked as in development, instead of copied into `node_modules` as
# `pnpm deploy` would. A tar, because the artifacts of GitHub do not keep
# links. Run it from the root of the repository, after `pnpm build`.
#
# Usage: pack.sh <out.tar>
set -euo pipefail

out="$(realpath -m "${1:?usage: pack.sh <out.tar>}")"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Every package.json of the workspace, for the lockfile to match, but only
# the files that the API runs.
cp package.json pnpm-workspace.yaml pnpm-lock.yaml "$work/"
for manifest in apps/*/package.json packages/*/package.json; do
  mkdir -p "$work/$(dirname "$manifest")"
  cp "$manifest" "$work/$manifest"
done
cp -r apps/api/dist apps/api/prisma apps/api/prisma.config.ts "$work/apps/api/"
cp -r packages/domain/src "$work/packages/domain/"
cp -r packages/catalog-builder/src "$work/packages/catalog-builder/"
# Prisma's configuration, which the migrations read, takes the URL of the
# database from this file of src/.
mkdir -p "$work/apps/api/src/core/config"
cp apps/api/src/core/config/database-url.ts "$work/apps/api/src/core/config/"

(cd "$work" && pnpm install --prod --frozen-lockfile --filter "@chromatic-wheel/api..." >/dev/null)
# The API's postinstall generates the Prisma client again, which dist/
# already has compiled.
rm -rf "$work/apps/api/src/generated"
find "$work" -name '*.test.ts' -delete
tar --create --file "$out" --directory "$work" --exclude=./pnpm-lock.yaml .
echo "API packed: $out ($(du -h "$out" | cut -f1))"
