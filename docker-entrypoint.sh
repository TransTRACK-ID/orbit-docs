#!/bin/sh
set -e

REPO_DIR="${ORBIT_REPO_DIR:-/home/nodejs/.local/share/orbit-docs-repositories}"

mkdir -p "$REPO_DIR"
chown -R nodejs:nodejs "$REPO_DIR"

exec gosu nodejs "$@"
