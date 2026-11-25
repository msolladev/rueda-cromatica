# shellcheck shell=bash
# What the backup scripts share: restic in its container (compose.yaml),
# with the repository of the NAS. Sourced after ../compose.sh, with
# `environment` set.

# The name of the dump in the repository, and the host of its backups, for
# the callers too.
# shellcheck disable=SC2034
DUMP=chromatic_wheel.dump
# shellcheck disable=SC2154
HOST_NAME="colorwheel-${environment:?}"

restic() {
  compose --profile backup run --rm --no-deps -T backup "$@"
}

# ensure_repository: creates the repository the first time. restic answers
# 10 when there is none; any other failure, such as a wrong password, stops.
ensure_repository() {
  local status=0
  restic cat config >/dev/null || status=$?
  if [[ "$status" -eq 10 ]]; then
    restic init
  elif [[ "$status" -ne 0 ]]; then
    echo "::error::The backup repository cannot be read."
    return 1
  fi
}

# latest_backup_age: the seconds since the latest backup, empty if none.
latest_backup_age() {
  local time
  time="$(restic snapshots --host "$HOST_NAME" --latest 1 --json |
    grep -oE '"time":"[^"]+"' | head -n 1 | cut -d '"' -f 4)"
  [[ -z "$time" ]] && return 0
  echo $(($(date +%s) - $(date --date "$time" +%s)))
}
