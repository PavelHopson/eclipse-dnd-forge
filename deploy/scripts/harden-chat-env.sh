#!/usr/bin/env bash
set -euo pipefail

CHAT_ENV="${ECLIPSE_CHAT_ENV_FILE:-/var/www/eclipse-chat/apps/server/.env}"
CHAT_HEALTH_URL="https://app.star-crm.ru/eclipse-chat/api/health"
CHAT_JWKS_URL="https://app.star-crm.ru/eclipse-chat/api/ecosystem/.well-known/jwks.json"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Chat environment hardening must run as root" >&2
  exit 1
fi
if [[ ! "$CHAT_ENV" =~ ^/[A-Za-z0-9._/-]+$ || ! -f "$CHAT_ENV" || -L "$CHAT_ENV" ]]; then
  echo "Chat environment must be an existing regular file at a trusted path" >&2
  exit 1
fi
for command_name in chown chmod stat runuser curl supervisorctl grep dirname; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is missing: $command_name" >&2
    exit 1
  fi
done
if ! supervisorctl status eclipse-chat-server | grep -q RUNNING; then
  echo "Eclipse Chat must be running before its environment is hardened" >&2
  exit 1
fi

PARENT_DIR="$(dirname -- "$CHAT_ENV")"
if runuser -u www-data -- test -w "$PARENT_DIR"; then
  echo "Chat environment parent directory is writable by www-data; file ownership alone is insufficient" >&2
  exit 1
fi

PREVIOUS_UID="$(stat -c '%u' "$CHAT_ENV")"
PREVIOUS_GID="$(stat -c '%g' "$CHAT_ENV")"
PREVIOUS_MODE="$(stat -c '%a' "$CHAT_ENV")"
CHANGED=0

rollback_on_failure() {
  local exit_code=$?
  trap - EXIT
  if [[ $exit_code -ne 0 && $CHANGED -eq 1 ]]; then
    set +e
    chown "$PREVIOUS_UID:$PREVIOUS_GID" "$CHAT_ENV"
    chmod "$PREVIOUS_MODE" "$CHAT_ENV"
    echo "Previous Chat environment ownership and mode restored" >&2
  fi
  exit "$exit_code"
}
trap rollback_on_failure EXIT

chown root:www-data "$CHAT_ENV"
chmod 0640 "$CHAT_ENV"
CHANGED=1

if [[ "$(stat -c '%U/%G/%a' "$CHAT_ENV")" != "root/www-data/640" ]]; then
  echo "Chat environment ownership hardening did not persist" >&2
  exit 1
fi
if ! runuser -u www-data -- test -r "$CHAT_ENV" || runuser -u www-data -- test -w "$CHAT_ENV"; then
  echo "Chat service must have read-only access to its environment" >&2
  exit 1
fi
curl -fsS --max-time 10 "$CHAT_HEALTH_URL" >/dev/null
if [[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$CHAT_JWKS_URL")" != "200" ]]; then
  echo "Chat JWKS became unavailable after environment metadata hardening" >&2
  exit 1
fi

CHANGED=0
trap - EXIT
echo "Chat environment is root:www-data 0640 and read-only to the service"
