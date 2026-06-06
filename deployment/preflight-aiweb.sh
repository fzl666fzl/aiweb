#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/aiweb/repo}"
ENV_FILE="${ENV_FILE:-/opt/aiweb/.env.production}"
COMPOSE_ENV="${COMPOSE_ENV:-/opt/aiweb/compose.env}"
COMPOSE_FILE="${COMPOSE_FILE:-deployment/docker-compose.aiweb.yml}"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

info() {
  printf 'OK: %s\n' "$1"
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed or not in PATH"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is not available"
info "Docker and Docker Compose are available"

[ -d "$APP_DIR" ] || fail "app directory not found: $APP_DIR"
cd "$APP_DIR"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $APP_DIR/$COMPOSE_FILE"
info "compose file found"

[ -f "$ENV_FILE" ] || fail "missing env file: $ENV_FILE"
[ -f "$COMPOSE_ENV" ] || fail "missing compose env file: $COMPOSE_ENV"
info "env files found"

required_env_vars=(
  AI_BASE_URL
  AI_API_KEY
  AI_MODEL
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  APP_ACCESS_SECRET
)

for env_name in "${required_env_vars[@]}"; do
  if ! grep -Eq "^${env_name}=.+" "$ENV_FILE"; then
    fail "missing or empty required env var in $ENV_FILE: $env_name"
  fi
done
info "required env fields are present and non-empty"

set -a
# shellcheck disable=SC1090
. "$COMPOSE_ENV"
set +a

[ -n "${AIWEB_CADDY_NETWORK:-}" ] || fail "AIWEB_CADDY_NETWORK is empty in $COMPOSE_ENV"
docker network inspect "$AIWEB_CADDY_NETWORK" >/dev/null 2>&1 || fail "Docker network not found: $AIWEB_CADDY_NETWORK"
info "Caddy network exists: $AIWEB_CADDY_NETWORK"

if docker ps --format '{{.Names}}' | grep -qx 'aiweb'; then
  info "aiweb container already exists"
else
  info "aiweb container is not running yet"
fi

if docker ps --format '{{.Names}}' | grep -Eq '^(caddy|sub2api|redis|postgres)$'; then
  info "found at least one expected existing service container"
else
  printf 'WARN: did not find containers named caddy/sub2api/redis/postgres; verify names manually.\n' >&2
fi

if grep -Eq '^\s*ports:' "$COMPOSE_FILE"; then
  fail "$COMPOSE_FILE contains ports:, aiweb should stay behind Caddy"
fi
info "aiweb compose does not publish host ports"

docker compose --env-file "$COMPOSE_ENV" -f "$COMPOSE_FILE" config >/dev/null
info "docker compose config renders successfully"

printf '\nPreflight complete. You can run:\n'
printf '  cd %s\n' "$APP_DIR"
printf '  docker compose --env-file %s -f %s up -d --build\n' "$COMPOSE_ENV" "$COMPOSE_FILE"
printf '\nAfter the container starts, run these smoke tests:\n'
printf '  docker exec aiweb node -e "fetch('"'"'http://127.0.0.1:3000/api/health'"'"').then(async (response) => { console.log(response.status, await response.text()); process.exit(response.ok ? 0 : 1); }).catch((error) => { console.error(error); process.exit(1); })"\n'
printf '  curl -fsS https://fzl-ai.top/api/health\n'
printf '  curl -sS https://api.fzl-ai.top/v1/models -o /dev/null -w '"'"'%%{http_code}\\n'"'"'\n'
