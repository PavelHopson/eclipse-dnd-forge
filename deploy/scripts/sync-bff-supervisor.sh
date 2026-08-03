#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${ECLIPSE_DND_BFF_PATH:-/var/www/eclipse-dnd-forge-bff}"
ENV_FILE="${DND_BFF_ENV_FILE:-/etc/eclipse-dnd-forge-bff.env}"
SERVICE_USER="eclipse-dnd-bff"
SOURCE="$DEPLOY_PATH/deploy/supervisor/eclipse-dnd-forge-bff.conf"
TARGET="/etc/supervisor/conf.d/eclipse-dnd-forge-bff.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "DnD BFF supervisor sync must run as root" >&2
  exit 1
fi
if [[ ! "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ || ! "$ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "DnD BFF paths contain unsupported characters" >&2
  exit 1
fi
if [[ ! -f "$SOURCE" || ! -r "$ENV_FILE" ]]; then
  echo "DnD BFF checkout or environment is missing" >&2
  exit 1
fi
if ! getent passwd "$SERVICE_USER" >/dev/null; then
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
fi
if [[ "$(stat -c '%U' "$ENV_FILE")" != "root" || "$(stat -c '%G' "$ENV_FILE")" != "$SERVICE_USER" || "$(stat -c '%a' "$ENV_FILE")" != "640" ]]; then
  echo "DnD BFF environment must be root:eclipse-dnd-bff mode 0640" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ ! "${DND_BFF_BUDGET_FILE:-}" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "DnD BFF budget path contains unsupported characters" >&2
  exit 1
fi
BUDGET_DIR="$(dirname -- "$DND_BFF_BUDGET_FILE")"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$BUDGET_DIR"
if [[ -f "$DND_BFF_BUDGET_FILE" ]]; then
  chown "$SERVICE_USER:$SERVICE_USER" "$DND_BFF_BUDGET_FILE"
  chmod 0640 "$DND_BFF_BUDGET_FILE"
fi

cd "$DEPLOY_PATH"
node --input-type=module -e "import('./bff/src/config.mjs').then(({ loadBffConfig }) => loadBffConfig())"

TMP_FILE="$(mktemp)"
trap 'rm -f -- "$TMP_FILE"' EXIT
sed \
  -e "s|@@DEPLOY_PATH@@|$DEPLOY_PATH|g" \
  -e "s|@@ENV_FILE@@|$ENV_FILE|g" \
  "$SOURCE" > "$TMP_FILE"

if [[ ! -f "$TARGET" ]] || ! cmp -s "$TMP_FILE" "$TARGET"; then
  install -o root -g root -m 0644 "$TMP_FILE" "$TARGET"
  supervisorctl reread
  supervisorctl update
fi

supervisorctl restart eclipse-dnd-forge-bff
sleep 2
HEALTH_JSON="$(curl -fsS --max-time 10 "http://127.0.0.1:${DND_BFF_PORT:-8820}/health")"
HEALTH_JSON="$HEALTH_JSON" node -e '
  const health = JSON.parse(process.env.HEALTH_JSON || "null");
  if (health?.ok !== true || health?.service !== "eclipse-dnd-bff") process.exit(1);
'
supervisorctl status eclipse-dnd-forge-bff
