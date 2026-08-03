#!/usr/bin/env bash
set -euo pipefail

PUBLIC_HOST="${DND_PUBLIC_HOST:-api.dnd.eclipse-forge.ru}"
EXPECTED_IPV4="${DND_EXPECTED_IPV4:-89.108.66.102}"
CHAT_ENV="${ECLIPSE_CHAT_ENV_FILE:-/var/www/eclipse-chat/apps/server/.env}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "DnD public prerequisite audit must run as root" >&2
  exit 1
fi
if [[ ! "$PUBLIC_HOST" =~ ^[a-z0-9.-]+$ || ! "$EXPECTED_IPV4" =~ ^[0-9.]+$ || ! "$CHAT_ENV" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "DnD public prerequisite audit received an invalid value" >&2
  exit 1
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "MISSING command: $1" >&2
    return 1
  fi
  echo "FOUND command: $1"
}

echo "== Runtime =="
require_command nginx
require_command openssl
require_command certbot
require_command curl
require_command supervisorctl
require_command getent
nginx -v
openssl version
certbot --version
nginx -t

echo "== DNS =="
RESOLVED_IPV4="$(getent ahostsv4 "$PUBLIC_HOST" | awk '{ print $1 }' | sort -u | paste -sd, -)"
echo "Resolved IPv4: ${RESOLVED_IPV4:-none}"
if [[ ",$RESOLVED_IPV4," != *",$EXPECTED_IPV4,"* ]]; then
  echo "DNS does not resolve $PUBLIC_HOST to the expected production IPv4" >&2
  exit 1
fi

echo "== Nginx and ACME =="
for directory in /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/letsencrypt; do
  if [[ -d "$directory" ]]; then
    echo "FOUND directory: $directory"
  else
    echo "MISSING directory: $directory" >&2
    exit 1
  fi
done
for candidate in \
  "/etc/nginx/sites-available/$PUBLIC_HOST" \
  "/etc/nginx/sites-available/$PUBLIC_HOST.conf" \
  "/etc/nginx/sites-enabled/$PUBLIC_HOST" \
  "/etc/nginx/sites-enabled/$PUBLIC_HOST.conf"; do
  if [[ -e "$candidate" || -L "$candidate" ]]; then
    echo "EXISTING site path: $candidate"
  fi
done
if certbot plugins 2>/dev/null | grep -q 'webroot'; then
  echo "FOUND certbot webroot plugin"
else
  echo "MISSING certbot webroot plugin" >&2
  exit 1
fi
certbot certificates 2>/dev/null | awk '/Certificate Name:|Domains:|Expiry Date:/{ sub(/^[[:space:]]+/, ""); print }'

echo "== Service boundaries =="
ss -ltn | awk 'NR == 1 || $4 ~ /:(80|443|8820)$/'
supervisorctl status eclipse-dnd-forge-bff
supervisorctl status eclipse-chat-server
HEALTH_JSON="$(curl -fsS --max-time 10 http://127.0.0.1:8820/health)"
HEALTH_JSON="$HEALTH_JSON" node -e '
  const health = JSON.parse(process.env.HEALTH_JSON || "null");
  if (health?.ok !== true || health?.service !== "eclipse-dnd-bff" || health?.aiEnabled !== false) process.exit(1);
'
echo "DnD BFF loopback health is valid and AI remains disabled"

echo "== Chat identity environment =="
if [[ ! -f "$CHAT_ENV" ]]; then
  echo "MISSING Chat environment: $CHAT_ENV" >&2
  exit 1
fi
echo "Chat environment owner/group/mode: $(stat -c '%U/%G/%a' "$CHAT_ENV")"
if grep -Eq '^ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64=.+$' "$CHAT_ENV"; then
  echo "Chat ecosystem identity key is already configured"
else
  echo "Chat ecosystem identity key is not configured"
fi
JWKS_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 https://app.star-crm.ru/eclipse-chat/api/ecosystem/.well-known/jwks.json)"
echo "Current Chat JWKS status: $JWKS_STATUS"

echo "DnD public prerequisite audit passed"
