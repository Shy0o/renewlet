#!/usr/bin/env bash
set -euo pipefail

RAW_BASE="${RENEWLET_RAW_BASE:-https://raw.githubusercontent.com/zhiyingzzhou/renewlet/main/deploy}"
COMPOSE_FILE="${RENEWLET_COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${RENEWLET_ENV_FILE:-.env}"
DATA_DIR="${RENEWLET_DATA_DIR:-data}"

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

download() {
  local url="$1"
  local target="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$target"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$target" "$url"
    return
  fi

  fail "curl or wget is required to download Renewlet deployment files"
}

require_docker_compose() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker is not installed. Install Docker first, then rerun this script"
  fi

  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose v2 is not available. Install the Docker Compose plugin, then rerun this script"
  fi
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
    return
  fi

  if [ -r /dev/urandom ]; then
    if command -v od >/dev/null 2>&1; then
      od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
      printf '\n'
      return
    fi
  fi

  fail "openssl or /dev/urandom is required to generate secrets"
}

ensure_env_value() {
  local key="$1"
  local value="$2"
  local current_value=""
  local escaped_value

  escaped_value=$(printf '%s' "$value" | sed 's/[\/&]/\\&/g')

  if grep -Eq "^${key}=" "$ENV_FILE"; then
    current_value=$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2-)
    current_value=$(printf '%s' "$current_value" | sed -E "s/^['\"]//; s/['\"]$//")

    if [ -z "$current_value" ]; then
      sed -i.bak "s/^${key}=.*/${key}=\"${escaped_value}\"/" "$ENV_FILE"
      rm -f "${ENV_FILE}.bak"
      log "Generated ${key}"
    else
      log "Keeping existing ${key}"
    fi
  else
    printf '%s="%s"\n' "$key" "$value" >>"$ENV_FILE"
    log "Added ${key}"
  fi
}

detect_access_url() {
  local port="3000"

  if grep -Eq '^PORT=' "$ENV_FILE"; then
    port=$(grep -E '^PORT=' "$ENV_FILE" | tail -n 1 | sed -E 's/^PORT="?([^"]*)"?$/\1/')
  fi

  printf 'http://localhost:%s/setup' "$port"
}

main() {
  require_docker_compose

  log "Preparing Renewlet Docker deployment in $(pwd)"

  if [ ! -f "$COMPOSE_FILE" ]; then
    download "${RAW_BASE}/docker-compose.yml" "$COMPOSE_FILE"
    log "Downloaded ${COMPOSE_FILE}"
  else
    log "Keeping existing ${COMPOSE_FILE}"
  fi

  if [ ! -f "$ENV_FILE" ]; then
    download "${RAW_BASE}/env.example" "$ENV_FILE"
    log "Downloaded ${ENV_FILE}"
  else
    log "Keeping existing ${ENV_FILE}"
  fi

  mkdir -p "$DATA_DIR"
  chmod 700 "$DATA_DIR" 2>/dev/null || true
  chmod 600 "$ENV_FILE" 2>/dev/null || true

  ensure_env_value "PB_ENCRYPTION_KEY" "$(random_secret)"
  ensure_env_value "CRON_SECRET" "$(random_secret)"

  log ""
  log "Renewlet deployment files are ready."
  log ""
  log "Start:"
  log "  docker compose up -d"
  log ""
  log "Open:"
  log "  $(detect_access_url)"
  log ""
  log "Common commands:"
  log "  docker compose logs -f"
  log "  docker compose pull && docker compose up -d"
  log "  docker compose down"
}

main "$@"
