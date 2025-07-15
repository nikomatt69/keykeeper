#!/bin/bash

# ===================================
# KEYKEEPER - SECURE SECRETS SETUP
# ===================================
#
# This script helps setup secure secrets management
# for KeyKeeper in different environments
#
# Usage: ./scripts/setup-secrets.sh [environment]
#   environment: dev, staging, production
#
# ===================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT="${1:-dev}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 KeyKeeper Secrets Setup - Environment: ${ENVIRONMENT}${NC}"
echo "=============================================="

# Check if .env.example exists
if [[ ! -f "$ROOT_DIR/.env.example" ]]; then
    echo -e "${RED}❌ Error: .env.example not found${NC}"
    exit 1
fi

# Function to generate secure random key
generate_key() {
    openssl rand -base64 32
}

# Function to generate signing key pair
generate_signing_keys() {
    local temp_dir=$(mktemp -d)
    local private_key="$temp_dir/private.key"
    local public_key="$temp_dir/public.key"
    
    # Generate RSA key pair
    openssl genpkey -algorithm RSA -out "$private_key" -pkcs8 -aes-256-cbc -pass pass:temp123
    openssl rsa -pubout -in "$private_key" -out "$public_key" -passin pass:temp123
    
    # Encode for Tauri
    local private_b64=$(base64 -i "$private_key")
    local public_b64=$(base64 -i "$public_key")
    
    echo "PRIVATE_KEY_B64=$private_b64"
    echo "PUBLIC_KEY_B64=$public_b64"
    
    # Cleanup
    rm -rf "$temp_dir"
}

# Function to setup development environment
setup_dev() {
    echo -e "${YELLOW}🛠️  Setting up development environment...${NC}"
    
    if [[ -f "$ROOT_DIR/.env" ]]; then
        echo -e "${YELLOW}⚠️  .env already exists. Backup created as .env.backup${NC}"
        cp "$ROOT_DIR/.env" "$ROOT_DIR/.env.backup"
    fi
    
    # Copy template
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    
    # Generate development keys
    local vault_key=$(generate_key)
    local backup_key=$(generate_key)
    
    # Add keys to .env
    echo "" >> "$ROOT_DIR/.env"
    echo "# === GENERATED DEVELOPMENT SECRETS ===" >> "$ROOT_DIR/.env"
    echo "VAULT_ENCRYPTION_KEY=$vault_key" >> "$ROOT_DIR/.env"
    echo "BACKUP_ENCRYPTION_KEY=$backup_key" >> "$ROOT_DIR/.env"
    echo "# === END SECRETS ===" >> "$ROOT_DIR/.env"
    
    echo -e "${GREEN}✅ Development .env created with generated keys${NC}"
    echo -e "${YELLOW}⚠️  Remember: .env is in .gitignore and won't be committed${NC}"
}

# Function to setup production environment
setup_production() {
    echo -e "${YELLOW}🏭 Setting up production environment...${NC}"
    
    echo -e "${BLUE}Generating secure keys for production...${NC}"
    
    local vault_key=$(generate_key)
    local backup_key=$(generate_key)
    
    echo ""
    echo -e "${GREEN}🔑 PRODUCTION SECRETS (Store these securely!)${NC}"
    echo "=============================================="
    echo "VAULT_ENCRYPTION_KEY=$vault_key"
    echo "BACKUP_ENCRYPTION_KEY=$backup_key"
    echo ""
    echo -e "${YELLOW}📋 GitHub Actions Secrets Setup:${NC}"
    echo "gh secret set VAULT_ENCRYPTION_KEY --body \"$vault_key\""
    echo "gh secret set BACKUP_ENCRYPTION_KEY --body \"$backup_key\""
    echo ""
    echo -e "${YELLOW}🐳 Docker Environment:${NC}"
    echo "docker run -e VAULT_ENCRYPTION_KEY=\"$vault_key\" \\"
    echo "           -e BACKUP_ENCRYPTION_KEY=\"$backup_key\" \\"
    echo "           keykeeper:latest"
    echo ""
    echo -e "${YELLOW}☸️  Kubernetes Secret:${NC}"
    echo "kubectl create secret generic keykeeper-secrets \\"
    echo "  --from-literal=vault-encryption-key=\"$vault_key\" \\"
    echo "  --from-literal=backup-encryption-key=\"$backup_key\""
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Save these secrets in your password manager!${NC}"
    echo -e "${RED}⚠️  NEVER commit these to version control!${NC}"
}

# Function to setup signing keys
setup_signing_keys() {
    echo -e "${YELLOW}📝 Generating signing keys for updates...${NC}"
    
    echo -e "${BLUE}Generating RSA key pair...${NC}"
    generate_signing_keys
    
    echo ""
    echo -e "${YELLOW}📋 Add these to your environment:${NC}"
    echo "TAURI_SIGNING_PRIVATE_KEY=<PRIVATE_KEY_B64>"
    echo "UPDATE_PUBLIC_KEY=<PUBLIC_KEY_B64>"
}

# Function to validate secrets
validate_secrets() {
    echo -e "${YELLOW}🔍 Validating current secrets setup...${NC}"
    
    local env_file="$ROOT_DIR/.env"
    if [[ ! -f "$env_file" ]]; then
        echo -e "${RED}❌ No .env file found${NC}"
        return 1
    fi
    
    # Check for required secrets
    local required_vars=(
        "VAULT_ENCRYPTION_KEY"
        "BACKUP_ENCRYPTION_KEY"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo -e "${RED}❌ Missing required secrets:${NC}"
        printf '   - %s\n' "${missing_vars[@]}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All required secrets are present${NC}"
    
    # Check for development vs production keys
    if grep -q "TAURI_SIGNING_PRIVATE_KEY=" "$env_file"; then
        echo -e "${YELLOW}⚠️  Signing keys found in .env - ensure these are for development only${NC}"
    fi
    
    return 0
}

# Function to rotate secrets
rotate_secrets() {
    echo -e "${YELLOW}🔄 Rotating encryption keys...${NC}"
    
    local env_file="$ROOT_DIR/.env"
    if [[ ! -f "$env_file" ]]; then
        echo -e "${RED}❌ No .env file found${NC}"
        return 1
    fi
    
    # Backup current .env
    cp "$env_file" "${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Generate new keys
    local new_vault_key=$(generate_key)
    local new_backup_key=$(generate_key)
    
    # Update .env file
    sed -i.bak "s/^VAULT_ENCRYPTION_KEY=.*/VAULT_ENCRYPTION_KEY=$new_vault_key/" "$env_file"
    sed -i.bak "s/^BACKUP_ENCRYPTION_KEY=.*/BACKUP_ENCRYPTION_KEY=$new_backup_key/" "$env_file"
    
    # Remove sed backup
    rm -f "${env_file}.bak"
    
    echo -e "${GREEN}✅ Secrets rotated successfully${NC}"
    echo -e "${YELLOW}⚠️  Update your production environment with new keys${NC}"
    echo "New VAULT_ENCRYPTION_KEY: $new_vault_key"
    echo "New BACKUP_ENCRYPTION_KEY: $new_backup_key"
}

# Main script logic
case "$ENVIRONMENT" in
    "dev"|"development")
        setup_dev
        ;;
    "prod"|"production")
        setup_production
        ;;
    "signing")
        setup_signing_keys
        ;;
    "validate")
        validate_secrets
        ;;
    "rotate")
        rotate_secrets
        ;;
    *)
        echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
        echo ""
        echo "Usage: $0 [environment]"
        echo "Environments:"
        echo "  dev         - Setup development environment"
        echo "  production  - Generate production secrets"
        echo "  signing     - Generate signing keys"
        echo "  validate    - Validate current secrets"
        echo "  rotate      - Rotate encryption keys"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Secrets setup completed!${NC}"