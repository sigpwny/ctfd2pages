#! /bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
source "$DIR"/../lib.sh

if [[ ! -z "$EXPORT_PATH" && ! -f "$EXPORT_PATH"/db/flags.json ]]; then
  echo "\$EXPORT_PATH set to ${EXPORT_PATH} but ${EXPORT_PATH}/db/flags.json does not exist, ignoring"
  EXPORT_PATH=
fi

if [[ -z "$CHAL_REPO" && -z "$EXPORT_PATH" ]]; then
  echo 'Error: $CHAL_REPO and $EXPORT_PATH both not set'
  echo 'This stage requires chal flags so that hashes of the flags may be added to client side JS so that the flag checking may be done on the client side.'
  echo '- Set $CHAL_REPO if you want the script to obtain the flags from the ctfcli challenge.yml files (will read from ${CHAL_REPO}/**/challenge.yml).'
  echo '- Set $EXPORT_PATH if you want the script to obtain the flags from CTFd export (will read from ${EXPORT_PATH}/db/flags.json).'
  echo 'If you have both, $EXPORT_PATH is preferred :)'
  die
fi

export CHAL_REPO EXPORT_PATH
if [[ ! -z "$CHAL_REPO" ]]; then
  CHAL_REPO="$(realpath "$CHAL_REPO")"
fi
if [[ ! -z "$EXPORT_PATH" ]]; then
  EXPORT_PATH="$(realpath "$EXPORT_PATH")"
fi

do_stage commit_simple 'Add JS hooks to challenge page for flag verify & hints'
