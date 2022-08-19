#! /bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
source "$DIR"/../lib.sh

verify_env

set -ex
mkdir -p "$CTFD_REPO"
git -C "$CTFD_REPO" init
git -C "$CTFD_REPO" remote add origin "$GITHUB_REMOTE"
git -C "$CTFD_REPO" branch -M main
