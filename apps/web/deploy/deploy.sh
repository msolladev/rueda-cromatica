#!/usr/bin/env bash
# Deploys a built web to an environment (docs/08), on its own machine:
#   1. builds the image of this version;
#   2. runs it next to the live one and checks it, without traffic;
#   3. replaces the live one and checks it again through the public domain;
#   4. if that fails, goes back to the previous image;
#   5. keeps only the last images.
# It prints nothing about the machine or the network.
#
# Usage: deploy.sh <environment> <site-dir> <reference-dir> <version> <public-url>
set -euo pipefail

usage="usage: deploy.sh <environment> <site-dir> <reference-dir> <version> <public-url>"
environment="${1:?$usage}"
site="${2:?$usage}"
reference="${3:?$usage}"
version="${4:?$usage}"
public_url="${5:?$usage}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
image="colorwheel-web"
live="colorwheel-web"
candidate="colorwheel-web-candidate"
# The proxy forwards to the live port; the candidate only listens locally.
live_port=8080
candidate_port=8081
keep=5

# run <name> <publish> <image>: a hardened container: read-only, without
# capabilities and unable to gain privileges. Nginx only writes to /tmp.
run() {
  docker run --detach --name "$1" --publish "$2" \
    --read-only --tmpfs /tmp \
    --cap-drop ALL --security-opt no-new-privileges \
    --log-opt max-size=10m --log-opt max-file=3 \
    "${@:4}" "$3" >/dev/null
}

# ready <url>: waits up to 15 s for the server to answer.
ready() {
  for _ in $(seq 30); do
    curl --silent --output /dev/null --max-time 2 "$1" && return 0
    sleep 0.5
  done
  return 1
}

echo "::group::Build $image:$version"
docker build --tag "$image:$version" \
  --label "org.opencontainers.image.revision=$version" \
  --build-arg ENVIRONMENT="$environment" \
  --build-context site="$site" --build-context reference="$reference" "$here"
echo "::endgroup::"

echo "::group::Check the new version, without traffic"
docker rm --force "$candidate" >/dev/null 2>&1 || true
run "$candidate" "127.0.0.1:$candidate_port:8080" "$image:$version"
if ! ready "http://127.0.0.1:$candidate_port/" ||
  ! "$here/smoke-check.sh" "http://127.0.0.1:$candidate_port" "$environment"; then
  docker rm --force "$candidate" >/dev/null
  echo "::error::The new version failed its checks. The live one is untouched."
  exit 1
fi
docker rm --force "$candidate" >/dev/null
echo "::endgroup::"

echo "::group::Replace the live version"
previous="$(docker inspect --format '{{.Config.Image}}' "$live" 2>/dev/null || true)"
docker rm --force "$live" >/dev/null 2>&1 || true
run "$live" "$live_port:8080" "$image:$version" --restart unless-stopped
echo "::endgroup::"

echo "::group::Check it through the public domain"
if ! ready "http://127.0.0.1:$live_port/" || ! "$here/smoke-check.sh" "$public_url" "$environment"; then
  docker rm --force "$live" >/dev/null 2>&1 || true
  if [[ -n "$previous" ]]; then
    run "$live" "$live_port:8080" "$previous" --restart unless-stopped
    echo "::error::The new version failed through the public domain. Back to the previous one."
  else
    echo "::error::The new version failed through the public domain, and there is no previous one."
  fi
  exit 1
fi
echo "::endgroup::"

echo "::group::Keep the last $keep images"
# Newest first; the live one is never removed.
docker image ls "$image" --format '{{.Repository}}:{{.Tag}}' |
  tail -n "+$((keep + 1))" |
  while read -r old; do
    [[ "$old" == "$image:$version" ]] || docker image rm "$old" >/dev/null || true
  done
docker image prune --force >/dev/null
docker builder prune --force >/dev/null
echo "::endgroup::"

echo "Deployed $version"
