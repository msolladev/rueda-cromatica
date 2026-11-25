# shellcheck shell=bash
# How the scripts of the machine run compose.yaml (docs/08): always the same
# project, with the variables of the machine of /etc/colorwheel/colorwheel.env
# (docs/08 §7), which the CI does not have. The CI adds the files of
# COLORWHEEL_COMPOSE_FILES, separated by `:`, such as ci/compose.yaml, which
# keeps the backups in a local volume instead of the NAS. Sourced.

colorwheel_config="${COLORWHEEL_CONFIG:-/etc/colorwheel/colorwheel.env}"

compose() {
  local options=(--project-name colorwheel --file "$(dirname "${BASH_SOURCE[0]}")/compose.yaml")
  local file
  for file in ${COLORWHEEL_COMPOSE_FILES//:/ }; do options+=(--file "$file"); done
  [[ -f "$colorwheel_config" ]] && options+=(--env-file "$colorwheel_config")
  docker compose "${options[@]}" "$@"
}
