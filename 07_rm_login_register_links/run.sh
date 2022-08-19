#! /bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
source "$DIR"/../lib.sh

do_stage commit_simple 'Remove register & login links'
