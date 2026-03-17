#!/bin/sh

set -eu

REPO="${REPO:-usememos/memos}"
BIN_NAME="memos"
VERSION="${MEMOS_VERSION:-}"
INSTALL_DIR="${MEMOS_INSTALL_DIR:-}"
SKIP_CHECKSUM="${MEMOS_SKIP_CHECKSUM:-0}"

usage() {
  cat <<'EOF'
Install Memos from GitHub Releases.

Usage:
  install.sh [--version <version>] [--install-dir <dir>] [--skip-checksum]

Environment:
  MEMOS_VERSION         Version to install without the leading "v". Defaults to latest release.
  MEMOS_INSTALL_DIR     Directory to install the binary into.
  MEMOS_SKIP_CHECKSUM   Set to 1 to skip checksum verification.
  REPO                  GitHub repository in owner/name form. Defaults to usememos/memos.

Examples:
  curl -fsSL https://raw.githubusercontent.com/usememos/memos/main/scripts/install.sh | sh
  curl -fsSL https://raw.githubusercontent.com/usememos/memos/main/scripts/install.sh | sh -s -- --version 0.28.1
EOF
}

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

resolve_latest_version() {
  latest_url="$(curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/${REPO}/releases/latest")"
  latest_tag="${latest_url##*/}"
  [ -n "$latest_tag" ] || fail "failed to resolve latest release tag"
  printf '%s\n' "${latest_tag#v}"
}

detect_os() {
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  case "$os" in
    linux)
      printf 'linux\n'
      ;;
    darwin)
      printf 'darwin\n'
      ;;
    *)
      fail "unsupported operating system: $os"
      ;;
  esac
}

detect_arch() {
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64)
      printf 'amd64\n'
      ;;
    arm64|aarch64)
      printf 'arm64\n'
      ;;
    armv7l|armv7)
      printf 'armv7\n'
      ;;
    *)
      fail "unsupported architecture: $arch"
      ;;
  esac
}

resolve_install_dir() {
  if [ -n "$INSTALL_DIR" ]; then
    printf '%s\n' "$INSTALL_DIR"
    return
  fi

  if [ -w "/usr/local/bin" ]; then
    printf '/usr/local/bin\n'
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    printf '/usr/local/bin\n'
    return
  fi

  printf '%s/.local/bin\n' "$HOME"
}

download() {
  src="$1"
  dest="$2"
  curl -fsSL "$src" -o "$dest"
}

verify_checksum() {
  archive_path="$1"
  checksum_path="$2"

  if [ "$SKIP_CHECKSUM" = "1" ]; then
    log "Skipping checksum verification"
    return
  fi

  archive_name="$(basename "$archive_path")"
  expected_line="$(grep "  ${archive_name}\$" "$checksum_path" || true)"
  [ -n "$expected_line" ] || fail "checksum entry not found for ${archive_name}"

  if command -v sha256sum >/dev/null 2>&1; then
    (
      cd "$(dirname "$archive_path")"
      printf '%s\n' "$expected_line" | sha256sum -c -
    )
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    expected_sum="$(printf '%s' "$expected_line" | awk '{print $1}')"
    actual_sum="$(shasum -a 256 "$archive_path" | awk '{print $1}')"
    [ "$expected_sum" = "$actual_sum" ] || fail "checksum verification failed for ${archive_name}"
    return
  fi

  log "Warning: sha256sum/shasum not found; skipping checksum verification"
}

extract_archive() {
  archive_path="$1"
  dest_dir="$2"

  tar -xzf "$archive_path" -C "$dest_dir"
}

install_binary() {
  src="$1"
  dest_dir="$2"

  mkdir -p "$dest_dir"

  if [ -w "$dest_dir" ]; then
    install -m 755 "$src" "${dest_dir}/${BIN_NAME}"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo mkdir -p "$dest_dir"
    sudo install -m 755 "$src" "${dest_dir}/${BIN_NAME}"
    return
  fi

  fail "install directory is not writable: $dest_dir"
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --version)
        [ "$#" -ge 2 ] || fail "missing value for --version"
        VERSION="$2"
        shift 2
        ;;
      --install-dir)
        [ "$#" -ge 2 ] || fail "missing value for --install-dir"
        INSTALL_DIR="$2"
        shift 2
        ;;
      --skip-checksum)
        SKIP_CHECKSUM="1"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "unknown argument: $1"
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  need_cmd curl
  need_cmd tar
  need_cmd install
  need_cmd uname
  need_cmd grep
  need_cmd awk

  os="$(detect_os)"
  arch="$(detect_arch)"

  if [ -z "$VERSION" ]; then
    VERSION="$(resolve_latest_version)"
  fi

  install_dir="$(resolve_install_dir)"
  tag="v${VERSION}"

  asset_suffix="${arch}"
  if [ "$arch" = "armv7" ]; then
    asset_suffix="armv7"
  fi

  asset_name="${BIN_NAME}_${VERSION}_${os}_${asset_suffix}.tar.gz"
  checksums_name="checksums.txt"
  base_url="https://github.com/${REPO}/releases/download/${tag}"

  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT INT TERM

  archive_path="${tmpdir}/${asset_name}"
  checksums_path="${tmpdir}/${checksums_name}"
  extract_dir="${tmpdir}/extract"

  mkdir -p "$extract_dir"

  log "Installing ${BIN_NAME} ${VERSION} for ${os}/${arch}"
  download "${base_url}/${asset_name}" "$archive_path"
  download "${base_url}/${checksums_name}" "$checksums_path"

  verify_checksum "$archive_path" "$checksums_path"
  extract_archive "$archive_path" "$extract_dir"

  [ -f "${extract_dir}/${BIN_NAME}" ] || fail "archive did not contain ${BIN_NAME}"
  install_binary "${extract_dir}/${BIN_NAME}" "$install_dir"

  log "Installed ${BIN_NAME} to ${install_dir}/${BIN_NAME}"
  if ! command -v "${install_dir}/${BIN_NAME}" >/dev/null 2>&1 && ! printf '%s' ":$PATH:" | grep -q ":${install_dir}:"; then
    log "Add ${install_dir} to your PATH to run ${BIN_NAME} directly"
  fi
}

main "$@"
