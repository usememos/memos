#!/usr/bin/env sh

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
