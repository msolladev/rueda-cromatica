#!/usr/bin/env bash
# Checks that a server of the built web answers as docs/07 §12 and docs/08
# require. It prints only paths and results, never internal addresses.
#
# Usage: smoke-check.sh <base-url>
set -euo pipefail

base="${1:?usage: smoke-check.sh <base-url>}"
base="${base%/}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

# fetch <path>: the status, the headers and the body of a single request,
# without following redirects.
fetch() {
  status="$(curl --silent --show-error --max-time 10 \
    --dump-header "$work/headers" --output "$work/body" \
    --write-out '%{http_code}' "$base$1")" || status="000"
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

# expect <path> <status> [lang]: the status and, for a page, its language.
expect() {
  fetch "$1"
  if [[ "$status" != "$2" ]]; then
    fail "$1" "status $status, expected $2"
    return
  fi
  if [[ $# -ge 3 ]] && ! grep -q "<html lang=\"$3\"" "$work/body"; then
    fail "$1" "not the page in \"$3\""
    return
  fi
  if [[ "$(header X-Robots-Tag)" != "noindex" ]]; then
    fail "$1" "without X-Robots-Tag: noindex"
    return
  fi
  pass "$1 → $2${3:+ ($3)}"
}

# expect_redirect <path> <location>: a permanent redirect.
expect_redirect() {
  fetch "$1"
  if [[ "$status" != "301" || "$(header Location)" != "$2" ]]; then
    fail "$1" "status $status to \"$(header Location)\", expected 301 to \"$2\""
    return
  fi
  pass "$1 → 301 $2"
}

# expect_cache <path> <cache-control>
expect_cache() {
  fetch "$1"
  if [[ "$status" != "200" || "$(header Cache-Control)" != "$2" ]]; then
    fail "$1" "status $status with Cache-Control \"$(header Cache-Control)\", expected 200 with \"$2\""
    return
  fi
  pass "$1 → Cache-Control: $2"
}

# Pages, with and without the final `/`, and without redirecting.
expect / 200 en
expect /es/ 200 es
expect /es 200 es
expect /en/credits/ 200 en
expect /en/credits 200 en

# The file name is not an address.
expect_redirect /index.html /
expect_redirect /es/index.html /es/
expect_redirect /en/credits/index.html /en/credits/

# «Page not found», in the address's language, with the status 404.
expect /es/does-not-exist 404 es
expect /es/does-not-exist/ 404 es
expect /does-not-exist 404 en
expect /es/404.html 404 es
expect /assets/ 404 en

# Revalidated always, so that each new version reaches the browser.
expect_cache /sw.js no-cache
expect_cache /catalog.json no-cache
expect_cache /es/ no-cache

# Hashed assets, cached for a year.
fetch /es/
asset="$(grep -o '/assets/[^"]*\.js' "$work/body" 2>/dev/null | head -n 1 || true)"
if [[ -z "$asset" ]]; then
  fail /es/ "no hashed script found"
else
  expect_cache "$asset" "public, max-age=31536000, immutable"
fi

# Every address the service worker precaches answers 200, and none is a file
# name: if one fails, the service worker does not install and the web does
# not work offline.
fetch /sw.js
mapfile -t precached < <(grep -oE '"url":"[^"]*"' "$work/body" | cut -d '"' -f 4 | sort -u)
if [[ "${#precached[@]}" -eq 0 ]]; then
  fail /sw.js "no precached addresses found"
else
  broken=0
  for url in "${precached[@]}"; do
    path="/${url#./}"
    if [[ "$path" == *.html ]]; then
      fail "$path" "precached by its file name"
      broken=$((broken + 1))
      continue
    fi
    fetch "$path"
    if [[ "$status" != "200" ]]; then
      fail "$path" "precached, but status $status"
      broken=$((broken + 1))
    fi
  done
  if [[ "$broken" -eq 0 ]]; then
    pass "/sw.js → ${#precached[@]} precached addresses, all 200"
  fi
fi

if [[ "$failures" -gt 0 ]]; then
  printf '%d check(s) failed\n' "$failures"
  exit 1
fi
printf 'All checks passed\n'
