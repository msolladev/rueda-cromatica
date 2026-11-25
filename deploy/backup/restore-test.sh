#!/usr/bin/env bash
# The monthly restore test of the environment's backups (docs/08 §8):
#   1. reads and verifies every byte of the restic repository;
#   2. restores the latest backup into a temporary PostgreSQL;
#   3. checks it with the live API's image (verify-restore): its latest
#      publication is the same as in the live database, and its draft
#      generates a catalog that can be published.
# The backup workflow runs it on the environment's machine. It prints
# nothing about the machine or the network.
#
# Usage: restore-test.sh <environment>
set -euo pipefail

environment="${1:?usage: restore-test.sh <environment>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=SCRIPTDIR/../compose.sh
source "$here/../compose.sh"
# shellcheck source=SCRIPTDIR/restic.sh
source "$here/restic.sh"
work="$(mktemp -d)"
trap 'compose --profile restore rm --force --stop restore-postgres >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

# The checks run with the image of the live API.
image="$(compose ps --format '{{.Image}}' api | head -n 1)"
if [[ "$image" != *:* ]]; then
  echo "::error::The API is not running."
  exit 1
fi
export VERSION="${image##*:}"

echo "::group::Verify the repository"
restic check --read-data
echo "::endgroup::"

echo "::group::Restore the latest backup"
restic dump --host "$HOST_NAME" latest "/$DUMP" >"$work/$DUMP"
compose --profile restore up --detach --wait --no-deps restore-postgres
compose --profile restore exec -T restore-postgres \
  pg_restore --username chromatic_wheel --dbname chromatic_wheel \
  --no-owner --exit-on-error <"$work/$DUMP"
echo "::endgroup::"

echo "::group::Check what was restored"
url="postgresql://chromatic_wheel@%s:5432/chromatic_wheel"
# shellcheck disable=SC2059
compose run --rm --no-deps \
  --env DATABASE_URL="$(printf "$url" restore-postgres)" \
  --env LIVE_DATABASE_URL="$(printf "$url" postgres)" \
  api node dist/cli/verify-restore.js
echo "::endgroup::"

echo "Restore test of $environment passed"
