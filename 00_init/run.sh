#! /bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
source "$DIR"/../lib.sh

verify_env

set -ex
mkdir -p "$PAGES_REPO"
git -C "$PAGES_REPO" init
git -C "$PAGES_REPO" remote add origin "$GITHUB_REMOTE"
git -C "$PAGES_REPO" branch -M main
