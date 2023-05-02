#!/bin/sh
set -e


# Restore the database if it does not already exist.
if [ -f "/var/opt/memos/memos_prod.db" ]; then
  echo "Database exists, skipping restore."
else
  echo "No database found, attempt to restore from a replica."
  litestream restore -if-replica-exists "/var/opt/memos/memos_prod.db"
  echo "Finished restoring the database."
fi


echo "Starting litestream & memos service."


# Run litestream with your app as the subprocess.
exec litestream replicate -exec "./memos --mode prod --port 5230"