#!/bin/bash
#
# Secret Validation Script
#
# This script validates that secrets are properly configured and no
# secrets are accidentally committed to the repository.
#
# Usage:
#   ./scripts/validate-secrets.sh [--ci]
#
# Options:
#   --ci    Run in CI mode (exit with error if issues found)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CI_MODE=false
ERRORS=0
WARNINGS=0

# Parse arguments
for arg in "$@"; do
    case $arg in
        --ci)
            CI_MODE=true
            shift
            ;;
    esac
done

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

echo
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            Secret Validation - Ham Radio Worker           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo

# Check 1: Verify .gitignore contains secret patterns
log_info "Checking .gitignore for secret patterns..."
if [ ! -f .gitignore ]; then
    log_error ".gitignore not found"
else
    REQUIRED_PATTERNS=(".dev.vars" ".env" "*.secret" "*.key")
    for pattern in "${REQUIRED_PATTERNS[@]}"; do
        if grep -q "$pattern" .gitignore; then
            log_success ".gitignore contains: $pattern"
        else
            log_warning ".gitignore missing pattern: $pattern"
        fi
    done
fi

echo

# Check 2: Verify no .dev.vars is committed
log_info "Checking for committed .dev.vars..."
if git ls-files | grep -q "^\.dev\.vars$"; then
    log_error ".dev.vars is committed to git (should be git-ignored)"
else
    log_success ".dev.vars not in git"
fi

echo

# Check 3: Verify .dev.vars.example exists
log_info "Checking for .dev.vars.example..."
if [ -f .dev.vars.example ]; then
    log_success ".dev.vars.example exists"
else
    log_warning ".dev.vars.example not found (should exist as template)"
fi

echo

# Check 4: Scan for potential secrets in tracked files
log_info "Scanning tracked files for potential secrets..."

# Patterns that might indicate secrets (simplified for bash)
SECRET_PATTERNS=(
    "api[_-]?key.*[:=].*['\"][a-zA-Z0-9_\-]{20,}['\"]"
    "apikey.*[:=].*['\"][a-zA-Z0-9_\-]{20,}['\"]"
    "secret.*[:=].*['\"][a-zA-Z0-9_\-]{20,}['\"]"
    "password.*[:=].*['\"][a-zA-Z0-9_\-]{8,}['\"]"
    "ADMIN_API_KEY.*[:=].*['\"][a-zA-Z0-9_\-]{20,}['\"]"
    "-----BEGIN.*PRIVATE KEY-----"
)

FOUND_SECRETS=false

for pattern in "${SECRET_PATTERNS[@]}"; do
    # Search in tracked files, excluding known safe files
    if git ls-files | grep -E '\.(ts|js|json|yaml|yml|toml|sh)$' | \
       xargs grep -l -E -i "$pattern" 2>/dev/null | \
       grep -v -E '(\.example$|\.sample$|SECRETS_MANAGEMENT\.md|\.git-secrets-patterns)'; then
        log_error "Potential secret found matching pattern: $pattern"
        FOUND_SECRETS=true
    fi
done

if [ "$FOUND_SECRETS" = false ]; then
    log_success "No obvious secrets found in tracked files"
fi

echo

# Check 5: Verify required documentation exists
log_info "Checking for secrets management documentation..."
REQUIRED_DOCS=("SECRETS_MANAGEMENT.md" ".dev.vars.example" "wrangler.toml.example")
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        log_success "Documentation exists: $doc"
    else
        log_warning "Documentation missing: $doc"
    fi
done

echo

# Check 6: Verify scripts exist
log_info "Checking for secrets management scripts..."
REQUIRED_SCRIPTS=("scripts/secrets-setup.sh" "scripts/setup-git-secrets.sh")
for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            log_success "Script exists and is executable: $script"
        else
            log_warning "Script exists but not executable: $script"
        fi
    else
        log_warning "Script missing: $script"
    fi
done

echo

# Check 7: Check for test files with secrets
log_info "Checking test files for hardcoded secrets..."
if git ls-files | grep -E 'test/.*\.(ts|js)$' | xargs grep -l -E -i "(api[_-]?key|password|secret).*[:=].*['\"][a-zA-Z0-9_\-]{20,}['\"]" 2>/dev/null | head -5; then
    log_warning "Test files may contain hardcoded values (review for secrets)"
else
    log_success "No obvious secrets in test files"
fi

echo

# Check 8: Verify wrangler.toml doesn't contain secrets
log_info "Checking wrangler.toml for secrets..."
if [ -f wrangler.toml ]; then
    # Check for patterns that might be secrets in vars section
    if grep -A 10 '^\[vars\]' wrangler.toml | grep -E -i "(api[_-]?key|password|token|secret).*=.*[a-zA-Z0-9_\-]{20,}" | grep -v -E '(ENVIRONMENT|LOG_LEVEL)'; then
        log_error "wrangler.toml may contain secrets in [vars] section"
    else
        log_success "wrangler.toml [vars] section looks safe"
    fi
else
    log_warning "wrangler.toml not found"
fi

echo

# Summary
echo "═══════════════════════════════════════════════════════════"
echo "VALIDATION SUMMARY"
echo "═══════════════════════════════════════════════════════════"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    log_success "All checks passed! No issues found."
    echo
    exit 0
elif [ $ERRORS -eq 0 ]; then
    log_warning "Validation complete with $WARNINGS warning(s)"
    echo
    if [ "$CI_MODE" = true ]; then
        log_info "CI mode: Treating warnings as success"
        exit 0
    else
        exit 0
    fi
else
    log_error "Validation failed with $ERRORS error(s) and $WARNINGS warning(s)"
    echo
    if [ "$CI_MODE" = true ]; then
        log_error "CI mode: Failing build due to errors"
        exit 1
    else
        log_info "Fix the errors above before committing"
        exit 1
    fi
fi
