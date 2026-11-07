#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${PBX_DATA_DIR:-/data}"
IN="${1:?usage: restore.sh <backup.tar.gz>}"

mkdir -p "$DATA_DIR"
tar -xzf "$IN" -C "$DATA_DIR"
echo "restored into $DATA_DIR"