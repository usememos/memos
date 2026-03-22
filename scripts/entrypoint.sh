#!/usr/bin/env sh

# Fix ownership of data directory for users upgrading from older versions
# where files were created as root
MEMOS_UID=${MEMOS_UID:-10001}
MEMOS_GID=${MEMOS_GID:-10001}
DATA_DIR="/var/opt/memos"

if [ "$(id -u)" = "0" ]; then
    # Running as root, fix permissions and drop to nonroot
    if [ -d "$DATA_DIR" ]; then
        chown -R "$MEMOS_UID:$MEMOS_GID" "$DATA_DIR" 2>/dev/null || true
    fi
    exec su-exec "$MEMOS_UID:$MEMOS_GID" "$0" "$@"
fi

file_env() {
   var="$1"
   fileVar="${var}_FILE"

   val_var="$(printenv "$var")"
   val_fileVar="$(printenv "$fileVar")"

   if [ -n "$val_var" ] && [ -n "$val_fileVar" ]; then
      echo "error: both $var and $fileVar are set (but are exclusive)" >&2
      exit 1
   fi

   if [ -n "$val_var" ]; then
      val="$val_var"
   elif [ -n "$val_fileVar" ]; then
      if [ ! -r "$val_fileVar" ]; then
         echo "error: file '$val_fileVar' does not exist or is not readable" >&2
         exit 1
      fi
      val="$(cat "$val_fileVar")"
   fi

   export "$var"="$val"
   unset "$fileVar"
}

file_env "MEMOS_DSN"

exec "$@"
