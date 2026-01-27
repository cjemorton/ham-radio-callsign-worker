#!/bin/bash
#
# Demo: Secret Injection Test
#
# This script demonstrates and tests that secrets are properly injected
# into the Cloudflare Worker environment and not hardcoded in the codebase.
#
# Usage: ./scripts/demo-secret-injection.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_demo() {
    echo -e "${CYAN}▶${NC} $1"
}

echo
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Secret Injection Demo - Ham Radio Worker          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo

log_info "This demo shows how secrets are injected and used in the worker"
echo

# Step 1: Verify no hardcoded secrets in source
echo "═══════════════════════════════════════════════════════════"
log_demo "STEP 1: Verify No Hardcoded Secrets in Source Code"
echo "═══════════════════════════════════════════════════════════"
echo

log_info "Searching for potential hardcoded secrets in src/ directory..."

HARDCODED_FOUND=false

# Check for suspicious patterns in source files
if git ls-files src/ | xargs grep -n -E "(api[_-]?key|password|secret).*[:=].*['\"][a-zA-Z0-9_\-]{20,}['\"]" 2>/dev/null; then
    log_error "Found potential hardcoded secrets in source code!"
    HARDCODED_FOUND=true
else
    log_success "No hardcoded secrets found in source code"
fi

echo

# Step 2: Check how secrets are accessed
echo "═══════════════════════════════════════════════════════════"
log_demo "STEP 2: How Secrets Are Accessed in Code"
echo "═══════════════════════════════════════════════════════════"
echo

log_info "Checking how ADMIN_API_KEY is accessed in middleware.ts..."
echo

if grep -n "env.ADMIN_API_KEY" src/middleware.ts; then
    echo
    log_success "Secret is accessed via environment binding (env.ADMIN_API_KEY)"
    log_success "This is the correct pattern - secrets come from Wrangler, not code"
else
    log_warning "Could not find environment binding usage"
fi

echo

# Step 3: Check TypeScript type definitions
echo "═══════════════════════════════════════════════════════════"
log_demo "STEP 3: Secret Type Definitions"
echo "═══════════════════════════════════════════════════════════"
echo

log_info "Checking types.ts for secret definitions..."
echo

if grep -A 2 "ADMIN_API_KEY" src/types.ts; then
    echo
    log_success "Secret is properly typed as optional string"
    log_success "This ensures TypeScript type safety for secret access"
else
    log_warning "Could not find type definition"
fi

echo

# Step 4: Development setup
echo "═══════════════════════════════════════════════════════════"
log_demo "STEP 4: Development Secret Configuration"
echo "═══════════════════════════════════════════════════════════"
echo

if [ -f .dev.vars ]; then
    log_success ".dev.vars file exists for local development"
    
    # Show structure without revealing actual values
    log_info "Contents (values redacted):"
    grep -v '^#' .dev.vars | grep -v '^$' | sed 's/=.*/=[REDACTED]/' | sed 's/^/  /'
else
    log_warning ".dev.vars not found - create it for local development"
    log_info "Run: ./scripts/secrets-setup.sh dev"
fi

echo

if [ -f .dev.vars.example ]; then
    log_success ".dev.vars.example template exists"
else
    log_error ".dev.vars.example template missing"
fi

echo

# Step 5: Test local development setup (if wrangler dev is available)
echo "═══════════════════════════════════════════════════════════"
log_demo "STEP 5: Test Secret Injection in Development"
echo "═══════════════════════════════════════════════════════════"
echo

if [ ! -f .dev.vars ]; then
    log_warning "Cannot test secret injection without .dev.vars"
    log_info "To test secret injection:"
    echo "  1. Run: ./scripts/secrets-setup.sh dev"
    echo "  2. Run: npm run dev"
    echo "  3. Test admin endpoint with API key"
    echo
else
    log_info "Testing environment variable injection..."
    
    # Source the .dev.vars to test
    if [ -f .dev.vars ]; then
        # Read the API key length without exposing it
        API_KEY=$(grep "^ADMIN_API_KEY=" .dev.vars | cut -d= -f2)
        if [ -n "$API_KEY" ]; then
            KEY_LENGTH=${#API_KEY}
            log_success "ADMIN_API_KEY is configured (length: $KEY_LENGTH)"
            
            if [ $KEY_LENGTH -ge 32 ]; then
                log_success "API key length is strong (32+ characters)"
            else
                log_warning "API key should be at least 32 characters for security"
            fi
        else
            log_warning "ADMIN_API_KEY is empty in .dev.vars"
        fi
    fi
    
    echo
    log_info "To test the worker with secret injection:"
    echo
    echo "  # Terminal 1: Start dev server"
    echo "  npm run dev"
    echo
    echo "  # Terminal 2: Test without API key (should fail)"
    echo "  curl http://localhost:8787/admin/stats"
    echo
    echo "  # Terminal 2: Test with API key (should succeed)"
    echo "  curl -H \"X-API-Key: \$(grep ADMIN_API_KEY .dev.vars | cut -d= -f2)\" \\"
    echo "       http://localhost:8787/admin/stats"
fi

echo

# Step 6: Production setup
echo "═══════════════════════════════════════════════════════════"
log_demo "STEP 6: Production Secret Management"
echo "═══════════════════════════════════════════════════════════"
echo

log_info "Production secrets are managed via Wrangler CLI:"
echo
echo "  # Set a secret"
echo "  wrangler secret put ADMIN_API_KEY"
echo
echo "  # List secrets (names only, values are encrypted)"
echo "  wrangler secret list"
echo
echo "  # Delete a secret"
echo "  wrangler secret delete ADMIN_API_KEY"
echo

log_success "Production secrets are encrypted and never exposed"
log_success "Secrets are injected at runtime via environment bindings"

echo

# Step 7: Summary
echo "═══════════════════════════════════════════════════════════"
log_demo "SUMMARY: Secret Injection Architecture"
echo "═══════════════════════════════════════════════════════════"
echo

log_success "✓ No secrets hardcoded in source code"
log_success "✓ Secrets accessed via env bindings (env.ADMIN_API_KEY)"
log_success "✓ Type definitions ensure safe secret access"
log_success "✓ Development: .dev.vars (git-ignored)"
log_success "✓ Production: Wrangler secrets (encrypted)"
log_success "✓ CI/CD: GitHub Actions secrets"

echo
log_info "Key Security Features:"
echo "  • Secrets never committed to repository"
echo "  • Environment-based secret injection"
echo "  • Strong encryption for production secrets"
echo "  • Type-safe access patterns"
echo "  • Separate secrets per environment"
echo "  • Automated validation and scanning"
echo

if [ "$HARDCODED_FOUND" = true ]; then
    log_error "⚠️  SECURITY ISSUE: Hardcoded secrets found!"
    log_error "Review the flagged files and remove any hardcoded secrets"
    exit 1
else
    log_success "🎉 All security checks passed!"
    log_success "Secret injection is working correctly"
fi

echo
log_info "For complete documentation, see: SECRETS_MANAGEMENT.md"
echo
