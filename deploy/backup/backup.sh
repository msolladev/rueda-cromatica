#!/usr/bin/env bash
# The daily backup of the environment's database (docs/08 §8, ADR-0040):
#   1. checks that the previous backup is at most 26 hours old: a night that
#      did not run fails the next one, so that GitHub warns;
#   2. dumps PostgreSQL with `pg_dump`, to a file, so that a failed dump never
#      becomes a backup;
#   3. stores it, encrypted, in the restic repository of the NAS;
#   4. keeps 7 daily and 4 weekly backups, and checks the repository.
# The backup workflow runs it on the environment's machine. It prints
# nothing about the machine or the network.
#
# Usage: backup.sh <environment>
set -euo pipefail

environment="${1:?usage: backup.sh <environment>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=SCRIPTDIR/../compose.sh
source "$here/../compose.sh"
# shellcheck source=SCRIPTDIR/restic.sh
source "$here/restic.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

ensure_repository

echo "::group::The previous backup"
missed=""
last="$(latest_backup_age)"
if [[ -z "$last" ]]; then
  echo "There is no previous backup."
elif [[ "$last" -gt $((26 * 3600)) ]]; then
  missed="The previous backup is $((last / 3600)) hours old: one did not run."
  echo "$missed"
else
  echo "The previous backup is $((last / 3600)) hours old."
fi
echo "::endgroup::"

echo "::group::Dump and store"
compose exec -T postgres \
  pg_dump --username chromatic_wheel --format custom chromatic_wheel >"$work/$DUMP"
restic backup --host "$HOST_NAME" --tag daily --stdin --stdin-filename "$DUMP" <"$work/$DUMP"
echo "::endgroup::"

echo "::group::Keep 7 daily and 4 weekly, and check"
restic forget --host "$HOST_NAME" --keep-daily 7 --keep-weekly 4 --prune
restic check
echo "::endgroup::"

if [[ -n "$missed" ]]; then
  echo "::error::$missed Today's was made."
  exit 1
fi
echo "Backup of $environment stored"
