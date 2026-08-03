#!/usr/bin/env bash
set -euo pipefail

PUBLIC_HOST="${DND_PUBLIC_HOST:-api.dnd.eclipse-forge.ru}"
EXPECTED_IPV4="${DND_EXPECTED_IPV4:-89.108.66.102}"
CHAT_ENV="${ECLIPSE_CHAT_ENV_FILE:-/var/www/eclipse-chat/apps/server/.env}"
CHAT_HEALTH_URL="https://app.star-crm.ru/eclipse-chat/api/health"
CHAT_JWKS_URL="https://app.star-crm.ru/eclipse-chat/api/ecosystem/.well-known/jwks.json"
CHAT_IDENTITY_KID="${ECOSYSTEM_IDENTITY_KEY_ID:-eclipse-chat-identity-20260803-v1}"
SITE_AVAILABLE="/etc/nginx/sites-available/${PUBLIC_HOST}.conf"
SITE_ENABLED="/etc/nginx/sites-enabled/${PUBLIC_HOST}.conf"
ACME_ROOT="/var/www/letsencrypt"
CERTIFICATE_DIR="/etc/letsencrypt/live/$PUBLIC_HOST"
CHAT_BACKUP=""
CHAT_TEMP=""
SESSION_HEADERS=""
SESSION_BODY=""
EVIL_HEADERS=""
CHAT_CHANGED=0
SITE_CREATED=0

if [[ "$(id -u)" -ne 0 ]]; then
  echo "DnD public activation must run as root" >&2
  exit 1
fi
if [[ ! "$PUBLIC_HOST" =~ ^[a-z0-9.-]+$ ||
      ! "$EXPECTED_IPV4" =~ ^[0-9.]+$ ||
      ! "$CHAT_ENV" =~ ^/[A-Za-z0-9._/-]+$ ||
      ! "$CHAT_IDENTITY_KID" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
  echo "DnD public activation received an invalid value" >&2
  exit 1
fi
for command_name in nginx certbot openssl base64 curl supervisorctl getent node install awk grep sort paste cat; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is missing: $command_name" >&2
    exit 1
  fi
done
if [[ ! -f "$CHAT_ENV" || -L "$CHAT_ENV" ]]; then
  echo "Chat environment must be an existing regular file" >&2
  exit 1
fi
if [[ -e "$SITE_AVAILABLE" || -L "$SITE_AVAILABLE" || -e "$SITE_ENABLED" || -L "$SITE_ENABLED" ]]; then
  echo "Refusing to overwrite an existing DnD Nginx site" >&2
  exit 1
fi
RESOLVED_IPV4="$(getent ahostsv4 "$PUBLIC_HOST" | awk '{ print $1 }' | sort -u | paste -sd, -)"
if [[ ",$RESOLVED_IPV4," != *",$EXPECTED_IPV4,"* ]]; then
  echo "DNS does not resolve $PUBLIC_HOST to the expected production IPv4" >&2
  exit 1
fi
if ! supervisorctl status eclipse-dnd-forge-bff | grep -q RUNNING ||
   ! supervisorctl status eclipse-chat-server | grep -q RUNNING; then
  echo "DnD BFF and Eclipse Chat must both be running" >&2
  exit 1
fi
LOOPBACK_HEALTH="$(curl -fsS --max-time 10 http://127.0.0.1:8820/health)"
LOOPBACK_HEALTH="$LOOPBACK_HEALTH" node -e '
  const health = JSON.parse(process.env.LOOPBACK_HEALTH || "null");
  if (health?.ok !== true || health?.service !== "eclipse-dnd-bff" || health?.aiEnabled !== false) process.exit(1);
'

secure_remove() {
  local path="$1"
  [[ -n "$path" && -f "$path" ]] || return 0
  chmod 0600 "$path" 2>/dev/null || true
  if command -v shred >/dev/null 2>&1; then
    shred -u -- "$path" 2>/dev/null || rm -f -- "$path"
  else
    rm -f -- "$path"
  fi
}

reload_nginx() {
  nginx -t
  if command -v systemctl >/dev/null 2>&1; then
    systemctl reload nginx
  else
    nginx -s reload
  fi
}

rollback_on_failure() {
  local exit_code=$?
  trap - EXIT
  set +e
  if [[ $exit_code -ne 0 ]]; then
    echo "DnD public activation failed; rolling back public exposure" >&2
    if [[ $CHAT_CHANGED -eq 1 && -n "$CHAT_BACKUP" && -f "$CHAT_BACKUP" ]]; then
      install -o www-data -g www-data -m 0600 "$CHAT_BACKUP" "$CHAT_ENV"
      supervisorctl restart eclipse-chat-server >/dev/null 2>&1
      echo "Previous Chat identity configuration restored with secure permissions" >&2
    fi
    if [[ $SITE_CREATED -eq 1 ]]; then
      rm -f -- "$SITE_ENABLED" "$SITE_AVAILABLE"
      reload_nginx >/dev/null 2>&1
      echo "DnD public Nginx site removed" >&2
    fi
  fi
  secure_remove "$CHAT_TEMP"
  [[ -n "$SESSION_HEADERS" ]] && rm -f -- "$SESSION_HEADERS"
  [[ -n "$SESSION_BODY" ]] && rm -f -- "$SESSION_BODY"
  [[ -n "$EVIL_HEADERS" ]] && rm -f -- "$EVIL_HEADERS"
  secure_remove "$CHAT_BACKUP"
  exit "$exit_code"
}
trap rollback_on_failure EXIT

umask 077
CHAT_BACKUP="$(mktemp)"
cp -- "$CHAT_ENV" "$CHAT_BACKUP"
chmod 0600 "$CHAT_BACKUP"

install -d -o root -g www-data -m 0755 "$ACME_ROOT"
HTTP_CONFIG="$(mktemp)"
cat > "$HTTP_CONFIG" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $PUBLIC_HOST;
    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        root $ACME_ROOT;
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        return 308 https://$PUBLIC_HOST\$request_uri;
    }
}
NGINX
install -o root -g root -m 0644 "$HTTP_CONFIG" "$SITE_AVAILABLE"
rm -f -- "$HTTP_CONFIG"
ln -s "$SITE_AVAILABLE" "$SITE_ENABLED"
SITE_CREATED=1
reload_nginx

certbot certonly \
  --webroot \
  --webroot-path "$ACME_ROOT" \
  --domains "$PUBLIC_HOST" \
  --non-interactive \
  --agree-tos \
  --no-eff-email \
  --keep-until-expiring
if [[ ! -r "$CERTIFICATE_DIR/fullchain.pem" || ! -r "$CERTIFICATE_DIR/privkey.pem" ]]; then
  echo "Certbot did not create the expected certificate files" >&2
  exit 1
fi

TLS_CONFIG="$(mktemp)"
cat > "$TLS_CONFIG" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $PUBLIC_HOST;
    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        root $ACME_ROOT;
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        return 308 https://$PUBLIC_HOST\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $PUBLIC_HOST;
    server_tokens off;

    ssl_certificate $CERTIFICATE_DIR/fullchain.pem;
    ssl_certificate_key $CERTIFICATE_DIR/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache shared:DNDSSL:10m;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

    client_max_body_size 256k;

    location = /health {
        proxy_pass http://127.0.0.1:8820;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For "";
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";
        proxy_connect_timeout 5s;
        proxy_send_timeout 15s;
        proxy_read_timeout 15s;
    }

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:8820;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For "";
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";
        proxy_connect_timeout 5s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location / {
        return 404;
    }
}
NGINX
install -o root -g root -m 0644 "$TLS_CONFIG" "$SITE_AVAILABLE"
rm -f -- "$TLS_CONFIG"
reload_nginx

PRIVATE_KEY_B64="$(openssl genpkey -algorithm ED25519 -outform DER 2>/dev/null | base64 -w 0)"
if [[ ! "$PRIVATE_KEY_B64" =~ ^[A-Za-z0-9+/]{40,256}={0,2}$ ]]; then
  echo "Generated Ed25519 private key has an unexpected encoding" >&2
  exit 1
fi
CHAT_TEMP="$(mktemp)"
cp -- "$CHAT_ENV" "$CHAT_TEMP"

upsert_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  local next_file
  next_file="$(mktemp)"
  awk -v key="$key" 'index($0, key "=") != 1 { print }' "$file" > "$next_file"
  printf '%s=%s\n' "$key" "$value" >> "$next_file"
  chmod 0600 "$next_file"
  mv -- "$next_file" "$file"
}

upsert_env_value "ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64" "$PRIVATE_KEY_B64" "$CHAT_TEMP"
upsert_env_value "ECOSYSTEM_IDENTITY_KEY_ID" "$CHAT_IDENTITY_KID" "$CHAT_TEMP"
upsert_env_value "ECOSYSTEM_IDENTITY_ISSUER" "https://app.star-crm.ru/eclipse-chat" "$CHAT_TEMP"
upsert_env_value "ECOSYSTEM_IDENTITY_REDIRECT_URIS" "https://dnd.eclipse-forge.ru/" "$CHAT_TEMP"
upsert_env_value "ECOSYSTEM_IDENTITY_PREVIOUS_JWKS_JSON" "'{\"keys\":[]}'" "$CHAT_TEMP"
install -o www-data -g www-data -m 0600 "$CHAT_TEMP" "$CHAT_ENV"
secure_remove "$CHAT_TEMP"
CHAT_TEMP=""
unset PRIVATE_KEY_B64
CHAT_CHANGED=1

supervisorctl restart eclipse-chat-server
sleep 4
curl -fsS --max-time 10 "$CHAT_HEALTH_URL" >/dev/null
JWKS_JSON="$(curl -fsS --max-time 10 "$CHAT_JWKS_URL")"
JWKS_JSON="$JWKS_JSON" EXPECTED_KID="$CHAT_IDENTITY_KID" node -e '
  const jwks = JSON.parse(process.env.JWKS_JSON || "null");
  if (!Array.isArray(jwks?.keys) || jwks.keys.length !== 1) process.exit(1);
  const key = jwks.keys[0];
  if (key.kty !== "OKP" || key.crv !== "Ed25519" || key.alg !== "EdDSA" || key.use !== "sig" ||
      key.kid !== process.env.EXPECTED_KID || !/^[A-Za-z0-9_-]{43}$/.test(key.x) ||
      "d" in key || "jku" in key || "x5u" in key) process.exit(1);
'

PUBLIC_HEALTH="$(curl -fsS --resolve "$PUBLIC_HOST:443:127.0.0.1" --max-time 10 "https://$PUBLIC_HOST/health")"
PUBLIC_HEALTH="$PUBLIC_HEALTH" node -e '
  const health = JSON.parse(process.env.PUBLIC_HEALTH || "null");
  if (health?.ok !== true || health?.service !== "eclipse-dnd-bff" || health?.aiEnabled !== false) process.exit(1);
'
SESSION_HEADERS="$(mktemp)"
SESSION_BODY="$(mktemp)"
SESSION_STATUS="$(curl -sS --resolve "$PUBLIC_HOST:443:127.0.0.1" --max-time 10 \
  -D "$SESSION_HEADERS" -o "$SESSION_BODY" -w '%{http_code}' \
  -H 'Origin: https://dnd.eclipse-forge.ru' \
  "https://$PUBLIC_HOST/api/v1/auth/session")"
if [[ "$SESSION_STATUS" != "200" ]] ||
   ! grep -qi '^Access-Control-Allow-Origin: https://dnd\.eclipse-forge\.ru' "$SESSION_HEADERS"; then
  echo "DnD exact-origin session smoke failed" >&2
  exit 1
fi
SESSION_BODY_JSON="$(cat "$SESSION_BODY")"
SESSION_BODY_JSON="$SESSION_BODY_JSON" node -e '
  const body = JSON.parse(process.env.SESSION_BODY_JSON || "null");
  if (body?.authenticated !== false) process.exit(1);
'
rm -f -- "$SESSION_HEADERS" "$SESSION_BODY"
SESSION_HEADERS=""
SESSION_BODY=""

TLS12_OUTPUT="$(openssl s_client -connect 127.0.0.1:443 -servername "$PUBLIC_HOST" -tls1_2 -brief </dev/null 2>&1 || true)"
TLS13_OUTPUT="$(openssl s_client -connect 127.0.0.1:443 -servername "$PUBLIC_HOST" -tls1_3 -brief </dev/null 2>&1 || true)"
if ! grep -q 'Protocol version: TLSv1.2' <<<"$TLS12_OUTPUT" ||
   ! grep -q 'Protocol version: TLSv1.3' <<<"$TLS13_OUTPUT"; then
  echo "TLS 1.2/1.3 protocol smoke failed" >&2
  exit 1
fi
TLS11_OUTPUT="$(openssl s_client -connect 127.0.0.1:443 -servername "$PUBLIC_HOST" -tls1_1 -brief </dev/null 2>&1 || true)"
if grep -q 'Protocol version: TLSv1.1' <<<"$TLS11_OUTPUT"; then
  echo "Legacy TLS 1.1 is unexpectedly enabled" >&2
  exit 1
fi

EVIL_HEADERS="$(mktemp)"
EVIL_STATUS="$(curl -sS --resolve "$PUBLIC_HOST:443:127.0.0.1" --max-time 10 \
  -D "$EVIL_HEADERS" -o /dev/null -w '%{http_code}' \
  -H 'Origin: https://evil.example' \
  "https://$PUBLIC_HOST/api/v1/auth/session")"
if [[ "$EVIL_STATUS" != "403" ]] || grep -qi '^Access-Control-Allow-Origin:' "$EVIL_HEADERS"; then
  echo "DnD untrusted-origin smoke failed" >&2
  exit 1
fi
rm -f -- "$EVIL_HEADERS"
EVIL_HEADERS=""

CHAT_CHANGED=0
secure_remove "$CHAT_BACKUP"
CHAT_BACKUP=""
trap - EXIT
echo "DnD public HTTPS endpoint and Chat Ed25519 identity are active; AI remains disabled"
