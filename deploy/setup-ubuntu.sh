#!/usr/bin/env bash
#
# One-shot setup for a fresh Ubuntu Server: installs Docker Engine + the compose
# plugin, then builds and starts the PRC Jupiter agent container.
#
# Usage (from the project directory, as root or with sudo):
#   sudo bash deploy/setup-ubuntu.sh
#
# Requirements before running:
#   - This directory contains Dockerfile, docker-compose.yml and a filled-in .env
#     (copy .env.example -> .env and set PHANTOM_PASSWORD).
#
set -euo pipefail

cd "$(dirname "$0")/.."   # project root (this script lives in deploy/)

echo "==> PRC Jupiter agent — Ubuntu setup"

# --- 1. Docker Engine + compose plugin -------------------------------------
if ! command -v docker >/dev/null 2>&1; then
    echo "==> Installing Docker Engine (get.docker.com)..."
    curl -fsSL https://get.docker.com | sh
else
    echo "==> Docker already installed: $(docker --version)"
fi

# compose plugin sanity check
if ! docker compose version >/dev/null 2>&1; then
    echo "==> Installing docker-compose-plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

systemctl enable --now docker

# Let the invoking user run docker without sudo (takes effect on next login)
if [ -n "${SUDO_USER:-}" ]; then usermod -aG docker "$SUDO_USER" || true; fi

# --- 2. Pre-flight checks ---------------------------------------------------
if [ ! -f .env ]; then
    echo "ERROR: .env not found. Run: cp .env.example .env  (then set PHANTOM_PASSWORD)" >&2
    exit 1
fi
if ! grep -q '^PHANTOM_PASSWORD=..*' .env; then
    echo "ERROR: PHANTOM_PASSWORD is empty in .env. Set it before deploying." >&2
    exit 1
fi
if [ ! -d extensions/phantom ]; then
    echo "ERROR: extensions/phantom/ is missing (the unpacked Phantom extension)." >&2
    exit 1
fi

mkdir -p user_data

# --- 2b. Swap (helps Chromium on low-RAM hosts; sentinel016 has ~3GB) -------
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
    echo "==> No swap detected; creating a 2G swapfile..."
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- 3. Build & run ---------------------------------------------------------
echo "==> Building image and starting container (this pulls the Playwright base image, ~2GB the first time)..."
docker compose up -d --build

echo
echo "==> Done. The agent is starting (browser launch + warmup takes ~30-60s)."
echo "    Health:  curl http://localhost:3011/health"
echo "    Logs:    docker compose logs -f"
echo
echo "==> NEXT: create the wallet (one time):"
echo "    curl -X POST http://localhost:3011/wallet/create"
echo "    # then back up the seed phrase immediately:"
echo "    docker exec prc-agent-jupiter cat /app/wallet_seed.txt"
