#!/bin/sh
set -e

# Instalações antigas criaram a pasta de comprovantes como root. Ajusta o
# dono para o usuário "node" e só então inicia o app sem privilégios de root.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOADS_DIR"
  chown -R node:node "$UPLOADS_DIR"
  exec su-exec node "$@"
fi

exec "$@"
