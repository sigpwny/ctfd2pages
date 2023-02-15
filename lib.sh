#! /bin/bash

die() {
  [[ -z "$1" ]] || echo "$1"
  exit 1
}

verify_env() {
  [[ -z "$PAGES_REPO" ]] && die '$PAGES_REPO not set'
  [[ -z "$CTFD_URL" ]] && die '$CTFD_URL not set'
  [[ -z "$GITHUB_REMOTE" ]] && die '$GITHUB_REMOTE not set'

  export PAGES_REPO CTFD_URL GITHUB_REMOTE
  PAGES_REPO="$(realpath "$PAGES_REPO")"
}

do_stage() {
  verify_env

  set -ex
  shopt -s nullglob
  (cd "$PAGES_REPO" && source "$DIR"/stage.sh)

  git -C "$PAGES_REPO" add -A
  "$@"
}

commit_simple() {
  git -C "$PAGES_REPO" commit -m "$1"
}

commit_command() {
  (
    echo "$1"
    echo
    echo "Command:"
    cat "$DIR"/stage.sh | awk '{ print "  " $0 }'
  ) | git -C "$PAGES_REPO" commit -F -
}
