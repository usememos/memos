#!/usr/bin/env bash

set -euo pipefail

# Application releases use YY.MM[.N][-rc.N]. Database migration sequences are separate.
parse_release_tag() {
  local tag="$1"
  if [[ ! "$tag" =~ ^([1-9][0-9]\.(0[1-9]|1[0-2]))(\.([1-9][0-9]*))?(-rc\.([1-9][0-9]*))?$ ]]; then
    return 1
  fi
  RELEASE_VERSION="$tag"
  RELEASE_SERIES="${BASH_REMATCH[1]}"
  RELEASE_IS_PRERELEASE=false
  if [[ -n "${BASH_REMATCH[5]}" ]]; then
    RELEASE_IS_PRERELEASE=true
  fi
}

# previous_release_tag prints the newest stable release tag that is an ancestor
# of HEAD, excluding tags on HEAD itself. Legacy v0.31.x tags count because
# v0.31.0 is the fixed upgrade baseline.
previous_release_tag() {
  local repo="$1" head_sha tag tag_sha
  head_sha="$(git -C "$repo" rev-parse HEAD)"
  # List calendar releases first: the legacy v prefix would otherwise sort ahead.
  while IFS= read -r tag; do
    if parse_release_tag "$tag"; then
      [[ "$RELEASE_IS_PRERELEASE" == false ]] || continue
    elif [[ ! "$tag" =~ ^v0\.31\.(0|[1-9][0-9]*)$ ]]; then
      continue
    fi
    tag_sha="$(git -C "$repo" rev-list -n 1 "$tag")"
    [[ "$tag_sha" != "$head_sha" ]] || continue
    if git -C "$repo" merge-base --is-ancestor "$tag" HEAD; then
      printf '%s\n' "$tag"
      return
    fi
  done < <(
    git -C "$repo" tag --list '[1-9][0-9].*' --sort=-version:refname
    git -C "$repo" tag --list 'v0.31.*' --sort=-version:refname
  )
  echo 'No supported previous release found' >&2
  return 1
}

previous_release_image() {
  local tag
  if ! tag="$(previous_release_tag "$1")"; then
    echo 'Pass --previous-image' >&2
    return 1
  fi
  printf 'neosmemo/memos:%s\n' "${tag#v}"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  case "${1:-}" in
    previous-tag)
      previous_release_tag "${2:?repository required}"
      exit
      ;;
    previous-image)
      previous_release_image "${2:?repository required}"
      exit
      ;;
  esac
  tag="${2:?release tag required}"
  if ! parse_release_tag "$tag"; then
    echo "Unsupported release tag format: $tag" >&2
    exit 1
  fi
  case "${1:-}" in
    version)
      printf 'tag=%s\nversion=%s\nseries=%s\nis_prerelease=%s\n' \
        "$tag" "$RELEASE_VERSION" "$RELEASE_SERIES" "$RELEASE_IS_PRERELEASE"
      ;;
    image-tags)
      printf '%s\n' "$RELEASE_VERSION"
      if [[ "$RELEASE_IS_PRERELEASE" == false ]]; then
        if [[ "$RELEASE_SERIES" != "$RELEASE_VERSION" ]]; then
          printf '%s\n' "$RELEASE_SERIES"
        fi
        printf 'stable\n'
      fi
      ;;
    *) echo "Unknown release command: ${1:-}" >&2; exit 1 ;;
  esac
fi
