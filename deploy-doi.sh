#!/bin/bash
# =============================================================================
# DOI Service Deployment Script
# =============================================================================
# Usage:
#   ./deploy-doi.sh build     - Build WAR and Docker image
#   ./deploy-doi.sh start     - Start DOI service container
#   ./deploy-doi.sh stop      - Stop DOI service container
#   ./deploy-doi.sh restart   - Rebuild and restart
#   ./deploy-doi.sh logs      - View container logs
#   ./deploy-doi.sh status    - Check container status
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
CONTAINER_NAME="doi-service"
IMAGE_NAME="doi:latest"
DOI_PORT="${DOI_PORT:-8080}"
CONFIG_DIR="${DOI_CONFIG_DIR:-$SCRIPT_DIR/config}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if [ ! -d "$CONFIG_DIR" ]; then
        log_error "Config directory not found: $CONFIG_DIR"
        log_info "Set DOI_CONFIG_DIR environment variable or create config/ directory"
        exit 1
    fi

    if [ ! -f "$CONFIG_DIR/doi.properties" ]; then
        log_error "doi.properties not found in $CONFIG_DIR"
        exit 1
    fi
}

# Build WAR file
build_war() {
    log_info "Building DOI WAR file..."

    cd "$SCRIPT_DIR/doi"

    # Check for gradlew in parent directory
    if [ -f "../gradlew" ]; then
        ../gradlew build -x test -x checkstyleMain -x checkstyleTest -x checkstyleTestFixtures
    elif command -v gradle &> /dev/null; then
        gradle build -x test -x checkstyleMain -x checkstyleTest -x checkstyleTestFixtures
    else
        log_error "Neither gradlew nor gradle found"
        exit 1
    fi

    if [ ! -f "build/libs/doi.war" ]; then
        log_error "WAR file not created"
        exit 1
    fi

    log_success "WAR file built: doi/build/libs/doi.war"
    cd "$SCRIPT_DIR"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."

    docker build -t "$IMAGE_NAME" "$SCRIPT_DIR/doi"

    log_success "Docker image built: $IMAGE_NAME"
}

# Build everything
build_all() {
    check_prerequisites
    build_war
    build_image
}

# Stop container
stop_container() {
    log_info "Stopping DOI service..."

    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        docker stop "$CONTAINER_NAME"
        log_success "Container stopped"
    else
        log_info "Container not running"
    fi

    if docker ps -aq -f name="$CONTAINER_NAME" | grep -q .; then
        docker rm "$CONTAINER_NAME"
        log_info "Container removed"
    fi
}

# Start container
start_container() {
    check_prerequisites

    log_info "Starting DOI service..."
    log_info "  Port: $DOI_PORT"
    log_info "  Config: $CONFIG_DIR"

    # Stop if already running
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        log_warn "Container already running, stopping first..."
        stop_container
    fi

    # Check if image exists
    if ! docker image inspect "$IMAGE_NAME" &> /dev/null; then
        log_warn "Image not found, building..."
        build_all
    fi

    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$DOI_PORT:8080" \
        -v "$CONFIG_DIR:/config:ro" \
        "$IMAGE_NAME"

    log_info "Waiting for service to start..."
    sleep 5

    # Health check
    if curl -sf "http://localhost:$DOI_PORT/rafts/availability" > /dev/null 2>&1; then
        log_success "DOI service is healthy"
        log_success "Available at: http://localhost:$DOI_PORT/rafts/instances"
    else
        log_warn "Service may still be starting. Check logs with: $0 logs"
    fi
}

# Restart (rebuild and start)
restart_service() {
    stop_container
    build_all
    start_container
}

# View logs
view_logs() {
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        docker logs -f "$CONTAINER_NAME"
    else
        log_error "Container not running"
        exit 1
    fi
}

# Check status
check_status() {
    echo ""
    echo "DOI Service Status"
    echo "=================="

    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        echo -e "Container: ${GREEN}running${NC}"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" -f name="$CONTAINER_NAME"

        echo ""
        if curl -sf "http://localhost:$DOI_PORT/rafts/availability" > /dev/null 2>&1; then
            echo -e "Health: ${GREEN}healthy${NC}"
        else
            echo -e "Health: ${YELLOW}not responding${NC}"
        fi
    else
        echo -e "Container: ${RED}not running${NC}"
    fi

    echo ""
    echo "Configuration:"
    echo "  Config dir: $CONFIG_DIR"
    echo "  Port: $DOI_PORT"
    echo ""
}

# Show usage
show_usage() {
    echo ""
    echo "DOI Service Deployment Script"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  build     Build WAR and Docker image"
    echo "  start     Start DOI service container"
    echo "  stop      Stop DOI service container"
    echo "  restart   Rebuild and restart (stop + build + start)"
    echo "  logs      View container logs (follow mode)"
    echo "  status    Check container and service status"
    echo ""
    echo "Environment variables:"
    echo "  DOI_PORT       Port to expose (default: 8080)"
    echo "  DOI_CONFIG_DIR Config directory path (default: ./config)"
    echo ""
    echo "Examples:"
    echo "  $0 build                    # Build WAR and image"
    echo "  $0 start                    # Start service"
    echo "  $0 restart                  # Full rebuild and restart"
    echo "  DOI_PORT=9080 $0 start      # Start on different port"
    echo ""
}

# Main
case "${1:-}" in
    build)
        build_all
        ;;
    start)
        start_container
        ;;
    stop)
        stop_container
        ;;
    restart)
        restart_service
        ;;
    logs)
        view_logs
        ;;
    status)
        check_status
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
