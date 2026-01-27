#!/bin/bash
#
# Secrets Setup Helper Script
# 
# This script helps you set up secrets for the Ham Radio Callsign Worker.
# It provides an interactive way to generate and configure secrets for
# development and production environments.
#
# Usage:
#   ./scripts/secrets-setup.sh [environment]
#
# Examples:
#   ./scripts/secrets-setup.sh dev        # Setup development secrets
#   ./scripts/secrets-setup.sh production # Setup production secrets
#   ./scripts/secrets-setup.sh            # Interactive mode
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Generate a secure random API key
generate_api_key() {
    # Try openssl first (most common)
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    # Try node if available
    elif command -v node &> /dev/null; then
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    # Fallback to /dev/urandom
    elif [ -f /dev/urandom ]; then
        head -c 32 /dev/urandom | xxd -p | tr -d '\n'
    else
        log_error "Cannot generate random key. Please install openssl or nodejs."
        exit 1
    fi
}

# Check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Setup development environment
setup_dev() {
    log_info "Setting up development environment secrets..."
    echo
    
    # Check if .dev.vars already exists
    if [ -f .dev.vars ]; then
        log_warning ".dev.vars already exists"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Keeping existing .dev.vars"
            return
        fi
    fi
    
    # Check if .dev.vars.example exists
    if [ ! -f .dev.vars.example ]; then
        log_error ".dev.vars.example not found"
        log_info "Creating .dev.vars.example..."
        echo "# Development Environment Variables" > .dev.vars.example
        echo "ADMIN_API_KEY=dev-test-key-replace-me" >> .dev.vars.example
    fi
    
    # Generate a new API key
    log_info "Generating secure API key for development..."
    DEV_API_KEY=$(generate_api_key)
    
    # Create .dev.vars
    cat > .dev.vars << EOF
# Development Environment Variables
# Generated: $(date)
# DO NOT COMMIT THIS FILE!

# Admin API Key for local development
ADMIN_API_KEY=$DEV_API_KEY
EOF
    
    log_success "Created .dev.vars with generated API key"
    
    # Show only partial key for security (first 8 and last 8 characters)
    MASKED_KEY="${DEV_API_KEY:0:8}...${DEV_API_KEY: -8}"
    log_warning "API Key (partial): $MASKED_KEY"
    log_info "Full key saved to .dev.vars - check the file if needed"
    log_info "Store this key securely if you need to share it with your team"
    echo
    log_info "To start development server: npm run dev"
}

# Setup production environment
setup_production() {
    local env_name=$1
    log_info "Setting up $env_name environment secrets..."
    echo
    
    # Check if wrangler is installed
    if ! command_exists wrangler; then
        log_error "Wrangler CLI is not installed"
        log_info "Install it with: npm install -g wrangler"
        exit 1
    fi
    
    # Check if logged in to Wrangler
    log_info "Checking Wrangler authentication..."
    if ! wrangler whoami &> /dev/null; then
        log_warning "Not logged in to Wrangler"
        log_info "Running: wrangler login"
        wrangler login
    else
        log_success "Authenticated with Wrangler"
    fi
    
    # Generate API key
    log_info "Generating secure API key for $env_name..."
    PROD_API_KEY=$(generate_api_key)
    
    echo
    log_info "Generated API Key for $env_name:"
    echo -e "${YELLOW}$PROD_API_KEY${NC}"
    echo
    log_warning "IMPORTANT: Save this key securely! You won't be able to retrieve it later."
    log_info "Recommended: Store in a password manager (1Password, LastPass, etc.)"
    echo
    
    read -p "Press Enter to set this key in Wrangler, or Ctrl+C to cancel..."
    
    # Set the secret
    if [ "$env_name" = "production" ]; then
        echo "$PROD_API_KEY" | wrangler secret put ADMIN_API_KEY --env production
    elif [ "$env_name" = "staging" ]; then
        echo "$PROD_API_KEY" | wrangler secret put ADMIN_API_KEY --env staging
    else
        echo "$PROD_API_KEY" | wrangler secret put ADMIN_API_KEY
    fi
    
    log_success "Secret ADMIN_API_KEY set for $env_name"
    
    # Verify
    echo
    log_info "Verifying secrets..."
    if [ "$env_name" = "production" ] || [ "$env_name" = "staging" ]; then
        wrangler secret list --env "$env_name"
    else
        wrangler secret list
    fi
    
    echo
    log_success "✅ $env_name environment secrets configured successfully!"
    echo
    log_info "Next steps:"
    if [ "$env_name" = "production" ] || [ "$env_name" = "staging" ]; then
        echo "  1. Deploy: wrangler deploy --env $env_name"
    else
        echo "  1. Deploy: wrangler deploy"
    fi
    echo "  2. Test admin endpoint with your new API key"
    echo "  3. Update your API clients with the new key"
}

# List current secrets
list_secrets() {
    log_info "Listing configured secrets..."
    echo
    
    if ! command_exists wrangler; then
        log_error "Wrangler CLI is not installed"
        exit 1
    fi
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not logged in to Wrangler"
        log_info "Run: wrangler login"
        exit 1
    fi
    
    log_info "Development environment:"
    if [ -f .dev.vars ]; then
        log_success ".dev.vars exists"
        grep -v '^#' .dev.vars | grep -v '^$' | sed 's/=.*/=[REDACTED]/'
    else
        log_warning ".dev.vars not found"
    fi
    
    echo
    log_info "Production environment secrets (names only):"
    wrangler secret list || log_warning "No production secrets found or not authorized"
}

# Interactive mode
interactive_mode() {
    echo
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║       Ham Radio Callsign Worker - Secrets Setup           ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo
    log_info "This script will help you configure secrets for your worker."
    echo
    echo "Select an option:"
    echo "  1) Setup development environment (.dev.vars)"
    echo "  2) Setup production environment (Wrangler secrets)"
    echo "  3) Setup staging environment (Wrangler secrets)"
    echo "  4) List configured secrets"
    echo "  5) Generate API key only (don't configure)"
    echo "  6) Exit"
    echo
    read -p "Enter your choice (1-6): " -n 1 -r
    echo
    echo
    
    case $REPLY in
        1)
            setup_dev
            ;;
        2)
            setup_production "production"
            ;;
        3)
            setup_production "staging"
            ;;
        4)
            list_secrets
            ;;
        5)
            log_info "Generating secure API key..."
            API_KEY=$(generate_api_key)
            echo
            log_success "Generated API Key:"
            echo -e "${YELLOW}$API_KEY${NC}"
            echo
            log_info "Use this key for ADMIN_API_KEY"
            ;;
        6)
            log_info "Exiting..."
            exit 0
            ;;
        *)
            log_error "Invalid option"
            exit 1
            ;;
    esac
}

# Main script logic
main() {
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || ([ ! -f "wrangler.toml" ] && [ ! -f "wrangler.toml.example" ]); then
        log_error "This script must be run from the project root directory"
        log_info "Expected to find package.json and wrangler.toml (or wrangler.toml.example)"
        exit 1
    fi
    
    # Parse command line arguments
    if [ $# -eq 0 ]; then
        # No arguments - interactive mode
        interactive_mode
    elif [ "$1" = "dev" ] || [ "$1" = "development" ]; then
        setup_dev
    elif [ "$1" = "production" ] || [ "$1" = "prod" ]; then
        setup_production "production"
    elif [ "$1" = "staging" ]; then
        setup_production "staging"
    elif [ "$1" = "list" ]; then
        list_secrets
    elif [ "$1" = "generate" ]; then
        API_KEY=$(generate_api_key)
        echo "$API_KEY"
    elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Usage: $0 [environment]"
        echo
        echo "Environments:"
        echo "  dev, development  - Setup development secrets (.dev.vars)"
        echo "  production, prod  - Setup production secrets (Wrangler)"
        echo "  staging          - Setup staging secrets (Wrangler)"
        echo "  list             - List configured secrets"
        echo "  generate         - Generate API key only"
        echo
        echo "Examples:"
        echo "  $0                # Interactive mode"
        echo "  $0 dev            # Setup dev environment"
        echo "  $0 production     # Setup production environment"
        echo "  $0 list           # List secrets"
        echo "  $0 generate       # Generate API key"
    else
        log_error "Unknown environment: $1"
        log_info "Use --help for usage information"
        exit 1
    fi
}

# Run the script
main "$@"
