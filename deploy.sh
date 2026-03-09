#!/usr/bin/env bash
#
# deploy.sh — Zero-downtime deployment for the Enterprise Timesheet Platform
#
# Usage:
#   ./deploy.sh              # Full deploy (pull, rebuild, restart)
#   ./deploy.sh --no-pull    # Skip git pull (deploy current code)
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - Git repository cloned
#   - .env file configured (optional, for secrets)
#
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="timesheet"

# ── Colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

log()  { echo -e "${CYAN}[DEPLOY]${NC} $*"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn() { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
err()  { echo -e "${RED}[ERROR ]${NC} $*" >&2; }

# ── Pre-flight checks ───────────────────────────────────────────────────
log "Starting deployment..."

if ! command -v docker &> /dev/null; then
    err "Docker is not installed. Aborting."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    err "Docker Compose is not available. Aborting."
    exit 1
fi

# ── Step 1: Pull latest code ────────────────────────────────────────────
if [[ "${1:-}" != "--no-pull" ]]; then
    log "Pulling latest code from git..."
    git pull origin main
    ok "Code updated."
else
    warn "Skipping git pull (--no-pull flag)."
fi

# ── Step 2: Stop existing containers ────────────────────────────────────
log "Stopping existing containers..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --remove-orphans
ok "Containers stopped."

# ── Step 3: Rebuild images ──────────────────────────────────────────────
log "Building production images..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build --parallel
ok "Images built."

# ── Step 4: Start the cluster ───────────────────────────────────────────
log "Starting production cluster..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
ok "Cluster is up."

# ── Step 5: Health check ────────────────────────────────────────────────
log "Waiting for services to become healthy..."
sleep 5

HEALTHY=true

for SERVICE in web billing-service reporting-service; do
    HEALTH_URL="http://localhost"
    case "$SERVICE" in
        web)               HEALTH_URL="http://localhost/health" ;;
        billing-service)   HEALTH_URL="http://localhost/api/billing/health" ;;
        reporting-service) HEALTH_URL="http://localhost/api/reports/health" ;;
    esac

    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        ok "$SERVICE is healthy."
    else
        warn "$SERVICE health check failed (may still be starting)."
        HEALTHY=false
    fi
done

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
log "═══════════════════════════════════════════════"
if $HEALTHY; then
    ok "Deployment complete. All services healthy."
else
    warn "Deployment complete. Some services may still be starting."
    log "Run 'docker compose -f $COMPOSE_FILE ps' to check status."
fi
log "═══════════════════════════════════════════════"
echo ""
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
