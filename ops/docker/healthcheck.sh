#!/usr/bin/env bash
# Container-level health probe for the Nashr app image.
#
# Checks all three supervised Node processes, not just nginx — nginx staying up
# while the backend is crash-looping is exactly the failure this must catch.
set -euo pipefail

BACKEND_PORT="${PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-4200}"
ORCHESTRATOR_PORT="${ORCHESTRATOR_PORT:-3002}"
NGINX_PORT="${NGINX_PORT:-5000}"

probe() {
  # -f fails on HTTP >= 400; 3xx is accepted (the frontend redirects to /auth).
  curl --fail --silent --show-error --max-time 5 --output /dev/null "$1"
}

probe "http://127.0.0.1:${BACKEND_PORT}/"                       || { echo "backend (:${BACKEND_PORT}) unhealthy"; exit 1; }
probe "http://127.0.0.1:${FRONTEND_PORT}/"                      || { echo "frontend (:${FRONTEND_PORT}) unhealthy"; exit 1; }
probe "http://127.0.0.1:${ORCHESTRATOR_PORT}/health/status"     || { echo "orchestrator (:${ORCHESTRATOR_PORT}) unhealthy — Temporal unreachable?"; exit 1; }
probe "http://127.0.0.1:${NGINX_PORT}/api/"                     || { echo "internal nginx (:${NGINX_PORT}) unhealthy"; exit 1; }

echo "ok"
