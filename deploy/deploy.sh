#!/usr/bin/env bash
# Deploys a version of the web and the API, built and tested by the CI, to
# the machine of an environment (docs/08 §2), with Docker Compose
# (compose.yaml):
#   1. builds the images of this version, from what the CI built;
#   2. starts PostgreSQL, if it is not running or its image changed;
#   3. applies the migrations, which also work with the live API;
#   4. loads the catalog pack into the database;
#   5. runs the new web and API next to the live ones and checks them,
#      without traffic;
#   6. replaces the live ones and checks them again through the public
#      domain; if that fails, both go back to their previous version;
#   7. keeps only the last images.
# The web and the API always go and come back together: only the pair that
# the CI tested together is served. The database never goes back.
# It prints nothing about the machine or the network.
#
# Usage: deploy.sh <environment> <site-dir> <reference-dir> <api-pack> <catalog-pack> <version> <public-url>
set -euo pipefail

usage="usage: deploy.sh <environment> <site-dir> <reference-dir> <api-pack> <catalog-pack> <version> <public-url>"
environment="${1:?$usage}"
site="${2:?$usage}"
reference="${3:?$usage}"
api_pack="$(realpath "${4:?$usage}")"
catalog_pack="$(realpath "${5:?$usage}")"
version="${6:?$usage}"
public_url="${7:?$usage}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
web_host="${public_url#*://}"
web_host="${web_host%%/*}"
web_host="${web_host%%:*}"
# Nginx Proxy Manager forwards to the live web; the candidate only listens
# locally (compose.yaml).
live_port=8080
candidate_port=8081
keep=5
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

export VERSION="$version" REFERENCE_HOSTS="$web_host"
# shellcheck source=SCRIPTDIR/compose.sh
source "$here/compose.sh"

# ready <url>: waits up to 15 s for the server to answer.
ready() {
  for _ in $(seq 30); do
    curl --silent --output /dev/null --max-time 2 "$1" && return 0
    sleep 0.5
  done
  return 1
}

# checks <base-url> [--local]: the web's and the API's.
checks() {
  "$root/apps/web/deploy/smoke-check.sh" "$1" "$environment" &&
    "$root/apps/api/deploy/smoke-check.sh" "$1" "$web_host" "${@:2}"
}

# live_version <service>: the version that the service serves, empty if none.
live_version() {
  local image
  image="$(compose ps --all --format '{{.Image}}' "$1" 2>/dev/null | head -n 1)"
  [[ "$image" == *:* ]] && echo "${image##*:}"
}

echo "::group::Build the images of $version"
docker build --tag "colorwheel-web:$version" \
  --label "org.opencontainers.image.revision=$version" \
  --build-arg ENVIRONMENT="$environment" \
  --build-context site="$site" --build-context reference="$reference" \
  "$root/apps/web/deploy"
mkdir "$work/api"
tar --extract --file "$api_pack" --directory "$work/api"
docker build --tag "colorwheel-api:$version" \
  --label "org.opencontainers.image.revision=$version" \
  --build-context api="$work/api" "$root/apps/api/deploy"
echo "::endgroup::"

echo "::group::Start PostgreSQL"
previous_postgres="$(compose ps --all --format '{{.Image}}' postgres 2>/dev/null | head -n 1 || true)"
if ! compose up --detach --wait --no-deps postgres; then
  # Only a new image fails here: its data are those of the previous one.
  if [[ -n "$previous_postgres" ]]; then
    printf 'services:\n  postgres:\n    image: %s\n' "$previous_postgres" >"$work/previous-postgres.yaml"
    compose --file "$work/previous-postgres.yaml" up --detach --wait --no-deps postgres || true
    echo "::error::The new PostgreSQL did not start. Back to the previous one; nothing else changed."
  else
    echo "::error::PostgreSQL did not start."
  fi
  exit 1
fi
echo "::endgroup::"

echo "::group::Apply the migrations"
if ! compose run --rm --no-deps api node_modules/.bin/prisma migrate deploy; then
  echo "::error::The migrations failed. The live version is untouched; a failed migration is resolved by hand (docs/08 §6)."
  exit 1
fi
echo "::endgroup::"

echo "::group::Load the catalog"
if ! compose run --rm --no-deps --volume "$catalog_pack:/pack/catalog-pack.json:ro" \
  api node dist/cli/load-catalog.js --from /pack/catalog-pack.json; then
  echo "::error::The catalog did not load. The live version is untouched, and so is the draft."
  exit 1
fi
echo "::endgroup::"

echo "::group::Check the new version, without traffic"
candidates=(api-candidate web-candidate)
compose --profile candidate rm --force --stop "${candidates[@]}" >/dev/null 2>&1 || true
if ! compose --profile candidate up --detach --wait --no-deps "${candidates[@]}" ||
  ! ready "http://127.0.0.1:$candidate_port/" ||
  ! checks "http://127.0.0.1:$candidate_port" --local; then
  compose --profile candidate rm --force --stop "${candidates[@]}" >/dev/null
  echo "::error::The new version failed its checks. The live one is untouched."
  exit 1
fi
compose --profile candidate rm --force --stop "${candidates[@]}" >/dev/null
echo "::endgroup::"

echo "::group::Replace the live version"
previous="$(live_version web || true)"
# The web of the deploys before Docker Compose, which held the port.
legacy="$(docker inspect --format '{{.Config.Image}}' colorwheel-web 2>/dev/null || true)"
if [[ -n "$legacy" ]]; then
  previous="${legacy##*:}"
  docker rm --force colorwheel-web >/dev/null
fi
replaced=true
compose up --detach --wait --no-deps api web || replaced=false
echo "::endgroup::"

echo "::group::Check it through the public domain"
if [[ "$replaced" != true ]] || ! ready "http://127.0.0.1:$live_port/" || ! checks "$public_url"; then
  if [[ -n "$previous" ]]; then
    if docker image inspect "colorwheel-api:$previous" >/dev/null 2>&1; then
      VERSION="$previous" compose up --detach --no-deps api web
    else
      # A version from before the API: only its web.
      compose rm --force --stop api >/dev/null
      VERSION="$previous" compose up --detach --no-deps web
    fi
    echo "::error::The new version failed through the public domain. Back to the previous one."
  else
    echo "::error::The new version failed through the public domain, and there is no previous one."
  fi
  exit 1
fi
echo "::endgroup::"

echo "::group::Keep the last $keep images"
# Newest first; the live ones are never removed.
for image in colorwheel-web colorwheel-api; do
  docker image ls "$image" --format '{{.Repository}}:{{.Tag}}' |
    tail -n "+$((keep + 1))" |
    while read -r old; do
      [[ "$old" == "$image:$version" ]] || docker image rm "$old" >/dev/null || true
    done
done
docker image prune --force >/dev/null
docker builder prune --force >/dev/null
echo "::endgroup::"

echo "Deployed $version"
