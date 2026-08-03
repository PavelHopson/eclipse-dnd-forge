#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${ECLIPSE_DND_BFF_PATH:-/var/www/eclipse-dnd-forge-bff}"
ENV_FILE="${DND_BFF_ENV_FILE:-/etc/eclipse-dnd-forge-bff.env}"

if [[ ! "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ || ! "$ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "DnD BFF paths contain unsupported characters" >&2
  exit 1
fi
if [[ ! -r "$ENV_FILE" ]]; then
  echo "DnD BFF environment is not readable" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

cd "$DEPLOY_PATH"
exec node bff/src/index.mjs
