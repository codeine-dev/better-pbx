#!/usr/bin/env bash
set -euo pipefail

# Optional container smoke test. Requires Docker and a built image.
IMAGE="${IMAGE:-better-pbx:latest}"
DATA_DIR="${DATA_DIR:-/tmp/pbx-smoke-data}"
rm -rf "$DATA_DIR"
mkdir -p "$DATA_DIR"

docker run -d --name better-pbx-smoke --network host -v "$DATA_DIR:/data" "$IMAGE" >/tmp/pbx-smoke.cid
trap 'docker rm -f better-pbx-smoke >/dev/null 2>&1 || true' EXIT

for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    echo "health ok"
    exit 0
  fi
  sleep 2
done
echo "health check failed" >&2
exit 1