#! /bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
source "$DIR"/../lib.sh

verify_env

set -ex
git -C "$PAGES_REPO" pull -r
git -C "$PAGES_REPO" push -u origin main
