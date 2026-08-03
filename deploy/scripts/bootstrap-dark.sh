#!/usr/bin/env bash
set -euo pipefail

DND_PATH="${ECLIPSE_DND_BFF_PATH:-/var/www/eclipse-dnd-forge-bff}"
DND_ENV="${DND_BFF_ENV_FILE:-/etc/eclipse-dnd-forge-bff.env}"
GATEWAY_PATH="${ECLIPSE_AI_HUB_GATEWAY_PATH:-/var/www/eclipse-ai-hub-gateway}"
GATEWAY_ENV="${AI_GATEWAY_ENV_FILE:-/etc/eclipse-ai-gateway.env}"
EXPECTED_DND_COMMIT="${DND_EXPECTED_COMMIT:-}"
EXPECTED_AI_HUB_COMMIT="${AI_HUB_EXPECTED_COMMIT:-aa2a1ced3e46235521e4afc2eba6fb106d2c8ddb}"
SERVICE_USER="eclipse-dnd-bff"
CHANGES_STARTED=0
DND_ENV_EXISTED=0

if [[ "$(id -u)" -ne 0 ]]; then
  echo "DnD BFF dark bootstrap must run as root" >&2
  exit 1
fi
for path in "$DND_PATH" "$DND_ENV" "$GATEWAY_PATH" "$GATEWAY_ENV"; do
  if [[ ! "$path" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
    echo "DnD dark bootstrap path contains unsupported characters" >&2
    exit 1
  fi
done
if [[ ! "$EXPECTED_DND_COMMIT" =~ ^[0-9a-f]{40}$ || ! "$EXPECTED_AI_HUB_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Dark bootstrap requires full pinned commit SHAs" >&2
  exit 1
fi
if [[ "$(git -C "$DND_PATH" rev-parse HEAD)" != "$EXPECTED_DND_COMMIT" || "$(git -C "$GATEWAY_PATH" rev-parse HEAD)" != "$EXPECTED_AI_HUB_COMMIT" ]]; then
  echo "Dark bootstrap checkout verification failed" >&2
  exit 1
fi
if [[ "$(stat -c '%U' "$GATEWAY_ENV")" != "root" || "$(stat -c '%a' "$GATEWAY_ENV")" =~ [1-7]$ ]]; then
  echo "Gateway environment has unsafe ownership or permissions" >&2
  exit 1
fi
if ! getent passwd "$SERVICE_USER" >/dev/null; then
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
fi

upsert_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  local temp_file
  temp_file="$(mktemp)"
  awk -v key="$key" 'index($0, key "=") != 1 { print }' "$file" > "$temp_file"
  printf '%s=%q\n' "$key" "$value" >> "$temp_file"
  cat "$temp_file" > "$file"
  rm -f -- "$temp_file"
}

write_env_line() {
  local key="$1"
  local value="$2"
  printf '%s=' "$key"
  printf '%q' "$value"
  printf '\n'
}

GATEWAY_BACKUP="$(mktemp)"
DND_BACKUP="$(mktemp)"
cp -p -- "$GATEWAY_ENV" "$GATEWAY_BACKUP"
if [[ -f "$DND_ENV" ]]; then
  cp -p -- "$DND_ENV" "$DND_BACKUP"
  DND_ENV_EXISTED=1
fi

restore_on_failure() {
  local exit_code=$?
  trap - EXIT
  if [[ $exit_code -ne 0 && $CHANGES_STARTED -eq 1 ]]; then
    set +e
    cp -p -- "$GATEWAY_BACKUP" "$GATEWAY_ENV"
    if [[ $DND_ENV_EXISTED -eq 1 ]]; then
      cp -p -- "$DND_BACKUP" "$DND_ENV"
      supervisorctl restart eclipse-dnd-forge-bff >/dev/null 2>&1
    else
      rm -f -- "$DND_ENV"
      supervisorctl stop eclipse-dnd-forge-bff >/dev/null 2>&1
    fi
    supervisorctl restart eclipse-ai-gateway >/dev/null 2>&1
    echo "Previous gateway and DnD BFF environments restored" >&2
  fi
  rm -f -- "$GATEWAY_BACKUP" "$DND_BACKUP"
  exit "$exit_code"
}
trap restore_on_failure EXIT

unset AI_GATEWAY_SERVICE_CLIENTS AI_GATEWAY_SERVICE_TOKEN AI_GATEWAY_SERVICE_TOKENS
set -a
source "$GATEWAY_ENV"
set +a
SERVICE_CLIENTS="${AI_GATEWAY_SERVICE_CLIENTS:-}"
if [[ -z "$SERVICE_CLIENTS" || -n "${AI_GATEWAY_SERVICE_TOKEN:-}" || -n "${AI_GATEWAY_SERVICE_TOKENS:-}" ]]; then
  echo "Gateway must use only the scoped service-client registry" >&2
  exit 1
fi

DND_SERVICE_TOKEN="$(
  SERVICE_CLIENTS_JSON="$SERVICE_CLIENTS" \
  CLIENT_ID="eclipse-dnd-forge" \
  node "$GATEWAY_PATH/gateway/scripts/service-clients.mjs" primary-token-if-present
)"
if [[ ${#DND_SERVICE_TOKEN} -lt 32 ]]; then
  DND_SERVICE_TOKEN="$(openssl rand -hex 32)"
fi
SERVICE_CLIENTS="$(
  SERVICE_CLIENTS_JSON="$SERVICE_CLIENTS" \
  CLIENT_ID="eclipse-dnd-forge" \
  CLIENT_TOKENS="$DND_SERVICE_TOKEN" \
  CLIENT_SCOPES="models:read,chat:write" \
  CLIENT_REQUESTS_PER_MINUTE="30" \
  node "$GATEWAY_PATH/gateway/scripts/service-clients.mjs" upsert
)"
CHAT_SERVICE_TOKEN="$(
  SERVICE_CLIENTS_JSON="$SERVICE_CLIENTS" \
  CLIENT_ID="eclipse-chat" \
  node "$GATEWAY_PATH/gateway/scripts/service-clients.mjs" primary-token
)"

CHANGES_STARTED=1
upsert_env_value "AI_GATEWAY_SERVICE_CLIENTS" "$SERVICE_CLIENTS" "$GATEWAY_ENV"

umask 077
DND_ENV_TEMP="$(mktemp)"
{
  write_env_line "NODE_ENV" "production"
  write_env_line "DND_BFF_HOST" "127.0.0.1"
  write_env_line "DND_BFF_PORT" "8820"
  write_env_line "DND_PUBLIC_ORIGIN" "https://dnd.eclipse-forge.ru"
  write_env_line "DND_BFF_SECURE_COOKIE" "true"
  write_env_line "DND_BFF_SESSION_TTL_SECONDS" "3600"
  write_env_line "DND_CHAT_TOKEN_URL" "https://app.star-crm.ru/eclipse-chat/api/ecosystem/token"
  write_env_line "DND_CHAT_JWKS_URL" "https://app.star-crm.ru/eclipse-chat/api/ecosystem/.well-known/jwks.json"
  write_env_line "DND_CHAT_ISSUER" "https://app.star-crm.ru/eclipse-chat"
  write_env_line "DND_CHAT_REDIRECT_URI" "https://dnd.eclipse-forge.ru/"
  write_env_line "DND_AI_GATEWAY_BASE_URL" "http://127.0.0.1:8810"
  write_env_line "DND_AI_GATEWAY_SERVICE_TOKEN" "$DND_SERVICE_TOKEN"
  write_env_line "DND_BFF_BUDGET_FILE" "/var/lib/eclipse-dnd-forge/budgets.json"
  write_env_line "DND_BFF_USER_REQUESTS_PER_15_MINUTES" "60"
  write_env_line "DND_BFF_USER_DAILY_TOKENS" "250000"
  write_env_line "DND_BFF_PRODUCT_DAILY_TOKENS" "5000000"
  write_env_line "DND_BFF_MAX_OUTPUT_TOKENS" "2048"
  write_env_line "DND_BFF_AI_ENABLED" "false"
} > "$DND_ENV_TEMP"
install -o root -g "$SERVICE_USER" -m 0640 "$DND_ENV_TEMP" "$DND_ENV"
rm -f -- "$DND_ENV_TEMP"

ECLIPSE_AI_HUB_GATEWAY_PATH="$GATEWAY_PATH" \
  AI_GATEWAY_ENV_FILE="$GATEWAY_ENV" \
  AI_GATEWAY_SMOKE_CLIENT_ID="eclipse-chat" \
  bash "$GATEWAY_PATH/deploy/scripts/sync-gateway-supervisor.sh"

GATEWAY_BASE="http://127.0.0.1:${AI_GATEWAY_PORT:-8810}"
DND_MODELS_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -H "Authorization: Bearer $DND_SERVICE_TOKEN" "$GATEWAY_BASE/v1/models")"
DND_TELEMETRY_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -H "Authorization: Bearer $DND_SERVICE_TOKEN" "$GATEWAY_BASE/v1/telemetry")"
CHAT_TELEMETRY_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -H "Authorization: Bearer $CHAT_SERVICE_TOKEN" "$GATEWAY_BASE/v1/telemetry")"
if [[ "$DND_MODELS_STATUS" != "200" || "$DND_TELEMETRY_STATUS" != "403" || "$CHAT_TELEMETRY_STATUS" != "200" ]]; then
  echo "Scoped gateway smoke failed" >&2
  exit 1
fi

ECLIPSE_DND_BFF_PATH="$DND_PATH" DND_BFF_ENV_FILE="$DND_ENV" \
  bash "$DND_PATH/deploy/scripts/sync-bff-supervisor.sh"
HEALTH_JSON="$(curl -fsS --max-time 10 http://127.0.0.1:8820/health)"
HEALTH_JSON="$HEALTH_JSON" node -e '
  const health = JSON.parse(process.env.HEALTH_JSON || "null");
  if (health?.ok !== true || health?.aiEnabled !== false) process.exit(1);
'
ORIGIN_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -H 'Origin: https://evil.example' http://127.0.0.1:8820/api/v1/auth/session)"
if [[ "$ORIGIN_STATUS" != "403" ]]; then
  echo "DnD BFF exact-origin smoke failed" >&2
  exit 1
fi

curl -fsS --max-time 10 https://app.star-crm.ru/eclipse-chat/api/health >/dev/null
CHANGES_STARTED=0
rm -f -- "$GATEWAY_BACKUP" "$DND_BACKUP"
trap - EXIT
echo "DnD BFF dark launch is healthy on loopback with AI disabled"
