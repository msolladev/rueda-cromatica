#!/usr/bin/env bash
# Checks that the API answers as docs/09 requires through the web's Nginx of
# an environment (docs/08): its health, the published catalog with its cache
# and its compression, and the reference only on the web's host. Through a
# local address (`--local`), the request carries the web's host, and it also
# checks that another host gets no reference and that the limit of requests
# answers 429, which through the public domain would limit the deploy itself.
# It prints only paths and results, never internal addresses.
#
# Usage: smoke-check.sh <base-url> <web-host> [--local]
set -euo pipefail

usage="usage: smoke-check.sh <base-url> <web-host> [--local]"
base="${1:?$usage}"
base="${base%/}"
web_host="${2:?$usage}"
local=false
case "${3:-}" in
  "") ;;
  --local) local=true ;;
  *)
    echo "$usage" >&2
    exit 2
    ;;
esac
# shellcheck source=SCRIPTDIR/../../../deploy/checks.sh
source "$(dirname "${BASH_SOURCE[0]}")/../../../deploy/checks.sh"

# get <path> [curl options]: a request as the web's host sends it.
get() {
  local path="$1"
  shift
  if [[ "$local" == true ]]; then
    fetch "$path" --header "Host: $web_host" "$@"
  else
    fetch "$path" "$@"
  fi
}

get /api/v1/health
if [[ "$status" != "200" ]] || ! grep -q '"status":"ok"' "$work/body"; then
  fail /api/v1/health "status $status, expected 200 with its database"
else
  pass "/api/v1/health → 200"
fi

# The published catalog, compressed, revalidated on each use and never
# indexed; 304 while it does not change.
catalog="/api/v1/catalog?schemaVersion=1"
get "$catalog" --header "Accept-Encoding: gzip"
etag="$(header ETag)"
if [[ "$status" != "200" ]]; then
  fail "$catalog" "status $status, expected 200"
elif [[ "$(header Content-Encoding)" != "gzip" ]]; then
  fail "$catalog" "Content-Encoding \"$(header Content-Encoding)\", expected \"gzip\""
elif [[ "$(header Cache-Control)" != "public, no-cache" || -z "$etag" ]]; then
  fail "$catalog" "Cache-Control \"$(header Cache-Control)\" and ETag \"$etag\", expected \"public, no-cache\" and one"
elif [[ "$(header X-Robots-Tag)" != "noindex" ]]; then
  fail "$catalog" "X-Robots-Tag \"$(header X-Robots-Tag)\", expected \"noindex\""
else
  pass "$catalog → 200, gzip, revalidated, noindex"
  get "$catalog" --header "Accept-Encoding: gzip" --header "If-None-Match: $etag"
  if [[ "$status" != "304" ]]; then
    fail "$catalog" "status $status with its ETag, expected 304"
  else
    pass "$catalog with its ETag → 304"
  fi
fi

# The reference, only on the web's host (docs/09 §5).
get /api/v1/reference
if [[ "$status" != "200" ]] || ! grep -q "<html" "$work/body"; then
  fail /api/v1/reference "status $status, expected 200"
else
  pass "/api/v1/reference → 200"
fi

if [[ "$local" == true ]]; then
  fetch /api/v1/reference --header "Host: another-host.invalid"
  if [[ "$status" != "404" ]]; then
    fail /api/v1/reference "status $status on another host, expected 404"
  else
    pass "/api/v1/reference on another host → 404"
  fi

  # The limit (docs/09 §2): a burst of more requests than it lets through.
  limited=0
  for _ in $(seq 40); do
    get /api/v1/health
    [[ "$status" == "429" ]] && limited=$((limited + 1))
  done
  if [[ "$limited" -eq 0 ]]; then
    fail /api/v1/health "40 requests at once, none limited with 429"
  else
    pass "/api/v1/health → 429 after a burst ($limited of 40)"
  fi
fi

finish
