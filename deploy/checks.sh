# shellcheck shell=bash
# What the server checks share (apps/web/deploy/smoke-check.sh and
# apps/api/deploy/smoke-check.sh): one request at a time and its result.
# They print only paths and results, never internal addresses. Sourced, with
# `base` set to the base URL.

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

# fetch <path> [curl options]: the status, the headers and the body of a
# single request, without following redirects. `status` is for the caller.
# shellcheck disable=SC2034,SC2154
fetch() {
  local path="$1"
  shift
  status="$(curl --silent --show-error --max-time 10 \
    --dump-header "$work/headers" --output "$work/body" \
    --write-out '%{http_code}' "$@" "$base$path")" || status="000"
}

# header <name>: the value of a response header, empty if missing.
header() {
  grep -i "^$1:" "$work/headers" | head -n 1 | cut -d ' ' -f 2- | tr -d '\r' || true
}

pass() { printf 'ok    %s\n' "$1"; }
fail() {
  printf 'FAIL  %s: %s\n' "$1" "$2"
  failures=$((failures + 1))
}

# finish: the result of every check, as the exit status.
finish() {
  if [[ "$failures" -gt 0 ]]; then
    printf '%d check(s) failed\n' "$failures"
    exit 1
  fi
  printf 'All checks passed\n'
}
