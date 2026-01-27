#!/bin/bash
#
# Setup git-secrets for this repository
#
# This script installs git-secrets hooks and registers patterns
# to prevent committing sensitive information.
#
# Usage: ./scripts/setup-git-secrets.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
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

echo
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           Git Secrets Setup - Ham Radio Worker            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo

# Check if git-secrets is installed
if ! command -v git-secrets &> /dev/null; then
    log_error "git-secrets is not installed"
    echo
    log_info "Installation instructions:"
    echo
    echo "macOS:"
    echo "  brew install git-secrets"
    echo
    echo "Linux:"
    echo "  git clone https://github.com/awslabs/git-secrets"
    echo "  cd git-secrets"
    echo "  sudo make install"
    echo
    echo "Windows:"
    echo "  Download from: https://github.com/awslabs/git-secrets"
    echo
    exit 1
fi

log_success "git-secrets is installed"

# Check if we're in a git repository
if [ ! -d .git ]; then
    log_error "Not in a git repository"
    log_info "Run this script from the project root directory"
    exit 1
fi

log_success "In git repository"

# Install git-secrets hooks
log_info "Installing git-secrets hooks..."
if git secrets --install --force; then
    log_success "Hooks installed"
else
    log_error "Failed to install hooks"
    exit 1
fi

# Register AWS patterns
log_info "Registering AWS patterns..."
if git secrets --register-aws; then
    log_success "AWS patterns registered"
else
    log_warning "AWS patterns already registered or registration failed"
fi

# Add custom patterns
log_info "Adding custom patterns for this project..."

# Admin API Key pattern (64 hex characters)
git secrets --add '[0-9a-f]{64}'

# Generic API key patterns
git secrets --add 'api[_-]?key[\"'"'"']?\s*[:=]\s*[\"'"'"']?[a-zA-Z0-9_\-]{20,}'
git secrets --add 'apikey[\"'"'"']?\s*[:=]\s*[\"'"'"']?[a-zA-Z0-9_\-]{20,}'

# Secret key patterns
git secrets --add 'secret[_-]?key[\"'"'"']?\s*[:=]\s*[\"'"'"']?[a-zA-Z0-9_\-]{20,}'

# Token patterns
git secrets --add '[_-]?token[\"'"'"']?\s*[:=]\s*[\"'"'"']?[a-zA-Z0-9_\-]{20,}'

# Password patterns
git secrets --add 'password[\"'"'"']?\s*[:=]\s*[\"'"'"']?[^\s\"'"'"']{8,}'

# Environment variable assignments
git secrets --add 'ADMIN_API_KEY\s*=\s*[\"'"'"']?[a-zA-Z0-9_\-]{20,}'
git secrets --add 'API_KEY\s*=\s*[\"'"'"']?[a-zA-Z0-9_\-]{20,}'

# Database connection strings
git secrets --add '(postgres|mysql|mongodb|redis)://[^\s\"'"'"']+:[^\s\"'"'"']+@'

# Private keys
git secrets --add -- '-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----'

# JWT tokens
git secrets --add 'eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}'

log_success "Custom patterns added"

# Add allowed patterns (patterns that should NOT be flagged)
log_info "Adding allowed patterns (exceptions)..."

git secrets --add --allowed 'dev-test-key'
git secrets --add --allowed 'example-api-key'
git secrets --add --allowed 'your-api-key'
git secrets --add --allowed 'your-secret-key'
git secrets --add --allowed 'my-secret-key'
git secrets --add --allowed 'sk-test-'
git secrets --add --allowed 'sk-dev-'
git secrets --add --allowed 'replace-with-'
git secrets --add --allowed 'replace-me'
git secrets --add --allowed 'changeme'
git secrets --add --allowed 'test-api-key'
git secrets --add --allowed 'mock-secret'
git secrets --add --allowed 'dummy-token'

log_success "Allowed patterns added"

echo
log_success "✅ git-secrets setup complete!"
echo
log_info "What's protected:"
echo "  - API keys and tokens"
echo "  - Passwords and secrets"
echo "  - Database connection strings"
echo "  - Private keys"
echo "  - JWT tokens"
echo "  - Environment variable assignments with secrets"
echo
log_info "Usage:"
echo "  - Pre-commit hook: Automatically runs on 'git commit'"
echo "  - Manual scan: git secrets --scan"
echo "  - Scan history: git secrets --scan-history"
echo "  - List patterns: git secrets --list"
echo
log_warning "Note: This protects against accidental commits, but always review your changes!"
echo
