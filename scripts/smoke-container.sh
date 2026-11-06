#!/bin/sh
# BetterPBX container smoke test.
#
# Builds the runtime image, boots it with a temporary /data directory on the host network,
# asserts the Phase 1 exit criteria, restarts against the same /data, and verifies persistence.
#
# Usage:
#   scripts/smoke-container.sh
#   IMAGE=better-pbx:dev SKIP_BUILD=1 scripts/smoke-container.sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
cd "$ROOT"

IMAGE=${IMAGE:-better-pbx:dev}
SKIP_BUILD=${SKIP_BUILD:-0}
KEEP_DATA=${KEEP_DATA:-0}
CONTAINER="better-pbx-smoke-$$"
DATA_DIR=$(mktemp -d "/tmp/opencode/better-pbx-smoke.XXXXXX")
STARTED=0

log() {
  printf '\n==> %s\n' "$*"
}

fail() {
  printf '\nSMOKE TEST FAILED: %s\n' "$*" >&2
  if [ "$STARTED" -eq 1 ]; then
    printf '\n--- container logs ---\n' >&2
    docker logs "$CONTAINER" 2>&1 | tail -n 200 >&2 || true
  fi
  exit 1
}

pass() {
  printf 'ok: %s\n' "$*"
}

assert_contains() {
  haystack=$1
  needle=$2
  label=$3
  case "$haystack" in
    *"$needle"*) pass "$label" ;;
    *) fail "$label: expected to find '$needle' in: $haystack" ;;
  esac
}

assert_not_contains() {
  haystack=$1
  needle=$2
  label=$3
  case "$haystack" in
    *"$needle"*) fail "$label: did not expect '$needle' in: $haystack" ;;
    *) pass "$label" ;;
  esac
}

in_container() {
  docker exec "$CONTAINER" "$@"
}

cleanup() {
  if [ "$STARTED" -eq 1 ]; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
  if [ "$KEEP_DATA" -eq 1 ]; then
    printf 'kept smoke-test data at %s\n' "$DATA_DIR"
    return
  fi
  if [ -d "$DATA_DIR" ]; then
    # The init service applies root/pbx ownership and 0770/0750 modes, so clean up from inside
    # the same image rather than relying on the host user's permissions.
    if ! docker run --rm --entrypoint /bin/sh -v "${DATA_DIR}:/data" "$IMAGE" \
      -c 'find /data -mindepth 1 -delete' >/dev/null 2>&1; then
      rm -rf "$DATA_DIR" 2>/dev/null || true
    fi
    rmdir "$DATA_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

wait_for_health() {
  timeout_seconds=$1
  deadline=$(( $(date +%s) + timeout_seconds ))
  status=starting
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
      fail "container $CONTAINER disappeared while waiting for health"
    fi
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER")
    case "$status" in
      healthy)
        pass "container is healthy"
        return 0
        ;;
      unhealthy)
        docker inspect --format '{{json .State.Health}}' "$CONTAINER" >&2 || true
        fail "container became unhealthy"
        ;;
      none)
        if [ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER")" = "false" ]; then
          fail "container exited before becoming healthy"
        fi
        ;;
    esac
    sleep 2
  done
  fail "container did not become healthy within ${timeout_seconds}s (last status: $status)"
}

api_get() {
  curl -fsS --max-time 5 "http://127.0.0.1:8080$1"
}

log "Building ${IMAGE}"
if [ "$SKIP_BUILD" -eq 1 ]; then
  pass "using existing image (SKIP_BUILD=1)"
else
  docker build -t "$IMAGE" .
fi

log "Starting container with temporary data volume ${DATA_DIR}"
STARTED=1
docker run -d \
  --name "$CONTAINER" \
  --network=host \
  -v "${DATA_DIR}:/data" \
  "$IMAGE" >/dev/null

wait_for_health 240

log "Checking the supervisord services"
version=$(in_container /usr/sbin/asterisk -rx 'core show version')
assert_contains "$version" "Asterisk 22." "Asterisk 22 is running"

jails=$(in_container /usr/bin/fail2ban-client status)
assert_contains "$jails" "better-pbx" "fail2ban has the better-pbx jail"

health=$(api_get /api/health)
assert_contains "$health" '"status":"ok"' "API health endpoint reports ok"

setup_status=$(api_get /api/setup/status)
assert_contains "$setup_status" '"setupRequired":true' "API requires first-run setup"

log "Checking first-boot state"
setup_token=$(in_container cat /data/setup-token)
[ -n "$setup_token" ] || fail "setup token is empty"
pass "setup token exists"

logs=$(docker logs "$CONTAINER" 2>&1)
assert_contains "$logs" "first boot initialisation complete" "first boot completed"
assert_contains "$logs" "FIRST-RUN SETUP CODE: ${setup_token}" "setup code is printed to container logs"
assert_not_contains "$logs" "Error loading module" "no Asterisk modules failed to load"
assert_not_contains "$logs" "Failed to resolve dependencies" "no Asterisk module dependencies are missing"
assert_not_contains "$logs" "declined to load" "no Asterisk modules declined to load"
assert_not_contains "$logs" "Unable to load config file" "no bootstrap config files are missing"
assert_not_contains "$logs" "Unable to install capabilities" "Asterisk did not try to re-drop privileges"

config_hash=$(in_container sha256sum /data/config/pbx.yaml | awk '{print $1}')
assert_not_contains "$(in_container cat /data/config/pbx.yaml)" "__CREATED_AT__" "bootstrap model has no placeholders"

# The repository is pbx-owned; run Git as pbx so root's inspect does not trip dubious ownership.
git_head=$(in_container /command/s6-setuidgid pbx git -C /data/config log --oneline -1)
assert_contains "$git_head" "Bootstrap: initial safe configuration" "configuration Git repository has a bootstrap commit"
[ "$(in_container /command/s6-setuidgid pbx git -C /data/config rev-list --count HEAD)" = "1" ] || fail "bootstrap Git history should contain one commit"
pass "configuration Git history is initialised"

in_container test -s /data/runtime/tls/sip.crt || fail "SIP TLS certificate is missing"
in_container test -s /data/runtime/tls/sip.key || fail "SIP TLS key is missing"
key_mode=$(in_container stat -c '%U:%G %a' /data/runtime/tls/sip.key)
[ "$key_mode" = "asterisk:pbx 600" ] || fail "unexpected SIP TLS key ownership/mode: $key_mode"
pass "self-signed SIP TLS material exists with restrictive permissions"

log "Checking Asterisk bootstrap configuration"
transports=$(in_container /usr/sbin/asterisk -rx 'pjsip show transports')
assert_contains "$transports" "transport-udp" "UDP transport is bound"
assert_contains "$transports" "transport-tls" "TLS transport is bound"

endpoints=$(in_container /usr/sbin/asterisk -rx 'pjsip show endpoints')
assert_not_contains "$endpoints" "Endpoint:" "no PJSIP endpoints are configured"

# AMI, ARI, and Asterisk's internal HTTP server must not be listening.
listening=$(in_container ss -lntu)
assert_not_contains "$listening" ':5038 ' "AMI is not listening"
assert_not_contains "$listening" ':8088 ' "Asterisk HTTP/ARI is not listening"
pass "only the expected SIP and API ports are exposed"

log "Checking restart persistence against the same /data"
before_lines=$(docker logs "$CONTAINER" 2>&1 | wc -l)
docker restart "$CONTAINER" >/dev/null
wait_for_health 240

restart_logs=$(docker logs "$CONTAINER" 2>&1 | tail -n +$((before_lines + 1)))
assert_contains "$restart_logs" "existing /data detected" "restart detected the existing data volume"

[ "$(in_container sha256sum /data/config/pbx.yaml | awk '{print $1}')" = "$config_hash" ] || fail "pbx.yaml changed across restart"
pass "bootstrap model was not overwritten"

[ "$(in_container cat /data/setup-token)" = "$setup_token" ] || fail "setup token changed across restart"
pass "setup token was not regenerated"

[ "$(in_container /command/s6-setuidgid pbx git -C /data/config rev-list --count HEAD)" = "1" ] || fail "Git history changed across restart"
pass "configuration Git history was not rewritten"

assert_contains "$(in_container /usr/sbin/asterisk -rx 'core show version')" "Asterisk 22." "Asterisk is running after restart"
assert_contains "$(in_container /usr/bin/fail2ban-client status)" "better-pbx" "fail2ban is running after restart"

log "Checking setup gate invalidation (setup itself lands in Phase 4)"
in_container rm -f /data/setup-token
setup_status=$(api_get /api/setup/status)
assert_contains "$setup_status" '"setupRequired":false' "API reports setup complete after the token is removed"
pass "setup gate is backed by /data/setup-token"

log "Checking graceful shutdown"
docker stop -t 30 "$CONTAINER" >/dev/null
exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$CONTAINER")
[ "$exit_code" != "137" ] || fail "container was killed instead of shutting down gracefully"
assert_contains "$(docker logs "$CONTAINER" 2>&1)" "shutting down better-pbx-api" "API logged an orderly shutdown"
pass "container stopped with exit code ${exit_code}"

printf '\nSMOKE TEST PASSED\n'
