#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${PBX_DATA_DIR:-/data}"
OUT="${1:-/tmp/better-pbx-backup.tar.gz}"

tar -czf "$OUT" -C "$DATA_DIR" config voicemail sounds pbx.db 2>/dev/null || tar -czf "$OUT" -C "$DATA_DIR" .
echo "backup written to $OUT"