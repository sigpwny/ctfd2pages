#! /bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
source "$DIR"/../lib.sh

if [[ ! -z "$EXPORT_PATH" && ! -f "$EXPORT_PATH"/db/flags.json ]]; then
  echo "\$EXPORT_PATH set to ${EXPORT_PATH} but ${EXPORT_PATH}/db/flags.json does not exist, ignoring"
  EXPORT_PATH=
fi

[[ -z "$CHAL_REPO" && -z "$EXPORT_PATH" ]] && die '$CHAL_REPO and $EXPORT_PATH both not set'

export CHAL_REPO EXPORT_PATH
if [[ ! -z "$CHAL_REPO" ]]; then
  CHAL_REPO="$(realpath "$CHAL_REPO")"
fi
if [[ ! -z "$EXPORT_PATH" ]]; then
  EXPORT_PATH="$(realpath "$EXPORT_PATH")"
fi

do_stage commit_simple 'Add JS hooks to challenge page for flag verify & hints'
